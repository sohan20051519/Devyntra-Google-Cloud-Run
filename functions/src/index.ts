import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { Octokit } from "@octokit/rest";
import axios from "axios";
const sodium: any = require("tweetsodium");
import * as admin from "firebase-admin";
import * as crypto from "crypto";

// Initialize Admin SDK once
try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch {}
const db = admin.firestore();

// Access Secret Manager without Firebase bindings
async function accessSecret(projectId: string, name: string): Promise<string | null> {
  try {
    const token = await getAccessToken();
    const url = `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${name}/versions/latest:access`;
    const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
    const payload = data?.payload?.data;
    if (!payload) return null;
    return Buffer.from(payload, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

// Resolve the HTTPS URL of a Gen2 Cloud Function by name (same project/region)
async function resolveFunctionUrl(projectId: string, region: string, functionName: string): Promise<string | null> {
  try {
    const token = await getAccessToken();
    const url = `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${region}/functions/${functionName}`;
    const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
    return data?.serviceConfig?.uri || null;
  } catch {
    return null;
  }
}

// Ensure a secret exists in Secret Manager with a specific value
async function ensureSecret(projectId: string, name: string, value: string): Promise<void> {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  // Create secret if missing
  try {
    await axios.get(`https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${name}`, { headers });
  } catch {
    try {
      await axios.post(`https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets?secretId=${name}`, { replication: { automatic: {} } }, { headers });
    } catch {}
  }
  // Add version
  try {
    const payload = Buffer.from(value, 'utf8').toString('base64');
    await axios.post(`https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${name}:addVersion`, { payload: { data: payload } }, { headers });
  } catch {}
}

// Ensure a workflow is enabled (it can be disabled due to inactivity or manually)
async function ensureWorkflowEnabled(octokit: Octokit, owner: string, repo: string, workflowFile: string): Promise<void> {
  try {
    const id = await resolveWorkflowId(octokit, owner, repo, workflowFile);
    if (id) {
      try {
        const wf = await octokit.rest.actions.getWorkflow({ owner, repo, workflow_id: id });
        const state = (wf.data as any)?.state?.toString().toLowerCase();
        if (state && (state.includes('disabled') || state === 'inactive')) {
          await octokit.rest.actions.enableWorkflow({ owner, repo, workflow_id: id });
        }
      } catch {
        try { await octokit.rest.actions.enableWorkflow({ owner, repo, workflow_id: id }); } catch {}
      }
    }
  } catch {}
}

// Lightweight helper to notify our webhook with progress updates
async function notifyProgress(webhookUrl: string | undefined, webhookToken: string | undefined, payload: Record<string, any>) {
  try {
    if (!webhookUrl || !webhookToken) return;
    await axios.post(webhookUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-Devyntra-Token": webhookToken,
      },
      timeout: 5000,
    });
  } catch {}
}

// Secrets are read from process.env only to avoid deploy-time prompts. Optional.

type DetectResult = {
  language: string | null;
  framework: string | null;
  details: any;
};

// Helpers to call Google APIs with the Function's service account
async function getAccessToken(): Promise<string> {
  try {
    const resp = await axios.get("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
      headers: { "Metadata-Flavor": "Google" },
      timeout: 2000,
    });
    return resp.data.access_token as string;
  } catch (e) {
    logger.warn("Failed to fetch metadata access token", e as any);
    throw new Error("Missing GCP credentials to bootstrap service account");
  }
}

async function ensureDeployerServiceAccount(projectId: string, addLog?: (s: string) => Promise<void>): Promise<{ email: string; keyJson: string }>{
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };
  const saId = "devyntra-deployer";
  const saName = `projects/${projectId}/serviceAccounts/${saId}@${projectId}.iam.gserviceaccount.com`;
  const saEmail = `${saId}@${projectId}.iam.gserviceaccount.com`;

  // 1) Ensure service account exists
  try {
    await axios.get(`https://iam.googleapis.com/v1/${saName}`, { headers });
  } catch {
    await axios.post(`https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`, {
      accountId: saId,
      serviceAccount: { displayName: "Devyntra Cloud Run Deployer" },
    }, { headers });
    if (addLog) await addLog(`Created service account ${saEmail}`);
  }

  // 2) Bind required roles on project IAM policy if missing
  const roles = [
    "roles/run.admin",
    "roles/iam.serviceAccountUser",
    "roles/artifactregistry.reader",
    "roles/storage.admin",
  ];
  const crHeaders = { ...headers, "Content-Type": "application/json" };
  const getPolicy = await axios.post(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`, {}, { headers: crHeaders });
  const policy = getPolicy.data;
  policy.bindings = policy.bindings || [];
  for (const role of roles) {
    let b = policy.bindings.find((x: any) => x.role === role);
    if (!b) {
      b = { role, members: [] };
      policy.bindings.push(b);
    }

    const member = `serviceAccount:${saEmail}`;
    if (!b.members.includes(member)) b.members.push(member);
  }
  await axios.post(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`, { policy }, { headers: crHeaders });
  if (addLog) await addLog("Ensured IAM roles on project for deployer SA");

  // 3) Create a key for the SA
  const keyResp = await axios.post(`https://iam.googleapis.com/v1/${saName}/keys`, { keyAlgorithm: "KEY_ALG_RSA_2048", privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE" }, { headers });
  const privateKeyData = keyResp.data.privateKeyData; // base64
  const keyJson = Buffer.from(privateKeyData, "base64").toString("utf8");
  if (addLog) await addLog("Created service account key");

  return { email: saEmail, keyJson };
}

async function detectLanguageAndFramework(octokit: Octokit, owner: string, repo: string): Promise<DetectResult> {
  const details: any = {};
  let language: string | null = null;
  let framework: string | null = null;

  try {
    const langs = await octokit.repos.listLanguages({ owner, repo });
    details.languages = langs.data;
    // pick top language by bytes
    const entries = Object.entries(langs.data) as Array<[string, number]>;
    if (entries.length) {
      entries.sort((a, b) => b[1] - a[1]);
      language = entries[0][0];
    }
  } catch (e) {
    logger.warn("Failed to list languages", e as any);
  }

  // Try package.json
  try {
    const pkgResp = await octokit.repos.getContent({ owner, repo, path: "package.json" });
    // @ts-ignore
    if (pkgResp.data && (pkgResp.data as any).content) {
      // @ts-ignore
      const content = Buffer.from((pkgResp.data as any).content, "base64").toString("utf8");
      const pkg = JSON.parse(content);
      details.packageJson = pkg;
      if (!language) language = "JavaScript";
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps["next"]) framework = "Next.js";
      else if (deps["react"]) framework = "React";
      else if (deps["vue"]) framework = "Vue";
      else if (deps["@angular/core"]) framework = "Angular";
      else if (deps["svelte"]) framework = "Svelte";
    }
  } catch {}

  // Try Python
  if (!framework && !language) {
    try {
      await octokit.repos.getContent({ owner, repo, path: "requirements.txt" });
      language = "Python";
    } catch {}
  }

  // Try Go
  if (!framework && !language) {
    try {
      await octokit.repos.getContent({ owner, repo, path: "go.mod" });
      language = "Go";
    } catch {}
  }

  return { language, framework, details };
}

