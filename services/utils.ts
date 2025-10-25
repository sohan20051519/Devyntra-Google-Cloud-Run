// Utility functions for deployment formatting

export const formatDeploymentStatus = (status: string): string => {
  switch (status) {
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
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

export const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) return 'Unknown';
  
  let date: Date;
  
  if (timestamp.toDate) {
    // Firestore Timestamp
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    // Firestore Timestamp object
    date = new Date(timestamp.seconds * 1000);
  } else if (typeof timestamp === 'string') {
    // ISO string
    date = new Date(timestamp);
  } else if (typeof timestamp === 'number') {
    // Unix timestamp
    date = new Date(timestamp);
  } else {
    return 'Invalid date';
  }
  
  return date.toLocaleString();
};
