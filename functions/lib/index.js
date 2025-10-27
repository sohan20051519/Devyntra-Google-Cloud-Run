"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deploy = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const rest_1 = require("@octokit/rest");
const axios_1 = require("axios");
const sodium = require("tweetsodium");
const admin = require("firebase-admin");
// Initialize Admin SDK once
try {
    if (!admin.apps.length) {
        admin.initializeApp();
    }
}
catch { }
const db = admin.firestore();
// Access Secret Manager without Firebase bindings
async function accessSecret(projectId, name) {
    try {
        const token = await getAccessToken();
        const url = `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${name}/versions/latest:access`;
        const { data } = await axios_1.default.get(url, { headers: { Authorization: `Bearer ${token}` } });
        const payload = data?.payload?.data;
        if (!payload)
            return null;
        return Buffer.from(payload, 'base64').toString('utf8');
    }
    catch {
        return null;
    }
}
// Helpers to call Google APIs with the Function's service account
async function getAccessToken() {
    try {
        const resp = await axios_1.default.get("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
            headers: { "Metadata-Flavor": "Google" },
            timeout: 2000,
        });
        return resp.data.access_token;
    }
    catch (e) {
        logger.warn("Failed to fetch metadata access token", e);
        throw new Error("Missing GCP credentials to bootstrap service account");
    }
}
async function ensureDeployerServiceAccount(projectId, addLog) {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };
    const saId = "devyntra-deployer";
    const saName = `projects/${projectId}/serviceAccounts/${saId}@${projectId}.iam.gserviceaccount.com`;
    const saEmail = `${saId}@${projectId}.iam.gserviceaccount.com`;
    // 1) Ensure service account exists
    try {
        await axios_1.default.get(`https://iam.googleapis.com/v1/${saName}`, { headers });
    }
    catch {
        await axios_1.default.post(`https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`, {
            accountId: saId,
            serviceAccount: { displayName: "Devyntra Cloud Run Deployer" },
        }, { headers });
        if (addLog)
            await addLog(`Created service account ${saEmail}`);
    }
    // 2) Bind required roles on project IAM policy if missing
    const roles = [
        "roles/run.admin",
        "roles/iam.serviceAccountUser",
        "roles/artifactregistry.reader",
        "roles/storage.admin",
    ];
    const crHeaders = { ...headers, "Content-Type": "application/json" };
    const getPolicy = await axios_1.default.post(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`, {}, { headers: crHeaders });
    const policy = getPolicy.data;
    policy.bindings = policy.bindings || [];
    for (const role of roles) {
        let b = policy.bindings.find((x) => x.role === role);
        if (!b) {
            b = { role, members: [] };
            policy.bindings.push(b);
        }
        const member = `serviceAccount:${saEmail}`;
        if (!b.members.includes(member))
            b.members.push(member);
    }
    await axios_1.default.post(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`, { policy }, { headers: crHeaders });
    if (addLog)
        await addLog("Ensured IAM roles on project for deployer SA");
    // 3) Create a key for the SA
    const keyResp = await axios_1.default.post(`https://iam.googleapis.com/v1/${saName}/keys`, { keyAlgorithm: "KEY_ALG_RSA_2048", privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE" }, { headers });
    const privateKeyData = keyResp.data.privateKeyData; // base64
    const keyJson = Buffer.from(privateKeyData, "base64").toString("utf8");
    if (addLog)
        await addLog("Created service account key");
    return { email: saEmail, keyJson };
}
async function detectLanguageAndFramework(octokit, owner, repo) {
    const details = {};
    let language = null;
    let framework = null;
    try {
        const langs = await octokit.repos.listLanguages({ owner, repo });
        details.languages = langs.data;
        // pick top language by bytes
        const entries = Object.entries(langs.data);
        if (entries.length) {
            entries.sort((a, b) => b[1] - a[1]);
            language = entries[0][0];
        }
    }
    catch (e) {
        logger.warn("Failed to list languages", e);
    }
    // Try package.json
    try {
        const pkgResp = await octokit.repos.getContent({ owner, repo, path: "package.json" });
        // @ts-ignore
        if (pkgResp.data && pkgResp.data.content) {
            // @ts-ignore
            const content = Buffer.from(pkgResp.data.content, "base64").toString("utf8");
            const pkg = JSON.parse(content);
            details.packageJson = pkg;
            if (!language)
                language = "JavaScript";
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            if (deps["next"])
                framework = "Next.js";
            else if (deps["react"])
                framework = "React";
            else if (deps["vue"])
                framework = "Vue";
            else if (deps["@angular/core"])
                framework = "Angular";
            else if (deps["svelte"])
                framework = "Svelte";
        }
    }
    catch { }
    // Try Python
    if (!framework && !language) {
        try {
            await octokit.repos.getContent({ owner, repo, path: "requirements.txt" });
            language = "Python";
        }
        catch { }
    }
    // Try Go
    if (!framework && !language) {
        try {
            await octokit.repos.getContent({ owner, repo, path: "go.mod" });
            language = "Go";
        }
        catch { }
    }
    return { language, framework, details };
}
async function getRepoPublicKey(octokit, owner, repo) {
    const { data } = await octokit.rest.actions.getRepoPublicKey({ owner, repo });
    return data; // { key, key_id }
}
function encryptSecret(publicKey, secretValue) {
    const messageBytes = Buffer.from(secretValue);
    const keyBytes = Buffer.from(publicKey, "base64");
    const encryptedBytes = sodium.seal(messageBytes, keyBytes);
    return Buffer.from(encryptedBytes).toString("base64");
}
async function upsertRepoSecret(octokit, owner, repo, name, value) {
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
async function createOrUpdateFile(octokit, params) {
    const { owner, repo, path, content, message, branch } = params;
    let sha = undefined;
    let unchanged = false;
    try {
        const existing = await octokit.repos.getContent({ owner, repo, path, ref: branch });
        // @ts-ignore
        const data = existing.data;
        sha = data.sha;
        if (data.content) {
            const current = Buffer.from(data.content, "base64").toString("utf8");
            if (current.trim() === content.trim()) {
                unchanged = true;
            }
        }
    }
    catch { }
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
function analysisWorkflowYml() {
    return `name: Analyze Codebase
on:
  workflow_dispatch:
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: |
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
`;
}
function deployWorkflowYml(projectId, serviceName, region) {
    const ghaSecret = '${{ secrets.GCP_SA_KEY }}';
    return `name: Deploy to Cloud Run
on:
  workflow_dispatch:
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
`;
}
function defaultDockerfile() {
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
function defaultDockerignore() {
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
async function triggerWorkflowDispatch(octokit, owner, repo, workflowFile, refBranch) {
    await octokit.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: workflowFile,
        ref: refBranch,
    });
}
async function waitForLatestWorkflowConclusion(octokit, owner, repo, workflowFile, timeoutMs = 120000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const runs = await octokit.rest.actions.listWorkflowRuns({ owner, repo, workflow_id: workflowFile, per_page: 1 });
            const run = runs.data.workflow_runs?.[0];
            if (run && run.status === "completed") {
                return run.conclusion || null; // success, failure, cancelled, etc.
            }
        }
        catch { }
        await new Promise(r => setTimeout(r, 5000));
    }
    return null;
}
async function ensureWorkflowExists(octokit, owner, repo, workflowFile, timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const workflows = await octokit.rest.actions.listRepoWorkflows({ owner, repo, per_page: 100 });
            const exists = workflows.data.workflows?.some(w => w.path?.endsWith(`.github/workflows/${workflowFile}`) || w.path === workflowFile || w.name === workflowFile);
            if (exists)
                return true;
        }
        catch { }
        await new Promise(r => setTimeout(r, 3000));
    }
    return false;
}
// Remove all workflow files except the two we manage
async function cleanupUnwantedWorkflows(octokit, owner, repo, defaultBranch) {
    const allowed = new Set(["analysis.yml", "deploy-cloudrun.yml"]);
    try {
        const contents = await octokit.repos.getContent({ owner, repo, path: ".github/workflows", ref: defaultBranch });
        const items = Array.isArray(contents.data) ? contents.data : [];
        for (const item of items) {
            const name = item.name;
            const path = item.path;
            if (!allowed.has(name)) {
                try {
                    const file = await octokit.repos.getContent({ owner, repo, path, ref: defaultBranch });
                    // @ts-ignore
                    const sha = file.data.sha;
                    await octokit.repos.deleteFile({ owner, repo, path, message: `chore: remove unrequired workflow ${name} via Devyntra`, sha, branch: defaultBranch });
                }
                catch (e) {
                    logger.warn("Failed to delete workflow", { path, error: e?.message });
                }
            }
        }
    }
    catch {
        // workflows folder may not exist yet
    }
}
// Check if a recent workflow run exists to avoid duplicate dispatch
async function hasRecentRun(octokit, owner, repo, workflowFile, withinMs = 120000) {
    try {
        const runs = await octokit.rest.actions.listWorkflowRuns({ owner, repo, workflow_id: workflowFile, per_page: 1 });
        const run = runs.data.workflow_runs?.[0];
        if (!run)
            return false;
        const created = new Date(run.created_at).getTime();
        return Date.now() - created < withinMs && (run.status === "in_progress" || run.status === "queued" || run.status === "requested");
    }
    catch {
        return false;
    }
}
exports.deploy = (0, https_1.onRequest)({
    region: "us-central1",
    cors: true,
    timeoutSeconds: 300,
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
        // Verify Firebase ID token and get userId for Firestore document
        const idToken = (Array.isArray(authHeader) ? authHeader[0] : authHeader).replace(/^Bearer\s+/i, "");
        let userId = "unknown";
        try {
            const decoded = await admin.auth().verifyIdToken(idToken);
            userId = decoded.uid;
        }
        catch (e) {
            logger.warn("Failed to verify ID token", e);
        }
        // Create deployment doc
        const deploymentRef = db.collection("deployments").doc();
        const deploymentId = deploymentRef.id;
        const now = admin.firestore.FieldValue.serverTimestamp();
        const setStatus = async (status, message, extra = {}) => {
            await deploymentRef.set({
                userId,
                repoOwner,
                repoName,
                repoId: `${repoOwner}/${repoName}`,
                status,
                message,
                updatedAt: now,
                ...extra,
            }, { merge: true });
        };
        const addLog = async (line) => {
            await deploymentRef.set({
                logs: admin.firestore.FieldValue.arrayUnion(line),
                updatedAt: now,
            }, { merge: true });
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
        const octokit = new rest_1.Octokit({ auth: githubToken });
        // Validate repo access and get default branch
        const repoInfo = await octokit.repos.get({ owner: repoOwner, repo: repoName });
        const defaultBranch = repoInfo.data.default_branch || "main";
        // 1) Inject secrets + Detect language & framework
        await setStatus("injecting_secrets", "Injecting required GitHub secrets...");
        // 2) Ensure required secrets in repo
        const projectId = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
        let gcpSaKey = process.env.GCP_SA_KEY || (projectId ? await accessSecret(projectId, "GCP_SA_KEY") : null) || undefined;
        const webhookUrl = process.env.DEVYNTRA_WEBHOOK_URL || (projectId ? (await accessSecret(projectId, "DEVYNTRA_WEBHOOK_URL")) || "" : "");
        if (!projectId || !gcpSaKey) {
            logger.warn("Missing projectId or GCP_SA_KEY in env; CI/CD may fail.");
        }
        // Bootstrap if GCP_SA_KEY is missing: auto-create SA + key and use it
        if (!gcpSaKey && projectId) {
            await setStatus("injecting_secrets", "Creating deployer service account and key...");
            const { keyJson } = await ensureDeployerServiceAccount(projectId, addLog);
            gcpSaKey = keyJson;
        }
        if (projectId)
            await upsertRepoSecret(octokit, repoOwner, repoName, "FIREBASE_PROJECT_ID", projectId);
        if (gcpSaKey)
            await upsertRepoSecret(octokit, repoOwner, repoName, "GCP_SA_KEY", gcpSaKey);
        const regionVal = process.env.CLOUD_RUN_REGION || (projectId ? (await accessSecret(projectId, "CLOUD_RUN_REGION")) || "us-central1" : "us-central1");
        await upsertRepoSecret(octokit, repoOwner, repoName, "CLOUD_RUN_REGION", regionVal);
        if (webhookUrl)
            await upsertRepoSecret(octokit, repoOwner, repoName, "DEVYNTRA_WEBHOOK_URL", webhookUrl);
        await upsertRepoSecret(octokit, repoOwner, repoName, "NODE_ENV", "production");
        await setStatus("detecting_language", "Detecting language and framework...");
        const detect = await detectLanguageAndFramework(octokit, repoOwner, repoName);
        await deploymentRef.set({ language: detect.language || null, framework: detect.framework || null }, { merge: true });
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
        if (!(await hasRecentRun(octokit, repoOwner, repoName, "analysis.yml"))) {
            await triggerWorkflowDispatch(octokit, repoOwner, repoName, ".github/workflows/analysis.yml", defaultBranch);
        }
        await setStatus("analyzing", "Running code analysis workflow...");
        const analysisConclusion = await waitForLatestWorkflowConclusion(octokit, repoOwner, repoName, "analysis.yml", 180000);
        const errorsFound = analysisConclusion === "failure";
        // 4) If errors, call Jules API to fix and auto-merge
        if (errorsFound) {
            const julesUrl = process.env.JULES_API_URL || (projectId ? await accessSecret(projectId, "JULES_API_URL") : null);
            const julesKey = process.env.JULES_API_KEY || (projectId ? await accessSecret(projectId, "JULES_API_KEY") : null);
            if (julesUrl && julesKey) {
                try {
                    await setStatus("fixing", "Errors found. Sending to Jules for auto-fix...");
                    await axios_1.default.post(julesUrl, {
                        owner: repoOwner,
                        repo: repoName,
                        language: detect.language,
                        framework: detect.framework,
                    }, { headers: { Authorization: `Bearer ${julesKey}` } });
                    // Optionally handle response data in future
                }
                catch (e) {
                    logger.warn("Jules API call failed", e);
                }
            }
        }
        // Ensure JULES secrets are also present in the repo for workflows, if available
        const julesUrlForRepo = process.env.JULES_API_URL || (projectId ? await accessSecret(projectId, "JULES_API_URL") : null);
        const julesKeyForRepo = process.env.JULES_API_KEY || (projectId ? await accessSecret(projectId, "JULES_API_KEY") : null);
        if (julesUrlForRepo)
            await upsertRepoSecret(octokit, repoOwner, repoName, "JULES_API_URL", julesUrlForRepo);
        if (julesKeyForRepo)
            await upsertRepoSecret(octokit, repoOwner, repoName, "JULES_API_KEY", julesKeyForRepo);
        // 5) Ensure Dockerfile and .dockerignore present for Docker-based deploys
        try {
            await octokit.repos.getContent({ owner: repoOwner, repo: repoName, path: "Dockerfile", ref: defaultBranch });
        }
        catch {
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
        }
        catch {
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
        await createOrUpdateFile(octokit, {
            owner: repoOwner,
            repo: repoName,
            path: deployPath,
            content: deployWorkflowYml(projectId || "", serviceName, region),
            message: "chore: add Cloud Run deploy workflow via Devyntra",
            branch: defaultBranch,
        });
        // Optionally trigger deploy workflow now
        await new Promise(r => setTimeout(r, 5000));
        const deployReady = await ensureWorkflowExists(octokit, repoOwner, repoName, "deploy-cloudrun.yml", 30000);
        if (!deployReady) {
            throw new Error("deploy-cloudrun.yml not detected by GitHub yet; try again shortly");
        }
        await setStatus("deploying", "Starting Cloud Run deployment workflow...");
        if (!(await hasRecentRun(octokit, repoOwner, repoName, "deploy-cloudrun.yml"))) {
            await triggerWorkflowDispatch(octokit, repoOwner, repoName, ".github/workflows/deploy-cloudrun.yml", defaultBranch);
        }
        // Return deployment id to the client for realtime updates
        res.json({ deploymentId });
    }
    catch (error) {
        logger.error("Deploy workflow failed", error);
        try {
            await db.collection("deployments").add({
                status: "failed",
                message: error?.message || "Internal error",
                errors: [String(error?.stack || error)],
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        catch { }
        res.status(500).json({ error: error?.message || "Internal error" });
    }
});
//# sourceMappingURL=index.js.map