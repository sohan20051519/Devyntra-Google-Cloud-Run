import React, { useState, useEffect, useCallback } from 'react';
import { Repository } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Icons } from '../icons/Icons';
import { fetchUserRepos } from '../../services/github';

const mockRepos: Repository[] = [
  { id: '1', name: 'project-phoenix', owner: 'john-doe', url: '', lastUpdate: '2 hours ago' },
  { id: '2', name: 'web-app-v2', owner: 'john-doe', url: '', lastUpdate: '1 day ago' },
  { id: '3', name: 'mobile-landing', owner: 'john-doe', url: '', lastUpdate: '3 days ago' },
];

type DeploymentStepStatus = 'pending' | 'in-progress' | 'success' | 'error';

interface DeploymentStep {
  name: string;
  status: DeploymentStepStatus;
  details: string;
  icon: React.ReactNode;
}

const initialSteps: DeploymentStep[] = [
  { name: 'Detect Language & Framework', status: 'pending', details: 'Waiting to start...', icon: <Icons.Code size={24} /> },
  { name: 'Analyze Codebase', status: 'pending', details: 'Waiting for detection...', icon: <Icons.DevAI size={24} /> },
  { name: 'Fix Errors & Push Changes', status: 'pending', details: 'Waiting for analysis...', icon: <Icons.Wrench size={24} /> },
  { name: 'Setup CI/CD Pipeline', status: 'pending', details: 'Waiting for fixes...', icon: <Icons.GitHub size={24} /> },
  { name: 'Install Dependencies', status: 'pending', details: 'Waiting for pipeline...', icon: <Icons.Package size={24} /> },
  { name: 'Create Docker Image', status: 'pending', details: 'Waiting for dependencies...', icon: <Icons.Box size={24} /> },
  { name: 'Deploy to Cloud Run', status: 'pending', details: 'Waiting for image...', icon: <Icons.NewDeployment size={24} /> },
];

const DeploymentStepView: React.FC<{ step: DeploymentStep; isActive: boolean }> = ({ step, isActive }) => {
  const getStatusClasses = () => {
    switch(step.status) {
      case 'in-progress': return 'text-primary animate-pulse';
      case 'success': return 'text-green-600';
      case 'error': return 'text-error';
      default: return 'text-outline';
    }
  }

  return (
    <div className={`flex items-start gap-4 p-4 transition-all duration-300 ${isActive ? 'bg-primary-container/50 rounded-lg' : ''}`}>
      <div className={`p-3 rounded-full bg-surface ${getStatusClasses()}`}>
        {step.status === 'in-progress' ? <Icons.Spinner size={24} className="animate-spin" /> : step.icon}
      </div>
      <div>
        <h3 className={`font-medium ${step.status !== 'pending' ? 'text-on-surface' : 'text-on-surface-variant'}`}>{step.name}</h3>
        <p className="text-sm text-on-surface-variant">{step.details}</p>
      </div>
       <div className="ml-auto">
        {step.status === 'success' && <Icons.CheckCircle size={24} className="text-green-600" />}
        {step.status === 'error' && <Icons.XCircle size={24} className="text-error" />}
      </div>
    </div>
  )
}


