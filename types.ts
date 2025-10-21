
export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number;
  };
  html_url: string;
  description: string | null;
  language: string | null;
  updated_at: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
  ssh_url: string;
}

export interface Deployment {
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