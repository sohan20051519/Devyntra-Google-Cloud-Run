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

export const getUserRepos = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User is not authenticated.");
    }

    const userId = context.auth.uid;
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found.");
    }
    const installationId = (userDoc.data() as any).installationId;

    const jwtToken = generateJwt();
    const installationTokenResponse = await axios.post(`https://api.github.com/app/installations/${installationId}/access_tokens`, {}, {
        headers: {
            "Authorization": `Bearer ${jwtToken}`
        }
    });
    const installationToken = installationTokenResponse.data.token;

    const reposResponse = await axios.get("https://api.github.com/installation/repositories", {
        headers: {
            "Authorization": `token ${installationToken}`
        }
    });

    const repos = reposResponse.data.repositories;

    const batch = admin.firestore().batch();
    repos.forEach((repo: any) => {
        const repoRef = admin.firestore().collection("users").doc(userId).collection("repositories").doc(repo.id.toString());
        batch.set(repoRef, {
            name: repo.name,
            owner: repo.owner.login,
            fullName: repo.full_name,
        });
    });
    await batch.commit();

    return { repos };
});

export const saveDeployment = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User is not authenticated.");
    }

    const userId = context.auth.uid;
    const { repoName, status } = data;

    await admin.firestore().collection("users").doc(userId).collection("deployments").add({
        repoName: repoName,
        status: status,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});
