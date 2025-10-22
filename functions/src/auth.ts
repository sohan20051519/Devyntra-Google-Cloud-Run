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

export const githubAppAuth = functions.https.onCall(async (data, context) => {
    const { code, installationId } = data;

    if (!code || !installationId) {
        throw new functions.https.HttpsError("invalid-argument", "Missing code or installationId");
    }

    try {
        const jwtToken = generateJwt();
        const installationTokenResponse = await axios.post(`https://api.github.com/app/installations/${installationId}/access_tokens`, {}, {
            headers: {
                "Authorization": `Bearer ${jwtToken}`
            }
        });
        const installationToken = installationTokenResponse.data.token;

        const githubUserResponse = await axios.get("https://api.github.com/user", {
            headers: {
                "Authorization": `token ${installationToken}`
            }
        });
        const githubUser = githubUserResponse.data;

        const firebaseToken = await admin.auth().createCustomToken(githubUser.id.toString());
        await admin.firestore().collection("users").doc(githubUser.id.toString()).set({
            githubUsername: githubUser.login,
            installationId: installationId,
        });

        return { firebaseToken };

    } catch (error) {
        functions.logger.error(error);
        throw new functions.https.HttpsError("internal", "GitHub App authentication failed.");
    }
});
