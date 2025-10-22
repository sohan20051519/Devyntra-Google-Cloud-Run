import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { PubSub } from "@google-cloud/pubsub";

const pubsub = new PubSub();

export const rollbackDeployment = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User is not authenticated.");
    }

    const { deploymentId } = data;
    const userId = context.auth.uid;

    const deploymentDoc = await admin.firestore().collection("users").doc(userId).collection("deployments").doc(deploymentId).get();
    if (!deploymentDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Deployment not found.");
    }
    const repoName = (deploymentDoc.data() as any).repoName;

    const previousDeploymentsSnapshot = await admin.firestore().collection("users").doc(userId).collection("deployments")
        .where("repoName", "==", repoName)
        .where("status", "==", "deployed")
        .orderBy("createdAt", "desc")
        .limit(2)
        .get();

    if (previousDeploymentsSnapshot.size < 2) {
        throw new functions.https.HttpsError("not-found", "No previous successful deployment found to roll back to.");
    }

    const previousDeployment = previousDeploymentsSnapshot.docs[1].data();

    await pubsub.topic("create-cicd-workflow").publishJSON({
        repoName: repoName,
        deploymentId: previousDeployment.id,
        commitHash: previousDeployment.commitHash,
    });

    return { success: true };
});

export const deleteDeployment = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User is not authenticated.");
    }

    const { deploymentId } = data;
    const userId = context.auth.uid;

    await admin.firestore().collection("users").doc(userId).collection("deployments").doc(deploymentId).delete();

    return { success: true };
});

export const redeploy = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User is not authenticated.");
    }

    const { deploymentId } = data;
    const userId = context.auth.uid;

    const deploymentDoc = await admin.firestore().collection("users").doc(userId).collection("deployments").doc(deploymentId).get();
    if (!deploymentDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Deployment not found.");
    }
    const repoName = (deploymentDoc.data() as any).repoName;

    await pubsub.topic("create-analysis-workflow").publishJSON({
        repoName: repoName,
        deploymentId: deploymentId,
        userId: userId,
    });

    return { success: true };
});
