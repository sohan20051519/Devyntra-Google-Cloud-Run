import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GithubAuthProvider, UserCredential, onAuthStateChanged as fbOnAuthStateChanged, signOut as fbSignOut, updateProfile, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';

// Firebase config - keep this in sync with your Firebase console
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
const auth = getAuth(app);

/**
 * signInWithGitHub
 * - Opens a popup to sign in with GitHub via Firebase Auth
 * - Requests the requested scopes and returns the OAuth access token and user
 */
export async function signInWithGitHub() {
  const provider = new GithubAuthProvider();

  // Request the scopes needed by Jules
  provider.addScope('user');
  provider.addScope('repo');
  provider.addScope('workflow');
  provider.addScope('admin:repo_hook');
  provider.addScope('admin:repo');
  provider.addScope('read:project');
  provider.addScope('read:org');
  provider.addScope('read:email');

  // Optionally force re-consent to allow selecting organization access, etc.
  provider.setCustomParameters({ allow_signup: 'true' });

  try {
    const result: UserCredential = await signInWithPopup(auth, provider);
    // GitHub OAuth access token
    // @ts-ignore - token is on the credential's accessToken in providerData
    const credential: any = GithubAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    // Basic user info
    const user = result.user;

    // Fetch GitHub profile via API to get canonical name, login, avatar, and email
    let githubProfile: any = null;
    let finalEmail: string | null = null;
    if (accessToken) {
      try {
        const resp = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `token ${accessToken}`,
            Accept: 'application/vnd.github+json'
          }
        });
        if (resp.ok) {
          githubProfile = await resp.json();

          // Prefer email from profile; if missing, fetch /user/emails
          finalEmail = githubProfile.email ?? null;
          if (!finalEmail) {
            try {
              const eResp = await fetch('https://api.github.com/user/emails', {
                headers: {
                  Authorization: `token ${accessToken}`,
                  Accept: 'application/vnd.github+json'
                }
              });
              if (eResp.ok) {
                const emails = await eResp.json();
                const primary = emails.find((em: any) => em.primary && em.verified) || emails.find((em: any) => em.verified) || emails[0];
                finalEmail = primary?.email ?? null;
              }
            } catch (ee) {
              console.warn('Failed to fetch GitHub emails', ee);
            }
          }

          // Update Firebase profile with GitHub name/login and avatar
          try {
            const displayName = githubProfile.name || githubProfile.login;
            const photoURL = githubProfile.avatar_url;
            if (displayName || photoURL) {
              await updateProfile(user, { displayName: displayName ?? undefined, photoURL: photoURL ?? undefined });
            }
          } catch (e) {
            console.warn('Failed to update Firebase profile from GitHub data', e);
          }
        } else {
          console.warn('Failed to fetch GitHub profile', resp.status, resp.statusText);
        }
      } catch (e) {
        console.warn('Error fetching GitHub profile', e);
      }
    }

    // Persist token and email locally for UI convenience (dev only). For production, handle tokens server-side.
    try {
      if (accessToken) localStorage.setItem('github_access_token', accessToken);
      if (finalEmail) localStorage.setItem('github_email', finalEmail);
    } catch (e) {
      console.warn('Failed to persist github token/email to localStorage', e);
    }

    // Store in Firestore for Cloud Functions to access
    if (accessToken && user) {
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('./firestore');
        
        await setDoc(doc(db, 'users', user.uid), {
          githubToken: accessToken,
          email: finalEmail,
          displayName: user.displayName,
          photoURL: user.photoURL,
          githubProfile: githubProfile,
          updatedAt: new Date(),
        });
      } catch (e) {
        console.warn('Failed to store GitHub token in Firestore', e);
      }
    }

    return { accessToken, user, githubProfile, email: finalEmail };
  } catch (error) {
    console.error('GitHub sign-in failed', error);
    throw error;
  }
}

export function onAuthStateChanged(callback: (user: any | null) => void) {
  return fbOnAuthStateChanged(auth, callback);
}

export async function signOutUser() {
  // remove token from localStorage
  try {
    localStorage.removeItem('github_access_token');
    localStorage.removeItem('github_email');
  } catch (e) {
    console.warn('Failed to remove github_access_token from localStorage', e);
  }
  return fbSignOut(auth);
}

export async function updateDisplayName(name: string) {
  if (!auth.currentUser) throw new Error('No authenticated user');
  return updateProfile(auth.currentUser, { displayName: name });
}

// Debug function to check GitHub token status
export async function checkGitHubTokenStatus() {
  const user = auth.currentUser;
  if (!user) {
    console.log('No user logged in');
    return { hasUser: false, hasToken: false };
  }

  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('./firestore');
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    
    const hasToken = !!userData?.githubToken;
    console.log('GitHub token status:', {
      hasUser: true,
      hasToken,
      tokenLength: userData?.githubToken?.length || 0,
      userExists: userDoc.exists(),
      userData: userData ? Object.keys(userData) : null
    });
    
    return { hasUser: true, hasToken, userData };
  } catch (error) {
    console.error('Error checking GitHub token status:', error);
    return { hasUser: true, hasToken: false, error: error.message };
  }
}

