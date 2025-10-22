import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

interface WeeklyActivity {
    name: string;
    deployments: number;
    builds: number;
}

export const getDashboardData = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User is not authenticated.");
    }

    const userId = context.auth.uid;

    const deploymentsSnapshot = await admin.firestore().collection("users").doc(userId).collection("deployments").get();
    const successfulBuilds = deploymentsSnapshot.docs.filter(doc => doc.data().status === "deployed").length;
    const failedBuilds = deploymentsSnapshot.docs.filter(doc => doc.data().status === "failed").length;

    const reposSnapshot = await admin.firestore().collection("users").doc(userId).collection("repositories").get();
    const connectedRepos = reposSnapshot.size;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyActivitySnapshot = await admin.firestore().collection("users").doc(userId).collection("deployments")
        .where("createdAt", ">=", sevenDaysAgo)
        .get();

    const weeklyActivity = weeklyActivitySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            name: data.createdAt.toDate().toLocaleDateString('en-US', { weekday: 'short' }),
            deployments: 1,
            builds: data.status === "deployed" ? 1 : 0,
        };
    }).reduce((acc: WeeklyActivity[], cur) => {
        const existing = acc.find(item => item.name === cur.name);
        if (existing) {
            existing.deployments += cur.deployments;
            existing.builds += cur.builds;
        } else {
            acc.push(cur);
        }
        return acc;
    }, []);

    const recentActivitySnapshot = await admin.firestore().collection("users").doc(userId).collection("deployments")
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();

    const recentActivity = recentActivitySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            type: "deployment",
            description: `Deployment of \`${data.repoName}\` ${data.status}.`,
            time: data.createdAt.toDate().toLocaleDateString(),
        };
    });

    return {
        totalDeployments: deploymentsSnapshot.size,
        successfulBuilds,
        failedBuilds,
        connectedRepos,
        weeklyActivity,
        recentActivity,
    };
});
