
export interface Repository {
  id: string;
  name: string;
  owner: string;
  url: string;
  lastUpdate: string;
}

export interface Deployment {
  id: string;
  userId: string;
  repoOwner: string;
  repoName: string;
  repoId: string;
  status: 'starting' | 'injecting_secrets' | 'detecting_language' | 'analyzing' | 'fixing' | 'deploying' | 'deployed' | 'failed';
  language?: string;
  framework?: string;
  message: string;
  statusReason?: string;
  julesSessionId?: string;
  julesSessionUrl?: string;
  prNumber?: number;
  prUrl?: string;
  prStatus?: 'open' | 'merged' | 'closed';
  deploymentUrl?: string;
  cloudRunServiceName?: string;
  dockerImage?: string;
  logs: string[];
  errors: string[];
  createdAt: any;
  updatedAt: any;
  completedAt?: any;
}

// Legacy deployment interface for backward compatibility
export interface LegacyDeployment {
  id: string;
  repoName: string;
  status: 'Deployed' | 'Building' | 'Failed';
  url: string;
  deployedAt: string;
  branch: string;
  commitHash: string;
}

export interface Log {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  repoName?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

export enum Page {
    Overview = 'Overview',
    NewDeployment = 'New Deployment',
    Deployments = 'Deployments',
    DeploymentDetails = 'Deployment Details',
    DevAI = 'DevAI',
    Logs = 'Logs',
    Settings = 'Settings'
}