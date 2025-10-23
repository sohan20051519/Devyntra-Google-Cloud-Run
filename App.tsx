
import React, { useState, useCallback, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import { onAuthStateChanged, signOutUser } from './services/firebase';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<any | null>(null);
  const [authInitializing, setAuthInitializing] = useState<boolean>(true);

  useEffect(() => {
    const unsub = onAuthStateChanged((u) => {
      setUser(u);
      setIsAuthenticated(!!u);
      setAuthInitializing(false);
    });
    return () => unsub();
  }, []);

  const handleLogin = useCallback(() => {
    // no-op: auth state listener will flip authenticated state after sign-in
  }, []);
  
  const handleLogout = useCallback(async () => {
    try {
      await signOutUser();
    } catch (e) {
      console.error('Sign out failed', e);
    }
    // auth listener will update isAuthenticated and user
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-background font-sans">
      {authInitializing ? (
        <div className="min-h-screen flex items-center justify-center">Loading...</div>
      ) : isAuthenticated ? (
        <Dashboard onLogout={handleLogout} userProp={user} />
      ) : (
        <LandingPage onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