async function getRepoPublicKey(octokit: Octokit, owner: string, repo: string) {
  const { data } = await octokit.rest.actions.getRepoPublicKey({ owner, repo });
  return data; // { key, key_id }
}

function encryptSecret(publicKey: string, secretValue: string) {
  const messageBytes = Buffer.from(secretValue);
  const keyBytes = Buffer.from(publicKey, "base64");
  const encryptedBytes = sodium.seal(messageBytes, keyBytes);
  return Buffer.from(encryptedBytes).toString("base64");
}

async function upsertRepoSecret(octokit: Octokit, owner: string, repo: string, name: string, value: string) {
  const pub = await getRepoPublicKey(octokit, owner, repo);
  const encrypted_value = encryptSecret(pub.key, value);
  await octokit.rest.actions.createOrUpdateRepoSecret({
    owner,
    repo,
    secret_name: name,
    encrypted_value,
    key_id: pub.key_id,
  });
}

async function createOrUpdateFile(octokit: Octokit, params: {
  owner: string; repo: string; path: string; content: string; message: string; branch?: string;
}): Promise<{ changed: boolean; sha?: string; }> {
  const { owner, repo, path, content, message, branch } = params;
  let sha: string | undefined = undefined;
  let unchanged = false;
  try {
    const existing = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    // @ts-ignore
    const data: any = existing.data;
    sha = data.sha;
    if (data.content) {
      const current = Buffer.from(data.content, "base64").toString("utf8");
      if (current.trim() === content.trim()) {
        unchanged = true;
      }
    }
  } catch {}

  if (unchanged) {
    return { changed: false, sha };
  }
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString("base64"),
    sha,
    branch,
  });
  return { changed: true, sha };
}

// Best-effort: delete a file in the repo if it exists (used to force-refresh workflows)
async function deleteFileIfExists(octokit: Octokit, owner: string, repo: string, path: string, branch?: string) {
  try {
    const existing = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    // @ts-ignore
    const sha: string | undefined = (existing.data as any)?.sha;
    if (sha) {
      await octokit.repos.deleteFile({ owner, repo, path, message: `chore: remove ${path} for fresh regeneration via Devyntra`, sha, branch });
    }
  } catch {}
}

function analysisWorkflowYml(): string {
  return `name: Analyze Codebase
on:
  workflow_dispatch:
    inputs:
      deployment_id:
        description: 'Devyntra deployment id'
        required: false
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Notify Devyntra - Analyze start
        env:
          WEBHOOK_URL: ${'${{ secrets.DEVYNTRA_WEBHOOK_URL }}'}
          WEBHOOK_TOKEN: ${'${{ secrets.DEVYNTRA_WEBHOOK_TOKEN }}'}
          DEPLOYMENT_ID: ${'${{ github.event.inputs.deployment_id }}'}
        run: |
          PAYLOAD=$(cat <<EOF
          {
            "deploymentId": "$DEPLOYMENT_ID",
            "event": "progress",
            "step": "analyze",
            "message": "Analyze"
          }
          EOF
          )
          if [ -n "$WEBHOOK_URL" ] && [ -n "$WEBHOOK_TOKEN" ]; then
            curl -sS -X POST "$WEBHOOK_URL" \
              -H "Content-Type: application/json" \
              -H "X-Devyntra-Token: $WEBHOOK_TOKEN" \
              -d "$PAYLOAD" || true
          fi
      - name: Run Linters and Compilers
        id: run_analysis
        run: |
          set -e
          if [ -f package.json ]; then
            npm ci || npm install
            npx eslint . || true
            npx tsc -v >/dev/null 2>&1 && npx tsc --noEmit || true
          elif [ -f requirements.txt ]; then
            python -m pip install -r requirements.txt
            pip install pylint || true
            pylint $(git ls-files '*.py') || true
          elif [ -f go.mod ]; then
            go vet ./... || true
          fi
      - name: Notify Devyntra - Analyze complete
        if: always()
        env:
          WEBHOOK_URL: ${'${{ secrets.DEVYNTRA_WEBHOOK_URL }}'}
          WEBHOOK_TOKEN: ${'${{ secrets.DEVYNTRA_WEBHOOK_TOKEN }}'}
          DEPLOYMENT_ID: ${'${{ github.event.inputs.deployment_id }}'}
          JOB_STATUS: ${'${{ job.status }}'}
        run: |
          MESSAGE="Analysis failed"
          if [ "$JOB_STATUS" == "success" ]; then MESSAGE="Analyze complete"; fi
          PAYLOAD=$(cat <<EOF
          {
            "deploymentId": "$DEPLOYMENT_ID",
            "event": "progress",
            "step": "analyze",
            "message": "$MESSAGE"
          }
          EOF
          )
          if [ -n "$WEBHOOK_URL" ] && [ -n "$WEBHOOK_TOKEN" ]; then
            curl -sS -X POST "$WEBHOOK_URL" \
              -H "Content-Type: application/json" \
              -H "X-Devyntra-Token: $WEBHOOK_TOKEN" \
              -d "$PAYLOAD" || true
          fi
`;
}

function deployWorkflowYml(projectId: string, serviceName: string, region: string): string {
  const ghaSecret = '${{ secrets.GCP_SA_KEY }}';
  return `# Generated by Devyntra • workflow=v2-sse • do-not-edit
name: Deploy to Cloud Run
on:
  workflow_dispatch:
    inputs:
      deployment_id:
        description: 'Devyntra deployment id'
        required: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: 'read'
      id-token: 'write'
    steps:
      - uses: actions/checkout@v4
      - id: 'auth'
        uses: 'google-github-actions/auth@v2'
        with:
          credentials_json: ${ghaSecret}
      - uses: 'google-github-actions/setup-gcloud@v2'
      - name: Build and Deploy with Dockerfile
        env:
          PROJECT_ID: ${projectId}
          REGION: ${region}
          SERVICE: ${serviceName}
        run: |
          set -e
          gcloud config set project "$PROJECT_ID"
          # Ensure AR docker auth is configured
          gcloud auth configure-docker "$REGION-docker.pkg.dev" -q
          IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/$SERVICE:${'${{ github.sha }}'}"
          echo "Building $IMAGE"
          docker build -t "$IMAGE" .
          docker push "$IMAGE"
          gcloud run deploy "$SERVICE" \
            --region="$REGION" \
            --image="$IMAGE" \
            --allow-unauthenticated \
            --port=8080
      - name: Fetch Service URL
        id: fetch_url
        env:
          REGION: ${region}
          SERVICE: ${serviceName}
        run: |
          set -e
          URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)' 2>/dev/null || echo "")
          echo "Fetched URL: $URL"
          echo "SERVICE_URL=$URL" >> $GITHUB_OUTPUT
          echo "SERVICE_URL=$URL" >> $GITHUB_ENV
      - name: Notify Devyntra
        if: always()
        env:
          WEBHOOK_URL: ${'${{ secrets.DEVYNTRA_WEBHOOK_URL }}'}
          WEBHOOK_TOKEN: ${'${{ secrets.DEVYNTRA_WEBHOOK_TOKEN }}'}
          DEPLOYMENT_ID: ${'${{ github.event.inputs.deployment_id }}'}
          SERVICE_URL: ${'${{ steps.fetch_url.outputs.SERVICE_URL }}'}
        run: |
          STATUS="success"
          if [ "${'${{ job.status }}'}" != "success" ]; then STATUS="failure"; fi
          
          # Build JSON payload properly
          PAYLOAD=$(cat <<EOF
          {
            "deploymentId": "$DEPLOYMENT_ID",
            "status": "$STATUS",
            "deploymentUrl": "$SERVICE_URL",
            "message": "auto create ci/cd pipeline and deployed with docker using gcp"
          }
          EOF
          )
          
          echo "Webhook payload: $PAYLOAD"
          
          if [ -n "$WEBHOOK_URL" ] && [ -n "$WEBHOOK_TOKEN" ]; then
            curl -sS -X POST "$WEBHOOK_URL" \
              -H "Content-Type: application/json" \
              -H "X-Devyntra-Token: $WEBHOOK_TOKEN" \
              -d "$PAYLOAD" || true
          fi
# End Devyntra workflow v2-sse
`;
}

