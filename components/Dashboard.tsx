import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import OverviewPage from './pages/OverviewPage';
import NewDeploymentPage from './pages/NewDeploymentPage';
import DeploymentsPage from './pages/DeploymentsPage';
import DevAIPage from './pages/DevAIPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';
import DeploymentDetailsPage from './pages/DeploymentDetailsPage';
import { Page, Deployment } from '../types';
import { getDeploymentById } from '../services/firestore';
import { Icons } from './icons/Icons';

interface DashboardProps {
  onLogout: () => void;
  userProp: any | null;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout, userProp }) => {
  const [activePage, setActivePage] = useState<Page>(Page.Overview);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<string | null>(null);

  const handleViewDeploymentDetails = (deployment: Deployment) => {
    setSelectedDeployment(deployment);
    setActivePage(Page.DeploymentDetails);
    setLogFilter(null);
  };

  // Basic hash routing to support deep links and in-page navigation
  useEffect(() => {
    const applyRoute = async () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const [path, query] = hash.replace(/^#\/?/, '').split('?');
      const params = new URLSearchParams(query || '');
      if (path === 'deployments') {
        const id = params.get('id');
        if (id) {
          const dep = await getDeploymentById(id);
          if (dep) {
            setSelectedDeployment(dep as any);
            setActivePage(Page.DeploymentDetails);
            return;
          }
        }
        setSelectedDeployment(null);
        setActivePage(Page.Deployments);
        return;
      }
      if (path === 'new' || path === 'new-deployment') {
        setSelectedDeployment(null);
        setActivePage(Page.NewDeployment);
        return;
      }
      if (path === 'overview') {
        setSelectedDeployment(null);
        setActivePage(Page.Overview);
        return;
      }
    };
    applyRoute();
    const onHash = () => { applyRoute(); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const handleBackToDeployments = () => {
    setSelectedDeployment(null);
    setActivePage(Page.Deployments);
    setLogFilter(null);
  };

  const handleViewLogs = (deployment: Deployment) => {
    setLogFilter(deployment.repoName);
    setActivePage(Page.Logs);
    setSelectedDeployment(null);
  };

  const handleGoToPage = (page: Page) => {
    setActivePage(page);
    setSelectedDeployment(null);
    setLogFilter(null); // Always clear filter on generic navigation
  };

  const renderContent = () => {
    switch (activePage) {
      case Page.Overview:
        return <OverviewPage />;
      case Page.NewDeployment:
        return <NewDeploymentPage />;
      case Page.Deployments:
        return <DeploymentsPage 
          onViewDetails={handleViewDeploymentDetails} 
          onNewDeployment={() => handleGoToPage(Page.NewDeployment)}
          onViewLogs={handleViewLogs} 
        />;
      case Page.DeploymentDetails:
        return selectedDeployment 
          ? <DeploymentDetailsPage 
              deployment={selectedDeployment} 
              onBack={handleBackToDeployments}
              onViewLogs={handleViewLogs}
            /> 
          : <DeploymentsPage 
              onViewDetails={handleViewDeploymentDetails} 
              onNewDeployment={() => handleGoToPage(Page.NewDeployment)}
              onViewLogs={handleViewLogs}
            />;
      case Page.DevAI:
        return <DevAIPage />;
      case Page.Logs:
        return <LogsPage 
          filterRepo={logFilter} 
          onClearFilter={() => setLogFilter(null)} 
        />;
      case Page.Settings:
        return <SettingsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="flex h-screen bg-surface">
      <Sidebar 
        activePage={activePage} 
        setActivePage={handleGoToPage} 
        onLogout={onLogout}
        isOpen={isSidebarOpen}
        setIsOpen={setSidebarOpen}
        userProp={userProp}
      />
      <main className="flex-1 flex flex-col p-4 md:p-8 bg-background overflow-y-hidden">
        <header className="md:hidden flex-shrink-0 flex justify-between items-center mb-4 pb-4 border-b border-outline/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary rounded-md">
              <Icons.Code size={20} className="text-on-primary" />
            </div>
            <h1 className="text-lg font-bold text-primary">Devyntra</h1>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-on-background">
            <Icons.Menu size={24} />
          </button>
        </header>
        <div className="w-full flex-1 min-h-0">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;