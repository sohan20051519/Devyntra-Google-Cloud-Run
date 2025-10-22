import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { PubSub } from "@google-cloud/pubsub";

const pubsub = new PubSub();

export const startDeployment = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User is not authenticated.");
    }

    const { repoName } = data;
    const userId = context.auth.uid;

    const deploymentRef = await admin.firestore().collection("users").doc(userId).collection("deployments").add({
        repoName: repoName,
        status: "starting-deployment",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userId: userId,
    });

    await pubsub.topic("create-analysis-workflow").publishJSON({
        repoName: repoName,
        deploymentId: deploymentRef.id,
        userId: userId,
    });

    return { success: true };
});

export const handleAnalysisResult = functions.https.onRequest(async (request, response) => {
    const { repoName, analysisResult, installationId, userId } = request.body;

    const snapshot = await admin.firestore().collection("users").doc(userId).collection("deployments").where("repoName", "==", repoName).orderBy("createdAt", "desc").limit(1).get();
    if (snapshot.empty) {
        response.status(404).send("Deployment not found");
        return;
    }
    const deploymentDoc = snapshot.docs[0];

    if (analysisResult === "failed") {
        await deploymentDoc.ref.update({ status: "analysis-failed" });
        await pubsub.topic("start-jules-session").publishJSON({
            owner: deploymentDoc.data().owner,
            repo: repoName,
            installationId,
            deploymentId: deploymentDoc.id,
            userId: userId,
        });
    } else {
        await deploymentDoc.ref.update({ status: "analysis-succeeded" });
        await pubsub.topic("create-cicd-workflow").publishJSON({
            repoName: repoName,
            deploymentId: deploymentDoc.id,
            userId: userId,
        });
    }

    response.send({ success: true });
});