function defaultDockerfile(): string {
  return `# Multi-stage build for Vite/React or generic Node frontends
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

FROM nginx:alpine
# Serve on Cloud Run's 8080 port
RUN sed -i 's/80;/8080;/' /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
`;
}

function defaultDockerignore(): string {
  return `node_modules
npm-debug.log
Dockerfile*
.dockerignore
.git
.gitignore
dist
build
.DS_Store
`;
}

async function triggerWorkflowDispatch(octokit: Octokit, owner: string, repo: string, workflowFile: string | number, refBranch: string, inputs?: Record<string, string>) {
  await octokit.rest.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: workflowFile,
    ref: refBranch,
    inputs,
  });
}

// GitHub can take a few seconds to recognize newly-updated workflows and their triggers.
// Retry dispatch on 422 errors that mention missing workflow_dispatch.
async function dispatchWithRetry(
  octokit: Octokit,
  owner: string,
  repo: string,
  workflowFile: string,
  refBranch: string,
  inputs?: Record<string, string>,
  retries: number = 10,
  delayMs: number = 7000
): Promise<boolean> {
  let resolvedId: number | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      await triggerWorkflowDispatch(octokit, owner, repo, workflowFile, refBranch, inputs);
      return true;
    } catch (e: any) {
      const msg = String(e?.message || "").toLowerCase();
      const status = e?.status;
      // Treat common transient conditions as retryable; just wait and retry
      if (
        (status === 422 && (msg.includes("workflow does not have") || msg.includes("workflow_dispatch"))) ||
        status === 404 ||
        msg.includes("could not resolve") ||
        msg.includes("no ref found")
      ) {
        // Attempt to resolve numeric workflow ID and retry immediately once
        if (resolvedId === null) {
          try {
            const id = await resolveWorkflowId(octokit, owner, repo, workflowFile);
            if (typeof id === 'number') {
              resolvedId = id;
              try {
                await triggerWorkflowDispatch(octokit, owner, repo, id, refBranch, inputs);
                return true;
              } catch {}
            }
          } catch {}
        }
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return false;
}

// Resolve a workflow's numeric ID by path or name so we can dispatch using ID (more reliable in some cases)
async function resolveWorkflowId(octokit: Octokit, owner: string, repo: string, workflowFile: string): Promise<number | null> {
  try {
    const workflows = await octokit.rest.actions.listRepoWorkflows({ owner, repo, per_page: 100 });
    const target = workflows.data.workflows?.find(w => {
      const path = (w.path || '').toLowerCase();
      const name = (w.name || '').toLowerCase();
      const want = workflowFile.toLowerCase();
      return path.endsWith(`.github/workflows/${want}`) || path === want || name === want || name.includes('deploy to cloud run');
    });
    return target?.id ?? null;
  } catch {
    return null;
  }
}

async function waitForLatestWorkflowConclusion(
  octokit: Octokit,
  owner: string,
  repo: string,
  workflowFile: string,
  timeoutMs = 120000,
  
  onProgress?: (info: { runId: number; status: string; jobName?: string; jobStatus?: string; stepName?: string; stepStatus?: string }) => Promise<void> | void,
  shouldStop?: () => Promise<boolean> | boolean,
  sinceEpochMs?: number
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const runs = await octokit.rest.actions.listWorkflowRuns({ owner, repo, workflow_id: workflowFile, per_page: 20 });
      const items = runs.data.workflow_runs || [] as any[];
      // Prefer a run created after the provided timestamp (our dispatch time)
      const cutoff = (sinceEpochMs ?? 0) - 10_000; // allow small clock skew
      const candidate = items.find(r => {
        try { return new Date(r.created_at).getTime() >= cutoff; } catch { return false; }
      }) || items[0];
      const latest = candidate;
      if (!latest) return null;
      if (latest.status === 'completed') return latest.conclusion || null;
      if (shouldStop && (await shouldStop())) return null;
      if (onProgress) {
        try {
          const jobs = await octokit.rest.actions.listJobsForWorkflowRun({ owner, repo, run_id: latest.id });
          const running = jobs.data.jobs?.find(j => j.status === 'in_progress') || jobs.data.jobs?.find(j => j.status === 'queued') || jobs.data.jobs?.[0];
          let stepName: string | undefined;
          let stepStatus: string | undefined;
          if (running && Array.isArray(running.steps)) {
            const currentStep = running.steps.find((s: any) => s.status === 'in_progress') || running.steps.find((s: any) => s.status === 'queued') || running.steps.find((s: any) => s.conclusion === 'success') || running.steps?.[0];
            stepName = currentStep?.name;
            stepStatus = currentStep?.status || currentStep?.conclusion;
          }
          await onProgress({ runId: latest.id, status: latest.status || 'unknown', jobName: running?.name, jobStatus: running?.status, stepName, stepStatus });
        } catch {}
      }
    } catch {}
    await new Promise(r => setTimeout(r, 5000));
  }
  return null;
}

async function ensureWorkflowExists(octokit: Octokit, owner: string, repo: string, workflowFile: string, timeoutMs = 20000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const workflows = await octokit.rest.actions.listRepoWorkflows({ owner, repo, per_page: 100 });
      const exists = workflows.data.workflows?.some(w => w.path?.endsWith(`.github/workflows/${workflowFile}`) || w.path === workflowFile || w.name === workflowFile);
      if (exists) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 3000));
  }
  return false;
}

// Remove all workflow files except the two we manage
async function cleanupUnwantedWorkflows(octokit: Octokit, owner: string, repo: string, defaultBranch: string) {
  const allowed = new Set(["analysis.yml", "deploy-cloudrun.yml"]);
  try {
    const contents = await octokit.repos.getContent({ owner, repo, path: ".github/workflows", ref: defaultBranch });
    const items: any[] = Array.isArray(contents.data) ? contents.data as any[] : [];
    for (const item of items) {
      const name: string = item.name;
      const path: string = item.path;
      if (!allowed.has(name)) {
        try {
          const file = await octokit.repos.getContent({ owner, repo, path, ref: defaultBranch });
          // @ts-ignore
          const sha = (file.data as any).sha;
          await octokit.repos.deleteFile({ owner, repo, path, message: `chore: remove unrequired workflow ${name} via Devyntra`, sha, branch: defaultBranch });
        } catch (e) {
          logger.warn("Failed to delete workflow", { path, error: (e as any)?.message });
        }
      }
    }
  } catch {
    // workflows folder may not exist yet
  }
}

