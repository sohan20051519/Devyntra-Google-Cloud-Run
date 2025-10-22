import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import * as jwt from "jsonwebtoken";

const JULES_API_KEY = process.env.JULES_API_KEY;
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

export async function startJulesSessionLogic(owner: string, repo: string, installationId: string, deploymentId: string, userId: string) {
    const sessionResponse = await axios.post("https://jules.googleapis.com/v1alpha/sessions", {
        "prompt": "Apply the required coding updates or fixes to this repository.",
        "sourceContext": {
            "source": `sources/github/${owner}/${repo}`,
            "githubRepoContext": { "startingBranch": "main" }
        },
        "automationMode": "AUTO_CREATE_PR"
    }, {
        headers: {
            "Authorization": `Bearer ${JULES_API_KEY}`,
            "Content-Type": "application/json"
        }
    });

    const { sessionId, viewUrl } = sessionResponse.data;

    await admin.firestore().collection("users").doc(userId).collection("deployments").doc(deploymentId).update({
        sessionId,
        viewUrl,
        status: "jules-in-progress",
    });

    return { sessionId, viewUrl };
}

export const startJulesSession = functions.https.onRequest(async (request, response) => {
    const { owner, repo, installationId, deploymentId, userId } = request.body;
    if (!owner || !repo || !installationId || !deploymentId || !userId) {
        response.status(400).send("Missing required fields");
        return;
    }
    try {
        const result = await startJulesSessionLogic(owner, repo, installationId, deploymentId, userId);
        response.send(result);
    } catch (error) {
        functions.logger.error(error);
        response.status(500).send("Failed to start Jules session");
    }
});

export const handleJulesWebhook = functions.https.onRequest(async (request, response) => {
    const { sessionId, pullRequestUrl } = request.body;
    if (!sessionId || !pullRequestUrl) {
        response.status(400).send("Missing sessionId or pullRequestUrl");
        return;
    }

    try {
        const snapshot = await admin.firestore().collectionGroup("deployments").where("sessionId", "==", sessionId).get();
        if (snapshot.empty) {
            response.status(404).send("Deployment not found");
            return;
        }

        const deploymentDoc = snapshot.docs[0];
        const { installationId, repoName } = deploymentDoc.data();
        const pullRequestNumber = parseInt(pullRequestUrl.split("/").pop());

        await deploymentDoc.ref.update({
            pullRequestUrl,
            status: "jules-pr-created",
        });

        const jwtToken = generateJwt();
        const installationTokenResponse = await axios.post(`https://api.github.com/app/installations/${installationId}/access_tokens`, {}, {
            headers: { "Authorization": `Bearer ${jwtToken}` }
        });
        const installationToken = installationTokenResponse.data.token;

        const owner = repoName.split('/')[0];
        const repo = repoName.split('/')[1];

        const getPrIdQuery = `
            query {
                repository(owner: "${owner}", name: "${repo}") {
                    pullRequest(number: ${pullRequestNumber}) {
                        id
                    }
                }
            }
        `;

        const prIdResponse = await axios.post("https://api.github.com/graphql", { query: getPrIdQuery }, {
            headers: { "Authorization": `Bearer ${installationToken}` }
        });

        const pullRequestId = prIdResponse.data.data.repository.pullRequest.id;

        const mutation = `
            mutation {
                enablePullRequestAutoMerge(input: {
                    pullRequestId: "${pullRequestId}",
                    mergeMethod: MERGE
                }) {
                    pullRequest { number }
                }
            }
        `;

        await axios.post("https://api.github.com/graphql", { query: mutation }, {
            headers: { "Authorization": `Bearer ${installationToken}` }
        });

        await deploymentDoc.ref.update({ status: "auto-merge-enabled" });

        response.send({ success: true });

    } catch (error) {
        functions.logger.error(error);
        response.status(500).send("Failed to handle Jules webhook");
    }
});
