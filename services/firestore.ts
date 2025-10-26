import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDYfGFH5-tMEGVoPsTqBgHYX4qcZbY8WkE",
  authDomain: "devyntra-500e4.firebaseapp.com",
  projectId: "devyntra-500e4",
  storageBucket: "devyntra-500e4.firebasestorage.app",
  messagingSenderId: "583516794481",
  appId: "1:583516794481:web:ffd1dcc966bb04f27275d0",
  measurementId: "G-SWF3LQFBR0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Deployment types
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}

// Start a new deployment
export const startDeployment = async (repoId: string, repoOwner: string, repoName: string): Promise<{ deploymentId: string }> => {
  try {
    // Get current user ID and ID token
    const { auth } = await import('./firebase');
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User must be authenticated to start a deployment');
    }
    
    // Get ID token for authentication
    const idToken = await user.getIdToken();
    
    // Get GitHub token from localStorage or Firestore
    const getGitHubToken = async (): Promise<string> => {
      // First try localStorage
      const localToken = localStorage.getItem('github_access_token');
      if (localToken) {
        return localToken;
      }

      // If not in localStorage, try to get from Firestore
      const { doc, getDoc } = await import('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      if (!userData?.githubToken) {
        throw new Error('GitHub token not found. Please reconnect your GitHub account.');
      }

      return userData.githubToken;
    };
    
    // Call the Cloud Function via HTTP
    const response = await fetch('https://us-central1-devyntra-500e4.cloudfunctions.net/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        repoId,
        repoOwner,
        repoName,
        githubToken: await getGitHubToken()
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
    }
    
    const result = await response.json();
    return result as { deploymentId: string };
  } catch (error) {
    console.error('Error starting deployment:', error);
    throw error;
  }
};

// Watch a deployment for real-time updates
export const watchDeployment = (deploymentId: string, callback: (deployment: Deployment | null) => void) => {
  const deploymentRef = doc(db, 'deployments', deploymentId);
  
  return onSnapshot(deploymentRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as Deployment);
    } else {
      callback(null);
    }
  });
};

// Get user's deployments
export const getDeployments = async (userId: string): Promise<Deployment[]> => {
  const deploymentsRef = collection(db, 'deployments');
  const q = query(
    deploymentsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deployment));
};

// Get deployment statistics
export const getDeploymentStats = async (userId: string) => {
  try {
    const deploymentsRef = collection(db, 'deployments');
    const q = query(deploymentsRef, where('userId', '==', userId));
    
    const snapshot = await getDocs(q);
    const deployments = snapshot.docs.map(doc => doc.data());
    
    const stats = {
      total: deployments.length,
      deployed: deployments.filter(d => d.status === 'deployed').length,
      failed: deployments.filter(d => d.status === 'failed').length,
      inProgress: deployments.filter(d => ['detecting_language', 'analyzing', 'fixing', 'deploying'].includes(d.status)).length,
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting deployment stats:', error);
    // Return zero stats if query fails (e.g., missing index)
    return { total: 0, deployed: 0, failed: 0, inProgress: 0 };
  }
};

// Get recent activity
export const getRecentActivity = async (userId: string, limitCount: number = 10) => {
  try {
    const deploymentsRef = collection(db, 'deployments');
    // Simplified query - remove orderBy to avoid index requirement
    const q = query(
      deploymentsRef,
      where('userId', '==', userId),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deployment));
    // Sort client-side by updatedAt
    return docs.sort((a, b) => {
      const aTime = a.updatedAt?.toDate?.()?.getTime() || 0;
      const bTime = b.updatedAt?.toDate?.()?.getTime() || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error getting recent activity:', error);
    return [];
  }
};

// Delete a specific deployment
export const deleteDeployment = async (deploymentId: string) => {
  const { doc, deleteDoc } = await import('firebase/firestore');
  try {
    const deploymentRef = doc(db, 'deployments', deploymentId);
    await deleteDoc(deploymentRef);
    console.log('Deployment deleted:', deploymentId);
    return true;
  } catch (error) {
    console.error('Error deleting deployment:', error);
    throw error;
  }
};

// Delete all failed deployments for a user
export const deleteFailedDeployments = async (userId: string) => {
  const { doc, deleteDoc } = await import('firebase/firestore');
  try {
    const deploymentsRef = collection(db, 'deployments');
    const q = query(
      deploymentsRef,
      where('userId', '==', userId),
      where('status', '==', 'failed')
    );
    
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);
    console.log(`Deleted ${deletePromises.length} failed deployments`);
    return deletePromises.length;
  } catch (error) {
    console.error('Error deleting failed deployments:', error);
    throw error;
  }
};

