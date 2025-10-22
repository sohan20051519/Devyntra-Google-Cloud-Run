import * as functions from "firebase-functions";
import { createAnalysisWorkflowLogic, createCiCdWorkflowLogic } from "./pipeline";
import { startJulesSessionLogic } from "./jules";

export const onCreateAnalysisWorkflowTrigger = functions.pubsub.topic("create-analysis-workflow").onPublish(async (message) => {
    const { repoName, userId } = message.json;
    await createAnalysisWorkflowLogic(repoName, userId);
});

export const onStartJulesSessionTrigger = functions.pubsub.topic("start-jules-session").onPublish(async (message) => {
    const { owner, repo, installationId, deploymentId, userId } = message.json;
    await startJulesSessionLogic(owner, repo, installationId, deploymentId, userId);
});

export const onCreateCiCdWorkflowTrigger = functions.pubsub.topic("create-cicd-workflow").onPublish(async (message) => {
    const { repoName, userId } = message.json;
    await createCiCdWorkflowLogic(repoName, userId);
});