// Check if a recent workflow run exists to avoid duplicate dispatch
async function hasRecentRun(octokit: Octokit, owner: string, repo: string, workflowFile: string, withinMs = 120000): Promise<boolean> {
  try {
    const runs = await octokit.rest.actions.listWorkflowRuns({ owner, repo, workflow_id: workflowFile, per_page: 1 });
    const run = runs.data.workflow_runs?.[0];
    if (!run) return false;
    const created = new Date(run.created_at).getTime();
    return Date.now() - created < withinMs && (run.status === "in_progress" || run.status === "queued" || run.status === "requested");
  } catch {
    return false;
  }
}

export const deploy = onRequest({
  region: "us-central1",
  cors: true,
  timeoutSeconds: 540,
  memory: "1GiB",
}, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    if (!authHeader) {
      res.status(401).json({ error: "Missing Authorization header" });
      return;
    }

    const { repoOwner, repoName, githubToken } = req.body || {};
    if (!repoOwner || !repoName || !githubToken) {
      res.status(400).json({ error: "repoOwner, repoName, and githubToken are required" });
      return;
    }

    // Short-circuit special actions for Manage page
    if (req.body?.action === "redeploy") {
      const octokit = new Octokit({ auth: githubToken });
      const repoInfo = await octokit.repos.get({ owner: repoOwner, repo: repoName });
      const defaultBranch = repoInfo.data.default_branch || "main";
      // ensure workflow: delete then recreate fresh to avoid stale YAML
      const redeployProjectId = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
      const redeployRegion = process.env.CLOUD_RUN_REGION || "us-central1";
      const redeployService = `${repoName}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30) || "web-service";
      const branches = Array.from(new Set([defaultBranch, "main", "master"])) as string[];
      let wrote = false;
      for (const br of branches) {
        try {
          await deleteFileIfExists(octokit, repoOwner, repoName, ".github/workflows/deploy-cloudrun.yml", br);
        } catch {}
        try {
          await createOrUpdateFile(octokit, {
            owner: repoOwner,
            repo: repoName,
            path: ".github/workflows/deploy-cloudrun.yml",
            content: deployWorkflowYml(redeployProjectId || "", redeployService, redeployRegion),
            message: "chore: ensure Cloud Run deploy workflow via Devyntra (redeploy)",
            branch: br,
          });
          // Verify content contains v2-sse header
          try {
            const verify = await octokit.repos.getContent({ owner: repoOwner, repo: repoName, path: ".github/workflows/deploy-cloudrun.yml", ref: br });
            // @ts-ignore
            const vf = verify.data as any;
            const body = vf?.content ? Buffer.from(vf.content, "base64").toString("utf8") : "";
            if (body.includes("workflow=v2-sse")) { wrote = true; break; }
          } catch {}
        } catch {}
      }
      if (!wrote) throw new Error("Failed to write SSE workflow onto any common branch (main/master/default). Check repo permissions.");
      // Give GitHub time to index the updated workflow and ensure it's visible
      await new Promise(r => setTimeout(r, 5000));
      const exists = await ensureWorkflowExists(octokit, repoOwner, repoName, "deploy-cloudrun.yml", 60000);
      if (!exists) {
        throw new Error("GitHub did not index deploy-cloudrun.yml in time. Please retry in a few seconds.");
      }
      // Give a bit more time for GitHub to register workflow_dispatch trigger
      await new Promise(r => setTimeout(r, 5000));
      // Ensure workflow is enabled before dispatch
      await ensureWorkflowEnabled(octokit, repoOwner, repoName, "deploy-cloudrun.yml");
      const ok = await dispatchWithRetry(octokit, repoOwner, repoName, ".github/workflows/deploy-cloudrun.yml", defaultBranch, undefined, 10, 7000);
      if (!ok) {
        throw new Error("GitHub did not accept workflow_dispatch for deploy-cloudrun.yml. Wait and retry.");
      }
      res.json({ ok: true, actionsUrl: `https://github.com/${repoOwner}/${repoName}/actions/workflows/deploy-cloudrun.yml` });
      return;
    }

    if (req.body?.action === "rollback") {
      const projectId = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
      const region = String(req.body?.region || process.env.CLOUD_RUN_REGION || "us-central1");
      const serviceName = String(req.body?.serviceName || `${repoName}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30) || "web-service");
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const listUrl = `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/services/${serviceName}/revisions`;
      const list = await axios.get(listUrl, { headers });
      const revisions: any[] = list.data?.revisions || list.data?.items || [];
      if (revisions.length < 2) {
        res.status(400).json({ error: "Not enough revisions to rollback" });
        return;
      }
      const previousRevision = revisions[1].name || revisions[1]?.metadata?.name;
      const patchUrl = `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/services/${serviceName}`;
      await axios.patch(patchUrl, { traffic: [{ type: "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION", revision: previousRevision.split('/').pop(), percent: 100 }] }, { headers });
      const svc = await axios.get(patchUrl, { headers });
      res.json({ ok: true, deploymentUrl: svc.data?.uri || null, revision: previousRevision });
      return;
    }

    if (req.body?.action === "delete_service") {
      const projectId = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
      const region = String(req.body?.region || process.env.CLOUD_RUN_REGION || "us-central1");
      const serviceName = String(req.body?.serviceName || `${repoName}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30) || "web-service");
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      // Attempt fetch URL before deletion (non-fatal)
      let svcUrl: string | null = null;
      try {
        const getUrl = `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/services/${serviceName}`;
        const svc = await axios.get(getUrl, { headers });
        svcUrl = svc.data?.uri || null;
      } catch {}
      const delUrl = `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/services/${serviceName}`;
      await axios.delete(delUrl, { headers });
      res.json({ ok: true, deleted: true, serviceName, region, previousUrl: svcUrl });
      return;
    }

    // Verify Firebase ID token and get userId for Firestore document
    const idToken = (Array.isArray(authHeader) ? authHeader[0] : authHeader).replace(/^Bearer\s+/i, "");
    let userId = "unknown";
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      userId = decoded.uid;
    } catch (e) {
      logger.warn("Failed to verify ID token", e as any);
    }

    // Create deployment doc
    const deploymentRef = db.collection("deployments").doc();
    const deploymentId = deploymentRef.id;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const setStatus = async (
      status: "starting" | "injecting_secrets" | "detecting_language" | "analyzing" | "fixing" | "deploying" | "deployed" | "failed",
      message: string,
      extra: Record<string, any> = {}
    ) => {
      await deploymentRef.set(
        {
          userId,
          repoOwner,
          repoName,
          repoId: `${repoOwner}/${repoName}`,
          status,
          message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...extra,
        },
        { merge: true }
      );
    };

    const addLog = async (line: string) => {
      await deploymentRef.set({
        logs: admin.firestore.FieldValue.arrayUnion(line),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    };

    // cancellation helper (scoped to this deployment)
    const isCancelled = async (): Promise<boolean> => {
      const snap = await deploymentRef.get();
      const data = snap.data() as any;
      return !!data?.cancelled;
    };

    await deploymentRef.set({
      id: deploymentId,
      userId,
      repoOwner,
      repoName,
      repoId: `${repoOwner}/${repoName}`,
      status: "starting",
      message: "Deployment initiated",
      logs: [],
      errors: [],
      createdAt: now,
      updatedAt: now,
    });

    const octokit = new Octokit({ auth: githubToken });

    // Validate repo access and get default branch
    const repoInfo = await octokit.repos.get({ owner: repoOwner, repo: repoName });
    const defaultBranch = repoInfo.data.default_branch || "main";

    // 1) Inject secrets + Detect language & framework
    await setStatus("injecting_secrets", "Injecting required GitHub secrets...");
    await addLog("🔐 Injecting required GitHub secrets...");

    // 2) Ensure required secrets in repo
    const projectId = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
    let gcpSaKey = process.env.GCP_SA_KEY || (projectId ? await accessSecret(projectId, "GCP_SA_KEY") : null) || undefined;
    let webhookUrl = process.env.DEVYNTRA_WEBHOOK_URL || (projectId ? (await accessSecret(projectId, "DEVYNTRA_WEBHOOK_URL")) || "" : "");
    if (!projectId || !gcpSaKey) {
      logger.warn("Missing projectId or GCP_SA_KEY in env; CI/CD may fail.");
    }
    // Bootstrap if GCP_SA_KEY is missing: auto-create SA + key and use it
    if (!gcpSaKey && projectId) {
      await setStatus("injecting_secrets", "Creating deployer service account and key...");
      const { keyJson } = await ensureDeployerServiceAccount(projectId, addLog);
      gcpSaKey = keyJson;
    }

    if (projectId) await upsertRepoSecret(octokit, repoOwner, repoName, "FIREBASE_PROJECT_ID", projectId);
    if (gcpSaKey) await upsertRepoSecret(octokit, repoOwner, repoName, "GCP_SA_KEY", gcpSaKey);
    const regionVal = process.env.CLOUD_RUN_REGION || (projectId ? (await accessSecret(projectId, "CLOUD_RUN_REGION")) || "us-central1" : "us-central1");
    await upsertRepoSecret(octokit, repoOwner, repoName, "CLOUD_RUN_REGION", regionVal);
    const computedService = `${repoName}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30) || "web-service";
    await upsertRepoSecret(octokit, repoOwner, repoName, "DEVYNTRA_SERVICE_NAME", computedService);
    // Normalize variable names used later in deploy section
    const regionNorm = regionVal;
    const serviceNameNorm = computedService;
    if (!webhookUrl && projectId) {
      // Try to auto-resolve our deployWebhook function URL and use that
      try {
        const maybe = await resolveFunctionUrl(projectId, "us-central1", "deployWebhook");
        if (maybe) webhookUrl = maybe;
      } catch {}
    }
    let webhookToken = process.env.DEVYNTRA_WEBHOOK_TOKEN || (projectId ? (await accessSecret(projectId, "DEVYNTRA_WEBHOOK_TOKEN")) || "" : "");
    if (!webhookToken && projectId) {
      try {
        webhookToken = crypto.randomBytes(24).toString('hex');
        await ensureSecret(projectId, "DEVYNTRA_WEBHOOK_TOKEN", webhookToken);
      } catch {}
    }
    // Update status and notify frontend that setup (secrets injection) is complete
    await deploymentRef.set({ 
      status: 'detecting_language',
      message: 'Setup complete',
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    }, { merge: true });
    await notifyProgress(webhookUrl, webhookToken, { deploymentId, event: "progress", step: "setup", message: "Setup complete" });
    if (webhookUrl) await upsertRepoSecret(octokit, repoOwner, repoName, "DEVYNTRA_WEBHOOK_URL", webhookUrl);
    if (webhookToken) await upsertRepoSecret(octokit, repoOwner, repoName, "DEVYNTRA_WEBHOOK_TOKEN", webhookToken);
    await upsertRepoSecret(octokit, repoOwner, repoName, "NODE_ENV", "production");

    await setStatus("detecting_language", "Detecting language and framework...");
    await addLog("🔍 Detecting language and framework...");
    const detect = await detectLanguageAndFramework(octokit, repoOwner, repoName);
    await deploymentRef.set({ language: detect.language || null, framework: detect.framework || null }, { merge: true });
    await addLog(`✅ Detected ${detect.language || 'Unknown'}${detect.framework ? ' • '+detect.framework : ''}`);

    // 3) Create/Update Analysis workflow and trigger
    const analysisPath = ".github/workflows/analysis.yml";
    await createOrUpdateFile(octokit, {
      owner: repoOwner,
      repo: repoName,
      path: analysisPath,
      content: analysisWorkflowYml(),
      message: "chore: add analysis workflow via Devyntra",
      branch: defaultBranch,
    });
    // Cleanup any other workflows, keeping only required ones
    await cleanupUnwantedWorkflows(octokit, repoOwner, repoName, defaultBranch);
    // Wait for GitHub to index the workflow, then dispatch
    await new Promise(r => setTimeout(r, 5000));
    const analysisReady = await ensureWorkflowExists(octokit, repoOwner, repoName, "analysis.yml", 30000);
    if (!analysisReady) {
      throw new Error("analysis.yml not detected by GitHub yet; try again shortly");
    }
    let analysisDispatchAt: number | undefined = undefined;
    if (!(await hasRecentRun(octokit, repoOwner, repoName, "analysis.yml"))) {
      analysisDispatchAt = Date.now();
      const ok = await dispatchWithRetry(octokit, repoOwner, repoName, ".github/workflows/analysis.yml", defaultBranch, { deployment_id: deploymentId });
      if (!ok) throw new Error("GitHub did not accept workflow_dispatch for analysis.yml. Wait and retry.");
    }

    await setStatus("analyzing", "Running code analysis workflow...");
    await addLog("🔎 Running code analysis workflow...");
    let analysisConclusion = await waitForLatestWorkflowConclusion(
      octokit,
      repoOwner,
      repoName,
      "analysis.yml",
      4 * 60_000,
      async (info) => {
        const rawStep = info.stepName || info.jobName || "";
        const step = rawStep.toLowerCase();
        let sub = "pipeline";
        if (step.includes("build")) sub = "build_image";
        else if (step.includes("push")) sub = "push_image";
        else if (step.includes("deploy")) sub = "deploy";
        else if (step.includes("fetch service url")) sub = "fetch_url";
        const st = (info.stepStatus || info.jobStatus || info.status || "").toLowerCase();
        await deploymentRef.set({
          status: "analyzing",
          deploySubstep: sub,
          message: `Analysis: ${rawStep} (${st || 'in_progress'})`,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        // Append a terminal-like line occasionally
        try {
          if (rawStep) await addLog(`➤ ${rawStep} — ${st || 'in_progress'}`);
        } catch {}
      },
      async () => await isCancelled(),
      analysisDispatchAt
    );
    let errorsFound = analysisConclusion === "failure";
    await addLog(`📊 Analysis result: ${analysisConclusion || 'unknown'}`);
    if (await isCancelled()) {
      await setStatus("failed", "Deployment cancelled");
      await addLog("🛑 Deployment cancelled by client.");
      res.json({ deploymentId });
      return;
    }

    // Update status and notify analysis completion regardless of outcome
    await deploymentRef.set({ 
      status: errorsFound ? 'fixing' : 'deploying',
      message: 'Analyze complete',
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    }, { merge: true });
    await notifyProgress(webhookUrl, webhookToken, { deploymentId, event: "progress", step: "analyze", message: "Analyze complete" });
    
    // Add small delay to ensure frontend processes analysis completion first
    await new Promise(r => setTimeout(r, 500));
    
    if (!errorsFound) {
      // Notify that Fix Issues stage is reached even if there are none
      await notifyProgress(webhookUrl, webhookToken, { deploymentId, event: "progress", step: "fix", message: "Fix Issues" });
      // small delay to preserve ordering client-side
      await new Promise(r => setTimeout(r, 200));
      await deploymentRef.set({ 
        status: 'deploying',
        message: 'No issues found',
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      }, { merge: true });
      await notifyProgress(webhookUrl, webhookToken, { deploymentId, event: "progress", step: "fix", message: "No issues found" });
    }

    // 4) If errors, call Jules API to fix and auto-merge (retry loop)
    if (errorsFound) {
      const julesUrl = process.env.JULES_API_URL || (projectId ? await accessSecret(projectId, "JULES_API_URL") : null);
      const julesKey = process.env.JULES_API_KEY || (projectId ? await accessSecret(projectId, "JULES_API_KEY") : null);
      let attempts = 0;
      let usedJules = false;
      while (errorsFound && julesUrl && julesKey && attempts < 2) {
        attempts++;
        try {
          await setStatus("fixing", attempts === 1 ? "Errors found. Sending to Jules for auto-fix..." : "Errors persist. Re-running Jules fix...");
          await notifyProgress(webhookUrl, webhookToken, { deploymentId, event: "progress", step: "fix", message: "Fix Issues" });
          await addLog(attempts === 1 ? "🛠️ Jules auto-fix: attempting to fix errors..." : "🛠️ Jules auto-fix: second attempt...");
          usedJules = true;

          // Best-effort: get latest analysis run and failing job names for context
          let errorSummary: string | undefined;
          try {
            const runs = await octokit.rest.actions.listWorkflowRuns({ owner: repoOwner, repo: repoName, workflow_id: "analysis.yml", per_page: 1 });
            const latestRun = runs.data.workflow_runs?.[0];
            if (latestRun) {
              const jobs = await octokit.rest.actions.listJobsForWorkflowRun({ owner: repoOwner, repo: repoName, run_id: latestRun.id });
              const failing = jobs.data.jobs?.filter(j => j.conclusion === 'failure' || j.conclusion === 'cancelled' || j.conclusion === 'timed_out');
              if (failing && failing.length) {
                const names = failing.map(j => j.name).slice(0, 5).join(', ');
                errorSummary = `Failing jobs: ${names}`;
              }
            }
          } catch {}

          const julesReq: any = {
            owner: repoOwner,
            repo: repoName,
            language: detect.language,
            framework: detect.framework,
            task: 'fix_build_run_errors',
            errorSummary,
            guidelines: 'Make minimal, safe changes to fix syntax/compile/runtime errors blocking build and start on port 8080. Prefer updating Dockerfile, scripts, and small code edits only.'
          };
          const julesResp = await axios.post(julesUrl, julesReq, { headers: { Authorization: `Bearer ${julesKey}` } });
          const sessionUrl = julesResp.data?.sessionUrl || julesResp.data?.url || null;
          const prUrl = julesResp.data?.prUrl || julesResp.data?.pullRequestUrl || null;
          await deploymentRef.set({ julesSessionUrl: sessionUrl || null, prUrl: prUrl || null }, { merge: true });
          if (sessionUrl) await addLog(`🔗 Jules session: ${sessionUrl}`);
          if (prUrl) await addLog(`🔀 PR created: ${prUrl}`);

          // Give Jules a moment to push changes/PR
          await new Promise(r => setTimeout(r, 10000));

          // Re-run analysis
          await setStatus("analyzing", "Re-running analysis after Jules fixes...");
          await addLog("🔁 Re-running analysis after Jules fixes...");
          {
            const ok = await dispatchWithRetry(octokit, repoOwner, repoName, ".github/workflows/analysis.yml", defaultBranch, { deployment_id: deploymentId });
            if (!ok) throw new Error("GitHub did not accept workflow_dispatch for analysis.yml after fixes.");
          }
          analysisConclusion = await waitForLatestWorkflowConclusion(
            octokit,
            repoOwner,
            repoName,
            "analysis.yml",
            4 * 60_000,
            undefined,
            async () => await isCancelled(),
            Date.now()
          );
          errorsFound = analysisConclusion === "failure";
          await addLog(`📊 Analysis result: ${analysisConclusion || 'unknown'}`);
          if (await isCancelled()) throw new Error("cancelled");
        } catch (e) {
          logger.warn("Jules auto-fix pass failed", e as any);
          await addLog("⚠️ Jules auto-fix failed to complete.");
          break;
        }
      }
      if (errorsFound) {
        await setStatus("failed", "Analysis failed after auto-fix attempts. Please check logs.");
        await addLog("❌ Analysis failed after auto-fix attempts.");
        res.json({ deploymentId });
        return;
      }
      // If we reached here with no errors, Jules fixed the issues successfully
      if (usedJules) {
        await deploymentRef.set({ 
          status: 'deploying',
          message: 'Fix Issues complete with jules',
          updatedAt: admin.firestore.FieldValue.serverTimestamp() 
        }, { merge: true });
        await notifyProgress(webhookUrl, webhookToken, { deploymentId, event: "progress", step: "fix", message: "Fix Issues complete with jules" });
      }
    }

    // Ensure JULES secrets are also present in the repo for workflows, if available
    const julesUrlForRepo = process.env.JULES_API_URL || (projectId ? await accessSecret(projectId, "JULES_API_URL") : null);
    const julesKeyForRepo = process.env.JULES_API_KEY || (projectId ? await accessSecret(projectId, "JULES_API_KEY") : null);
    if (julesUrlForRepo) await upsertRepoSecret(octokit, repoOwner, repoName, "JULES_API_URL", julesUrlForRepo);
    if (julesKeyForRepo) await upsertRepoSecret(octokit, repoOwner, repoName, "JULES_API_KEY", julesKeyForRepo);

    // 5) Ensure Dockerfile and .dockerignore present for Docker-based deploys
    try {
      await octokit.repos.getContent({ owner: repoOwner, repo: repoName, path: "Dockerfile", ref: defaultBranch });
    } catch {
      await createOrUpdateFile(octokit, {
        owner: repoOwner,
        repo: repoName,
        path: "Dockerfile",
        content: defaultDockerfile(),
        message: "chore: add Dockerfile for Cloud Run via Devyntra",
        branch: defaultBranch,
      });
    }
    try {
      await octokit.repos.getContent({ owner: repoOwner, repo: repoName, path: ".dockerignore", ref: defaultBranch });
    } catch {
      await createOrUpdateFile(octokit, {
        owner: repoOwner,
        repo: repoName,
        path: ".dockerignore",
        content: defaultDockerignore(),
        message: "chore: add .dockerignore via Devyntra",
        branch: defaultBranch,
      });
    }

    // 6) Create CI/CD workflow for Cloud Run
    const region = process.env.CLOUD_RUN_REGION || "us-central1";
    const serviceName = `${repoName}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30) || "web-service";
    const deployPath = ".github/workflows/deploy-cloudrun.yml";
    // Delete any existing workflow then recreate from template, across common branches
    const branches = Array.from(new Set([defaultBranch, "main", "master"])) as string[];
    let wrote = false;
    for (const br of branches) {
      try { await deleteFileIfExists(octokit, repoOwner, repoName, deployPath, br); } catch {}
      try {
        await createOrUpdateFile(octokit, {
          owner: repoOwner,
          repo: repoName,
          path: deployPath,
          content: deployWorkflowYml(projectId || "", serviceName, region),
          message: "chore: add Cloud Run deploy workflow via Devyntra",
          branch: br,
        });
        // Verify written content is SSE version
        try {
          const verify = await octokit.repos.getContent({ owner: repoOwner, repo: repoName, path: deployPath, ref: br });
          // @ts-ignore
          const vf = verify.data as any;
          const body = vf?.content ? Buffer.from(vf.content, "base64").toString("utf8") : "";
          if (body.includes("workflow=v2-sse")) { wrote = true; break; }
        } catch {}
      } catch {}
    }
    if (!wrote) throw new Error("Failed to write SSE workflow onto any common branch (main/master/default). Check repo permissions.");

    // Optionally trigger deploy workflow now
    await new Promise(r => setTimeout(r, 5000));
    const deployReady = await ensureWorkflowExists(octokit, repoOwner, repoName, "deploy-cloudrun.yml", 60000);
    if (!deployReady) {
      throw new Error("deploy-cloudrun.yml not detected by GitHub yet; try again shortly");
    }
    await setStatus("deploying", "Starting Cloud Run deployment workflow...");
    await addLog("🚀 Starting deployment to Google Cloud Run...");
    await deploymentRef.set({ deploySubstep: 'pipeline', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    let deployDispatchAt: number | undefined = undefined;
    if (!(await hasRecentRun(octokit, repoOwner, repoName, "deploy-cloudrun.yml"))) {
      // Extra wait to allow GitHub to fully register the workflow triggers before dispatch
      await new Promise(r => setTimeout(r, 5000));
      // Ensure workflow is enabled before dispatch
      await ensureWorkflowEnabled(octokit, repoOwner, repoName, "deploy-cloudrun.yml");
        deployDispatchAt = Date.now();
        const ok = await dispatchWithRetry(octokit, repoOwner, repoName, ".github/workflows/deploy-cloudrun.yml", defaultBranch, { deployment_id: deploymentId });
      if (!ok) throw new Error("GitHub did not accept workflow_dispatch for deploy-cloudrun.yml. Wait and retry.");
    }

    // Prefer webhook completion when URL+token are available; else poll for a few minutes
    

    // Otherwise, wait for GitHub Actions deploy workflow to complete and update status accordingly
    const deployConclusion = await waitForLatestWorkflowConclusion(
      octokit,
      repoOwner,
      repoName,
      "deploy-cloudrun.yml",
      5 * 60_000,
      async ({ jobName, stepName }) => {
        // Map common job names to substeps
        const name = (stepName || jobName || '').toLowerCase();
        let sub: 'pipeline' | 'install' | 'build_image' | 'deploy' | undefined;
        if (name.includes('checkout') || name.includes('authenticate') || name.includes('set up gcloud') || name.includes('configure artifact')) sub = 'pipeline';
        else if (name.includes('install')) sub = 'install';
        else if (name.includes('build docker image') || name.includes('push docker image') || name.includes('docker')) sub = 'build_image';
        else if (name.includes('deploy to cloud run') || name === 'deploy') sub = 'deploy';
        if (sub) {
          await deploymentRef.set({ deploySubstep: sub, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
        const label = stepName || jobName;
        if (label) {
          await addLog(`⚙️ GitHub Actions: ${label}`);
          await deploymentRef.set({ message: `Running: ${label}`, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
      },
      async () => await isCancelled(),
      deployDispatchAt
    );
    if (await isCancelled()) {
      await setStatus("failed", "Deployment cancelled");
      await addLog("🛑 Deployment cancelled by client.");
      res.json({ deploymentId });
      return;
    }
    if (deployConclusion === "success") {
      // Try to fetch Cloud Run service URL
      let deploymentUrl: string | undefined;
      try {
        const token = await getAccessToken();
        const svcUrl = `https://run.googleapis.com/v2/projects/${projectId}/locations/${regionNorm}/services/${serviceNameNorm}`;
        const { data } = await axios.get(svcUrl, { headers: { Authorization: `Bearer ${token}` } });
        deploymentUrl = data?.uri;
      } catch {}
      await setStatus("deployed", "Deployment completed successfully", {
        deploymentUrl: deploymentUrl || null,
        cloudRunServiceName: serviceNameNorm,
      });
      await addLog("✅ Deployment completed successfully.");
      if (deploymentUrl) await addLog(`🌐 Service URL: ${deploymentUrl}`);
      await notifyProgress(webhookUrl, webhookToken, { deploymentId, event: "progress", step: "deploy", message: "auto create ci/cd pipeline and deployed with docker using gcp" });
    } else if (deployConclusion === "failure") {
      await setStatus("failed", "Deployment workflow failed");
      await addLog("❌ Deployment workflow failed.");
    } else {
      // Timed out waiting, but workflow may still be running.
      // Keep polling in short chunks within Function timeout to continue updating Firestore.
      await addLog("⏱️ Still deploying on GitHub Actions. Continuing to monitor...");
      const chunkUntil = Date.now() + 3 * 60_000; // up to ~3 more minutes within overall 9-min function timeout
      let concluded: string | null = null;
      while (Date.now() < chunkUntil) {
        concluded = await waitForLatestWorkflowConclusion(
          octokit,
          repoOwner,
          repoName,
          "deploy-cloudrun.yml",
          60_000,
          async ({ jobName, stepName }) => {
            const name = (stepName || jobName || '').toLowerCase();
            let sub: 'pipeline' | 'install' | 'build_image' | 'deploy' | undefined;
            if (name.includes('checkout') || name.includes('authenticate') || name.includes('set up gcloud') || name.includes('configure artifact')) sub = 'pipeline';
            else if (name.includes('install')) sub = 'install';
            else if (name.includes('build docker image') || name.includes('push docker image') || name.includes('docker')) sub = 'build_image';
            else if (name.includes('deploy to cloud run') || name === 'deploy') sub = 'deploy';
            if (sub) await deploymentRef.set({ deploySubstep: sub, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            const label = stepName || jobName;
            if (label) {
              await deploymentRef.set({ message: `Running: ${label}`, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
          },
          async () => await isCancelled(),
          deployDispatchAt
        );
        if (concluded === 'success' || concluded === 'failure') break;
      }
      if (await isCancelled()) {
        await setStatus("failed", "Deployment cancelled");
        await addLog("🛑 Deployment cancelled by client.");
        res.json({ deploymentId });
        return;
      }
      if (concluded === 'success') {
        let deploymentUrl: string | undefined;
        try {
          const token = await getAccessToken();
          const svcUrl = `https://run.googleapis.com/v2/projects/${projectId}/locations/${regionNorm}/services/${serviceNameNorm}`;
          const { data } = await axios.get(svcUrl, { headers: { Authorization: `Bearer ${token}` } });
          deploymentUrl = data?.uri;
        } catch {}
        await setStatus("deployed", "Deployment completed successfully", {
          deploymentUrl: deploymentUrl || null,
          cloudRunServiceName: serviceNameNorm,
        });
        await addLog("✅ Deployment completed successfully.");
        if (deploymentUrl) await addLog(`🌐 Service URL: ${deploymentUrl}`);
        await notifyProgress(webhookUrl, webhookToken, { deploymentId, event: "progress", step: "deploy", message: "auto create ci/cd pipeline and deployed with docker using gcp" });
      } else if (concluded === 'failure') {
        await setStatus("failed", "Deployment workflow failed");
        await addLog("❌ Deployment workflow failed.");
      } else {
        // Still running beyond our window; try to probe Cloud Run for service URL
        try {
          const token = await getAccessToken();
          const svcUrl = `https://run.googleapis.com/v2/projects/${projectId}/locations/${regionNorm}/services/${serviceNameNorm}`;
          const { data } = await axios.get(svcUrl, { headers: { Authorization: `Bearer ${token}` } });
          const found = data?.uri;
          if (found) {
            await setStatus("deployed", "Deployment completed successfully", {
              deploymentUrl: found,
              cloudRunServiceName: serviceNameNorm,
            });
            await addLog("✅ Deployment completed successfully (probed).");
            await addLog(`🌐 Service URL: ${found}`);
            await notifyProgress(webhookUrl, webhookToken, { deploymentId, event: "progress", step: "deploy", message: "auto create ci/cd pipeline and deployed with docker using gcp" });
            res.json({ deploymentId });
            return;
          }
        } catch {}
        // No URL yet, respond; UI will keep showing deploying until webhook updates Firestore
        res.json({ deploymentId });
        return;
      }
    }

    // Return deployment id to the client for realtime updates
    res.json({ deploymentId });
  } catch (error: any) {
    logger.error("Deploy workflow failed", error);
    try {
      await db.collection("deployments").add({
        status: "failed",
        message: error?.message || "Internal error",
        errors: [String(error?.stack || error)],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch {}
    res.status(500).json({ error: error?.message || "Internal error" });
  }
});

// Server-Sent Events stream to push deployment updates in realtime without polling/webhook
export const deployStream = onRequest({
  region: "us-central1",
  cors: true,
  timeoutSeconds: 900, // 15 minutes window
}, async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const deploymentId = (req.query.deploymentId || req.query.id) as string | undefined;
    if (!deploymentId) {
      res.status(400).json({ error: "deploymentId is required" });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // flush headers if available
    // @ts-ignore
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const docRef = db.collection("deployments").doc(deploymentId);
    let keepRunning = true;
    req.on("close", () => { keepRunning = false; });

    let lastJson = "";
    const start = Date.now();
    const maxMs = 15 * 60 * 1000;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // helper to send an SSE message
    const send = (payload: any) => {
      const data = JSON.stringify(payload);
      res.write(`data: ${data}\n\n`);
    };
    // heartbeat
    const ping = () => res.write(`: ping ${Date.now()}\n\n`);

    // Send initial ping
    ping();

    while (keepRunning && Date.now() - start < maxMs) {
      try {
        const snap = await docRef.get();
        if (snap.exists) {
          const data = snap.data() || {};
          const slim: any = {
            id: data.id,
            status: data.status,
            message: data.message,
            deploySubstep: data.deploySubstep,
            deploymentUrl: data.deploymentUrl || null,
          };
          // include only last few logs to keep payloads small
          if (Array.isArray(data.logs) && data.logs.length) {
            slim.logs = data.logs.slice(-10);
          }
          const j = JSON.stringify(slim);
          if (j !== lastJson) {
            lastJson = j;
            send(slim);
          }
          if (data.status === 'deployed' || data.status === 'failed' || data.status === 'cancelled') {
            break;
          }
        } else {
          // If doc missing, emit minimal and continue
          send({ id: deploymentId, status: 'unknown' });
        }
      } catch {}
      // heartbeat every cycle
      ping();
      await sleep(2000);
    }

    // finalize
    res.write("event: end\n");
    res.write("data: {\"done\":true}\n\n");
    res.end();
  } catch (e: any) {
    // In case of error, send an SSE error and close
    try {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: e?.message || 'internal error' })}\n\n`);
    } catch {}
    try { res.end(); } catch {}
  }
});

export const deployWebhook = onRequest({
  region: "us-central1",
  cors: true,
  timeoutSeconds: 60,
}, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const tokenHdr = (req.headers["x-devyntra-token"] || req.headers["X-Devyntra-Token"]) as string | string[] | undefined;
    const token = Array.isArray(tokenHdr) ? tokenHdr[0] : tokenHdr || "";
    const projectId = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
    const expected = process.env.DEVYNTRA_WEBHOOK_TOKEN || (projectId ? (await accessSecret(projectId, "DEVYNTRA_WEBHOOK_TOKEN")) || "" : "");
    if (expected && token !== expected) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { deploymentId, status, deploymentUrl, event, message, step } = req.body || {};
    if (!deploymentId || (!status && !event && !message)) {
      res.status(400).json({ error: "deploymentId and one of status/event/message is required" });
      return;
    }

    const ref = db.collection("deployments").doc(String(deploymentId));
    
    logger.info(`Webhook received: deploymentId=${deploymentId}, status=${status}, event=${event}, message=${message}, deploymentUrl=${deploymentUrl}`);
    
    // Handle terminal statuses from CI (success/failure)
    if (status === "success" || status === "failure") {
      const update: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (deploymentUrl) {
        update.deploymentUrl = deploymentUrl;
        logger.info(`Setting deployment URL: ${deploymentUrl}`);
      }
      if (status === "success") {
        update.status = "deployed";
        update.message = message || "Deployment completed via webhook";
      } else if (status === "failure") {
        update.status = "failed";
        update.message = message || "Deployment failed via webhook";
      }
      logger.info(`Updating deployment ${deploymentId} with:`, update);
      await ref.set(update, { merge: true });
      await ref.set({ logs: admin.firestore.FieldValue.arrayUnion(`🔔 Webhook: ${status}${deploymentUrl ? ` • ${deploymentUrl}` : ''}`) }, { merge: true });
      res.json({ ok: true });
      return;
    }

    // Handle progress events from backend/CI
    if (event === "progress" || message) {
      const update: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (message) update.message = message;
      if (step) update.lastStep = step;
      await ref.set(update, { merge: true });
      if (message) await ref.set({ logs: admin.firestore.FieldValue.arrayUnion(`🔔 ${message}`) }, { merge: true });
      res.json({ ok: true });
      return;
    }

    res.json({ ok: true });
  } catch (e: any) {
    logger.error("Webhook error", e);
    res.status(500).json({ error: e?.message || "Internal error" });
  }
});