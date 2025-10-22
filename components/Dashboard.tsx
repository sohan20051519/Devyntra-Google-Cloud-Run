import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import OverviewPage from './pages/OverviewPage';
import NewDeploymentPage from './pages/NewDeploymentPage';
import DeploymentsPage from './pages/DeploymentsPage';
import DevAIPage from './pages/DevAIPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';
import DeploymentDetailsPage from './pages/DeploymentDetailsPage';
import { Page, Deployment, Repository, DeploymentLog } from '../types';
import { Icons } from './icons/Icons';
import { db, functions } from '../services/firebase';
import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from 'firebase/functions';
import { auth } from '../services/firebase';

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [activePage, setActivePage] = useState<Page>(Page.Overview);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<string | null>(null);

  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLog[]>([]);
  const [dashboardData, setDashboardData] = useState<any>({});

  useEffect(() => {
    if (!auth.currentUser) return;

    const deploymentsUnsubscribe = onSnapshot(collection(db, "users", auth.currentUser.uid, "deployments"), (snapshot) => {
      const deployments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Deployment[];
      setDeployments(deployments);
    });

    const reposUnsubscribe = onSnapshot(collection(db, "users", auth.currentUser.uid, "repositories"), (snapshot) => {
      const repositories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Repository[];
      setRepositories(repositories);
    });

    const getDashboardData = httpsCallable(functions, 'getDashboardData');
    getDashboardData().then((result) => {
      setDashboardData(result.data);
    });

    return () => {
      deploymentsUnsubscribe();
      reposUnsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedDeployment || !auth.currentUser) return;

    const logsUnsubscribe = onSnapshot(collection(db, "users", auth.currentUser.uid, "deployments", selectedDeployment.id, "logs"), (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DeploymentLog[];
      setDeploymentLogs(logs);
    });

    return () => {
      logsUnsubscribe();
    };
  }, [selectedDeployment]);

  const handleDeploy = (repoId: string) => {
    const selectedRepo = repositories.find(repo => repo.id === repoId);
    if (selectedRepo) {
      const startDeployment = httpsCallable(functions, 'startDeployment');
      startDeployment({ repoName: selectedRepo.name });
    }
  };

  const handleRollback = (deploymentId: string) => {
    const rollbackDeployment = httpsCallable(functions, 'rollbackDeployment');
    rollbackDeployment({ deploymentId });
  };

  const handleDelete = (deploymentId: string) => {
    const deleteDeployment = httpsCallable(functions, 'deleteDeployment');
    deleteDeployment({ deploymentId });
  };

  const handleRedeploy = (deploymentId: string) => {
    const redeploy = httpsCallable(functions, 'redeploy');
    redeploy({ deploymentId });
  };

  const handleViewDeploymentDetails = (deployment: Deployment) => {
    setSelectedDeployment(deployment);
    setActivePage(Page.DeploymentDetails);
    setLogFilter(null);
  };

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
        return <OverviewPage
          totalDeployments={dashboardData.totalDeployments}
          successfulBuilds={dashboardData.successfulBuilds}
          failedBuilds={dashboardData.failedBuilds}
          connectedRepos={dashboardData.connectedRepos}
          weeklyActivity={dashboardData.weeklyActivity}
          recentActivity={dashboardData.recentActivity}
        />;
      case Page.NewDeployment:
        return <NewDeploymentPage repositories={repositories} onDeploy={handleDeploy} />;
      case Page.Deployments:
        return <DeploymentsPage 
          deployments={deployments}
          onViewDetails={handleViewDeploymentDetails} 
          onNewDeployment={() => handleGoToPage(Page.NewDeployment)}
          onViewLogs={handleViewLogs} 
        />;
      case Page.DeploymentDetails:
        return selectedDeployment 
          ? <DeploymentDetailsPage 
              deployment={selectedDeployment} 
              logs={deploymentLogs}
              onBack={handleBackToDeployments}
              onViewLogs={handleViewLogs}
              onRollback={handleRollback}
              onDelete={handleDelete}
              onRedeploy={handleRedeploy}
            /> 
          : <DeploymentsPage 
              deployments={deployments}
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
        <div className="max-w-7xl mx-auto w-full flex-1 min-h-0">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