const NewDeploymentPage: React.FC = () => {
  const [repos, setRepos] = useState<Repository[] | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>(initialSteps);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState<boolean>(true);

  const runDeployment = useCallback(() => {
    setShowInstructions(false);
    setIsDeploying(true);
    setDeployedUrl(null);
    setDeploymentSteps(initialSteps);
    setCurrentStepIndex(0);
  }, []);

  useEffect(() => {
    if (!isDeploying || currentStepIndex >= deploymentSteps.length) {
        if(currentStepIndex >= deploymentSteps.length) {
            setIsDeploying(false);
            setDeployedUrl(`https://project-phoenix-xyz123.run.app`);
        }
      return;
    }

    // Mark current step as in-progress
    setDeploymentSteps(prev => prev.map((step, index) => 
        index === currentStepIndex ? { ...step, status: 'in-progress', details: 'Working on it...' } : step
    ));
    
    // Simulate async work
    const timer = setTimeout(() => {
      // Mark current step as success
       setDeploymentSteps(prev => prev.map((step, index) => 
        index === currentStepIndex ? { ...step, status: 'success', details: 'Completed successfully.' } : step
      ));
      // Move to next step
      setCurrentStepIndex(prev => prev + 1);
    }, 1500 + Math.random() * 1000);

    return () => clearTimeout(timer);
  }, [isDeploying, currentStepIndex, deploymentSteps.length]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoadingRepos(true);
      setReposError(null);
      try {
        const fetched = await fetchUserRepos();
        if (!mounted) return;
        setRepos(fetched);
        setSelectedRepo(fetched[0]?.id ?? null);
      } catch (err: any) {
        console.error('Failed to fetch repos', err);
        setReposError(err?.message ?? String(err));
      } finally {
        setIsLoadingRepos(false);
      }
    };
    load();
    return () => { mounted = false };
  }, []);

  return (
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="flex-shrink-0">
        <h1 className="text-3xl font-bold text-on-background mb-2">New Deployment</h1>
        <p className="text-on-surface-variant mb-8 text-center md:text-left">
          {deployedUrl 
              ? 'Your application has been successfully deployed!'
              : isDeploying 
                  ? 'Your deployment is in progress...' 
                  : 'Select a repository to begin the automated deployment process.'
          }
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="flex justify-center">
          <div className="w-full max-w-2xl">
            {/* Show selection card if not deploying and not complete */}
            {!isDeploying && !deployedUrl && (
              <div className="animate-fade-in-up">
                <Card className="p-6">
                  <h2 className="text-lg font-medium text-on-surface mb-4">Repository Selection</h2>
                  {isLoadingRepos ? (
                    <div className="p-4 text-center">Loading repositories...</div>
                  ) : reposError ? (
                    <div className="p-4 text-center text-error">Error: {reposError}</div>
                  ) : repos && repos.length > 0 ? (
                    <select
                      value={selectedRepo ?? ''}
                      onChange={(e) => setSelectedRepo(e.target.value)}
                      className="w-full p-3 bg-surface border border-outline rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                      {repos.map(repo => (
                        <option key={repo.id} value={repo.id}>{repo.owner}/{repo.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-4 text-center">No repositories found. Connect a GitHub account or check permissions.</div>
                  )}
                  <Button onClick={runDeployment} className="w-full mt-6">
                    Deploy Now
                  </Button>
                </Card>
                <div
                  className={`mt-4 text-center text-sm text-on-surface-variant transition-opacity duration-500 ${
                    showInstructions ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <p>Select a repository and click 'Deploy Now'.</p>
                  <p>Devyntra's AI will handle the entire process from analysis to live deployment.</p>
                </div>
              </div>
            )}

            {/* Show progress/result if deploying or deployment is complete */}
            {(isDeploying || deployedUrl) && (
              <div className="animate-fade-in-up">
                {deployedUrl && (
                  <Card className="p-6 mb-8">
                      <div className="text-center">
                          <Icons.CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
                          <h2 className="text-xl font-medium text-on-surface mb-2">Deployment Complete!</h2>
                          <p className="text-on-surface-variant mb-4">Your application is now live.</p>
                          <div className="flex items-center justify-center p-2 rounded-lg bg-surface-variant gap-4">
                              <a href={deployedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{deployedUrl}</a>
                              <button onClick={() => navigator.clipboard.writeText(deployedUrl)} className="text-on-surface-variant hover:text-primary">
                                  <Icons.Copy size={16} />
                              </button>
                          </div>
                      </div>
                  </Card>
                )}

                <Card>
                    <div className="p-4 border-b border-outline/30">
                        <h2 className="text-lg font-medium text-on-surface">
                          {deployedUrl ? 'Deployment Summary' : 'Deployment Progress'}
                        </h2>
                    </div>
                    <div className="p-4 space-y-2">
                        {deploymentSteps.map((step, index) => (
                            <DeploymentStepView key={step.name} step={step} isActive={index === currentStepIndex && isDeploying} />
                        ))}
                    </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewDeploymentPage;