
import React, { useState, useCallback } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const handleLogin = useCallback(() => {
    setIsAuthenticated(true);
  }, []);
  
  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-background font-sans">
      {isAuthenticated ? (
        <Dashboard onLogout={handleLogout} />
      ) : (
        <LandingPage onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
