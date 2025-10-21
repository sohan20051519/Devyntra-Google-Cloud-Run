import { httpsCallable } from 'firebase/functions';
import { functions } from './config';

// Currently available functions (basic implementation)
export const healthCheck = httpsCallable(functions, 'healthCheck');
export const completeGitHubAuth = httpsCallable(functions, 'completeGitHubAuth');
export const fetchUserRepos = httpsCallable(functions, 'fetchUserRepos');
export const detectRepoLanguage = httpsCallable(functions, 'detectRepoLanguage');
export const deployToCloudRun = httpsCallable(functions, 'deployToCloudRun');
