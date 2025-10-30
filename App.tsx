
import React, { useState, useCallback, useEffect, useRef } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import { onAuthStateChanged, signOutUser } from './services/firebase';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<any | null>(null);
  const [authInitializing, setAuthInitializing] = useState<boolean>(true);

  const loggingOutRef = useRef(false);
  useEffect(() => {
    const unsub = onAuthStateChanged((u) => {
      // If we're in the middle of logout, ignore transient auth events
      if (loggingOutRef.current) {
        if (!u) {
          // once confirmed signed out, allow events again
          loggingOutRef.current = false;
        } else {
          return;
        }
      }
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
    loggingOutRef.current = true;
    try {
      await signOutUser();
    } catch (e) {
      console.error('Sign out failed', e);
    }
    setUser(null);
    setIsAuthenticated(false);
    setAuthInitializing(false);
    try { window.location.hash = ''; } catch {}
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
