import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  GithubAuthProvider,
  OAuthCredential
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './config';

// GitHub Auth Provider
const githubProvider = new GithubAuthProvider();
githubProvider.addScope('repo');
githubProvider.addScope('read:user');
githubProvider.addScope('user:email');

// Firebase Functions
const completeGitHubAuth = httpsCallable(functions, 'completeGitHubAuth');
const getGitHubProfile = httpsCallable(functions, 'getGitHubProfile');

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

export interface AuthUser extends User {
  githubUser?: GitHubUser;
}

// Sign in with GitHub
export const signInWithGitHub = async (): Promise<AuthUser> => {
  try {
    const result = await signInWithPopup(auth, githubProvider);
    const credential = result.credential as OAuthCredential;
    
    if (credential.accessToken) {
      // Complete GitHub Auth with the access token
      const authResult = await completeGitHubAuth({ 
        code: credential.accessToken 
      });
      
      // Store GitHub user data
      if (authResult.data.success && authResult.data.githubUser) {
        (result.user as AuthUser).githubUser = authResult.data.githubUser;
      }
    }
    
    return result.user as AuthUser;
  } catch (error) {
    console.error('GitHub sign-in error:', error);
    throw error;
  }
};

// Sign out
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign-out error:', error);
    throw error;
  }
};

// Get current user's GitHub profile
export const getCurrentGitHubProfile = async (): Promise<GitHubUser | null> => {
  try {
    if (!auth.currentUser) {
      return null;
    }

    const result = await getGitHubProfile({});
    
    if (result.data.success && result.data.githubUser) {
      return result.data.githubUser;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting GitHub profile:', error);
    return null;
  }
};

// Auth state change listener
export const onAuthStateChange = (callback: (user: AuthUser | null) => void) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const authUser = user as AuthUser;
      
      // Try to get GitHub profile if not already loaded
      if (!authUser.githubUser) {
        try {
          const githubProfile = await getCurrentGitHubProfile();
          if (githubProfile) {
            authUser.githubUser = githubProfile;
          }
        } catch (error) {
          console.error('Error loading GitHub profile:', error);
        }
      }
      
      callback(authUser);
    } else {
      callback(null);
    }
  });
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!auth.currentUser;
};

// Get current user
export const getCurrentUser = (): AuthUser | null => {
  return auth.currentUser as AuthUser | null;
};
