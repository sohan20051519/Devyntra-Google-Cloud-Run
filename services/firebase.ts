import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GithubAuthProvider, UserCredential, onAuthStateChanged as fbOnAuthStateChanged, signOut as fbSignOut, updateProfile } from 'firebase/auth';

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

export { auth };
