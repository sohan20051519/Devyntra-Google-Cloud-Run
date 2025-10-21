import React from 'react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-on-background font-sans flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary mb-4">Devyntra</h1>
        <p className="text-lg text-on-surface-variant mb-8">AI-Powered Deployments</p>
        <div className="bg-surface p-8 rounded-lg shadow-lg">
          <p className="text-on-surface">Application is working!</p>
          <p className="text-sm text-on-surface-variant mt-2">Firebase backend deployed successfully</p>
        </div>
      </div>
    </div>
  );
};

export default App;