/**
 * Manually clear GitHub OAuth cache
 * - Opens GitHub settings to revoke DevYntra access
 * - Then re-authenticates
 */
export async function forceManualGitHubReauth() {
  // Open GitHub application settings in a new tab
  window.open('https://github.com/settings/connections/applications', '_blank');
  
  // Show instructions
  alert(
    'Please follow these steps:\n\n' +
    '1. In the GitHub settings tab that just opened, find "DevYntra" or "devyntra-500e4"\n' +
    '2. Click "Revoke" to remove cached permissions\n' +
    '3. Close the tab and click OK to continue\n' +
    '4. You will be asked to re-authorize with fresh permissions'
  );
  
  // After they return, attempt re-authentication
  return await reauthorizeWithGitHub();
}

export { auth };

/**
 * clearGitHubSession
 * - Clears the cached GitHub session token from localStorage and Firestore
 */
export async function clearGitHubSession() {
  try {
    // Clear from localStorage
    localStorage.removeItem('github_access_token');
    localStorage.removeItem('github_email');
    
    // Clear from Firestore if user is logged in
    if (auth.currentUser) {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('./firestore');
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        githubToken: null,
        updatedAt: new Date(),
      });
    }
    
    console.log('GitHub session cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing GitHub session:', error);
    throw error;
  }
}

/**
 * reauthorizeWithGitHub
 * - Forces a re-authentication with GitHub to request organization access.
 * - Completely clears browser cache and signs out to ensure fresh authorization.
 */
export async function reauthorizeWithGitHub() {
  try {
    console.log('Starting re-authorization: NUCLEAR OPTION - clearing EVERYTHING...');
    
    // Clear GitHub session from storage
    await clearGitHubSession();
    
    // Get the current user before signing out
    const currentUser = auth.currentUser;
    
    // Sign out from Firebase Auth FIRST to clear cached OAuth session
    if (currentUser) {
      console.log('Step 1: Signing out from Firebase Auth...');
      await fbSignOut(auth);
      console.log('Signed out successfully');
    }
    
    // Wait for sign-out to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // NOW clear all Firebase auth state from browser storage
    try {
      console.log('Step 2: Clearing ALL browser storage...');
      sessionStorage.clear();
      localStorage.clear();
      console.log('Browser storage completely cleared');
      
      // Also clear any IndexedDB that might have Firebase auth data
      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases();
          for (const db of databases) {
            if (db.name?.includes('firebase')) {
              await new Promise((resolve) => {
                const deleteReq = indexedDB.deleteDatabase(db.name!);
                deleteReq.onsuccess = () => resolve(true);
                deleteReq.onerror = () => resolve(false);
              });
            }
          }
          console.log('Firebase IndexedDB cleared');
        } catch (e) {
          console.warn('Could not clear IndexedDB', e);
        }
      }
    } catch (e) {
      console.warn('Failed to clear some browser storage', e);
    }
    
    // Wait a bit more to ensure everything is cleared
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const provider = new GithubAuthProvider();

    // Request the scopes needed for deployment
    provider.addScope('user');
    provider.addScope('repo');
    provider.addScope('workflow');
    provider.addScope('admin:repo_hook');
    provider.addScope('admin:repo');
    provider.addScope('read:project');
    provider.addScope('read:org');
    provider.addScope('read:email');

    // Force re-consent and disable account selection from cache
    provider.setCustomParameters({
      prompt: 'consent',
      // Add a timestamp to force bypass cache
      timestamp: Date.now().toString(),
    });

    console.log('Requesting fresh GitHub authorization (bypassing cache)...');
    
    // Create a fresh provider instance with cache busting
    const freshProvider = new GithubAuthProvider();
    freshProvider.addScope('user');
    freshProvider.addScope('repo');
    freshProvider.addScope('workflow');
    freshProvider.addScope('admin:repo_hook');
    freshProvider.addScope('admin:repo');
    freshProvider.addScope('read:project');
    freshProvider.addScope('read:org');
    freshProvider.addScope('read:email');
    freshProvider.setCustomParameters({
      prompt: 'consent',
      _t: Date.now().toString(),
    });
    
    // Use popup but clear OAuth session cookie first
    // Note: We can't directly clear HTTP-only cookies, but Firebase should handle this
    const result: UserCredential = await signInWithPopup(auth, freshProvider);
    const credential: any = GithubAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;
    const user = result.user;

    if (accessToken) {
      console.log('GitHub access token obtained, storing...');
      
      // Update the token in localStorage for immediate use
      localStorage.setItem('github_access_token', accessToken);

      // Update the token in Firestore for backend services
      if (user) {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('./firestore');
        await setDoc(doc(db, 'users', user.uid), {
          githubToken: accessToken,
        }, { merge: true });
      }
      
      console.log('GitHub re-authorization completed successfully');
    }

    return { accessToken, user };
    
  } catch (error: any) {
    console.error('GitHub re-authorization failed', error);
    
    // If redirect is not appropriate, fall back to popup with error handling
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      throw new Error('Please enable popups and try again');
    }
    
    throw error;
  }
}
