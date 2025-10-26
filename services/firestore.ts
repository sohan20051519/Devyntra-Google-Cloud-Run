import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, query, where, orderBy, limit, getDocs, addDoc, updateDoc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Deployment } from '../types';

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

// Get GitHub token from localStorage or Firestore
const getGitHubToken = async (): Promise<string> => {
  // First try localStorage
  const localToken = localStorage.getItem('github_access_token');
  if (localToken) {
    return localToken;
  }

  // If not in localStorage, try to get from Firestore
  const { auth } = await import('./firebase');
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to get GitHub token');
  }

  const { doc, getDoc } = await import('firebase/firestore');
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const userData = userDoc.data();
  
  if (!userData?.githubToken) {
    throw new Error('GitHub token not found. Please reconnect your GitHub account.');
  }

  return userData.githubToken;
};

// Start a new deployment (real implementation)
export const startDeployment = async (repoId: string, repoOwner: string, repoName: string): Promise<{ deploymentId: string }> => {
  try {
    console.log('startDeployment called with:', { repoId, repoOwner, repoName });
    
    // Get current user ID and ID token
    const { auth } = await import('./firebase');
    const userId = auth.currentUser?.uid;
    
    console.log('Current user ID:', userId);
    
    if (!userId) {
      throw new Error('User must be authenticated to start a deployment');
    }
    
    // Get ID token for authentication
    const idToken = await auth.currentUser.getIdToken();
    console.log('Got ID token for authentication');
    
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
        githubToken: await getGitHubToken() // Add GitHub token
      })
    });
    
    console.log('HTTP response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('HTTP error response:', errorData);
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
    }
    
    const result = await response.json();
    console.log('Cloud Function result:', result);
    return result as { deploymentId: string };
  } catch (error) {
    console.error('Error starting deployment:', error);
    throw error;
  }
};

// Simulation function removed - now using real Cloud Functions

// Watch a deployment for real-time updates
export const watchDeployment = (deploymentId: string, callback: (deployment: Deployment | null) => void) => {
  console.log('Setting up Firestore listener for deployment:', deploymentId);
  const deploymentRef = doc(db, 'deployments', deploymentId);
  
  return onSnapshot(deploymentRef, (snapshot) => {
    console.log('Firestore snapshot received:', snapshot.exists(), snapshot.data());
    if (snapshot.exists()) {
      const deployment = { id: snapshot.id, ...snapshot.data() } as Deployment;
      console.log('Calling callback with deployment:', deployment);
      callback(deployment);
    } else {
      console.log('Document does not exist, calling callback with null');
      callback(null);
    }
  }, (error) => {
    console.error('Firestore listener error:', error);
  });
};

// Get user's deployments
export const getDeployments = async (userId: string): Promise<Deployment[]> => {
  if (!userId) {
    console.warn('No userId provided to getDeployments');
    return [];
  }
  
  try {
    const deploymentsRef = collection(db, 'deployments');
    const q = query(
      deploymentsRef,
      where('userId', '==', userId),
      limit(50)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deployment));
  } catch (error) {
    console.error('Error getting deployments:', error);
    return [];
  }
};

// Get deployment statistics
export const getDeploymentStats = async (userId: string) => {
  if (!userId) {
    console.warn('No userId provided to getDeploymentStats');
    return { total: 0, deployed: 0, failed: 0, inProgress: 0 };
  }
  
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
    return { total: 0, deployed: 0, failed: 0, inProgress: 0 };
  }
};

// Get recent activity
export const getRecentActivity = async (userId: string, limitCount: number = 10) => {
  if (!userId) {
    console.warn('No userId provided to getRecentActivity');
    return [];
  }
  
  try {
    const deploymentsRef = collection(db, 'deployments');
    const q = query(
      deploymentsRef,
      where('userId', '==', userId),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deployment));
  } catch (error) {
    console.error('Error getting recent activity:', error);
    return [];
  }
};

// Delete a specific deployment
export const deleteDeployment = async (deploymentId: string) => {
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
