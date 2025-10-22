import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import * as jwt from "jsonwebtoken";

const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY;

function generateJwt() {
    if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY) {
        throw new Error("GitHub App ID or Private Key not defined.");
    }
    const privateKey = GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n');
    const payload = {
        iat: Math.floor(Date.now() / 1000) - 60,
        exp: Math.floor(Date.now() / 1000) + (10 * 60),
        iss: GITHUB_APP_ID,
    };
    return jwt.sign(payload, privateKey, { algorithm: "RS256" });
}

async function getInstallationToken(installationId: string): Promise<string> {
    const jwtToken = generateJwt();
    const installationTokenResponse = await axios.post(`https://api.github.com/app/installations/${installationId}/access_tokens`, {}, {
        headers: { "Authorization": `Bearer ${jwtToken}` }
    });
    return installationTokenResponse.data.token;
}

export async function createAnalysisWorkflowLogic(repoName: string, userId: string) {
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
        throw new Error("User not found.");
    }
    const installationId = (userDoc.data() as any).installationId;
    const installationToken = await getInstallationToken(installationId);

    const workflowContent = `
name: Code Analysis
on:
  push:
    branches:
      - main
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install ESLint
        run: npm install eslint
      - name: Run ESLint
        id: eslint
        run: eslint . --format json --output-file eslint-report.json || true
      - name: Send analysis result
        if: always()
        run: |
          ANALYSIS_RESULT="succeeded"
          if [[ \`jq '.[] | .errorCount' eslint-report.json | paste -s -d+ - | bc\` -gt 0 ]]; then
            ANALYSIS_RESULT="failed"
          fi
          curl -X POST -H "Content-Type: application/json" -d '{"repoName": "'"\${{ github.repository }}"'", "analysisResult": "'"\$ANALYSIS_RESULT"'", "installationId": "'"\${{ secrets.INSTALLATION_ID }}"'", "userId": "'"${userId}"'"}' "\${{ secrets.WEBHOOK_URL }}"
`;

    const encodedContent = Buffer.from(workflowContent).toString("base64");
    await axios.put(`https://api.github.com/repos/${repoName}/contents/.github/workflows/analysis.yml`, {
        message: "Create code analysis workflow",
        content: encodedContent,
    }, {
        headers: { "Authorization": `token ${installationToken}` }
    });
}

export async function createCiCdWorkflowLogic(repoName: string, userId: string, commitHash?: string) {
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
        throw new Error("User not found.");
    }
    const installationId = (userDoc.data() as any).installationId;
    const installationToken = await getInstallationToken(installationId);

    const checkoutStep = commitHash ? `
      - name: Checkout specific commit
        uses: actions/checkout@v2
        with:
          ref: ${commitHash}
` : `
      - name: Checkout code
        uses: actions/checkout@v2
`;

    const workflowContent = `
name: CI/CD Pipeline
on:
  push:
    branches:
      - main
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
${checkoutStep}
      - name: Authenticate with Google Cloud
        uses: google-github-actions/auth@v0
        with:
          credentials_json: '\${{ secrets.GCP_CREDENTIALS }}'
      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v0
      - name: Build and push Docker image
        run: |-
          gcloud auth configure-docker
          docker build -t gcr.io/${process.env.GCP_PROJECT_ID}/${repoName} .
          docker push gcr.io/${process.env.GCP_PROJECT_ID}/${repoName}
      - name: Deploy to Cloud Run
        run: |-
          gcloud run deploy ${repoName} \\
            --image gcr.io/${process.env.GCP_PROJECT_ID}/${repoName} \\
            --platform managed \\
            --region us-central1 \\
            --allow-unauthenticated
`;

    const encodedContent = Buffer.from(workflowContent).toString("base64");
    await axios.put(`https://api.github.com/repos/${repoName}/contents/.github/workflows/cicd.yml`, {
        message: "Create CI/CD workflow",
        content: encodedContent,
    }, {
        headers: { "Authorization": `token ${installationToken}` }
    });
}

export const createAnalysisWorkflow = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User is not authenticated.");
    }
    await createAnalysisWorkflowLogic(data.repoName, context.auth.uid);
    return { success: true };
});

export const createCiCdWorkflow = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User is not authenticated.");
    }
    await createCiCdWorkflowLogic(data.repoName, context.auth.uid, data.commitHash);
    return { success: true };
});
