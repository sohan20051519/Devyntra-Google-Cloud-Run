import { startDeployment, watchDeployment, getDeployments, getDeploymentStats, getRecentActivity, Deployment } from './firestore';

// Re-export deployment functions for easier imports
export { startDeployment, watchDeployment, getDeployments, getDeploymentStats, getRecentActivity, Deployment };

// Additional deployment utilities
export const formatDeploymentStatus = (status: Deployment['status']): string => {
  switch (status) {
    case 'starting':
      return 'Starting';
    case 'injecting_secrets':
      return 'Injecting Secrets';
    case 'detecting_language':
      return 'Detecting Language';
    case 'analyzing':
      return 'Analyzing Code';
    case 'fixing':
      return 'Fixing Errors';
    case 'deploying':
      return 'Deploying';
    case 'deployed':
      return 'Deployed';
    case 'failed':
      return 'Failed';
    default:
      return 'Unknown';
  }
};

export const getStatusColor = (status: Deployment['status']): string => {
  switch (status) {
    case 'deployed':
      return 'text-green-600';
    case 'failed':
      return 'text-red-600';
    case 'starting':
      return 'text-gray-600';
    case 'injecting_secrets':
      return 'text-orange-600';
    case 'detecting_language':
      return 'text-indigo-600';
    case 'analyzing':
      return 'text-purple-600';
    case 'fixing':
      return 'text-yellow-600';
    case 'deploying':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
};

export const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) return 'Unknown';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
};



