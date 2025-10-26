import React, { useState, useEffect, useCallback } from 'react';
import { Repository } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Icons } from '../icons/Icons';
import { fetchUserRepos, checkRepoPermission } from '../../services/github';
import { startDeployment, watchDeployment } from '../../services/firestore';
import { checkGitHubTokenStatus, signInWithGitHub } from '../../services/firebase';

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
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [githubTokenStatus, setGithubTokenStatus] = useState<{ hasUser: boolean; hasToken: boolean } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState<boolean>(false);

  const runDeployment = useCallback(async () => {
    if (!selectedRepo || !repos) return;
    
    const selectedRepoData = repos.find(repo => repo.id === selectedRepo);
    if (!selectedRepoData) return;

    setShowInstructions(false);
    setIsDeploying(true);
    setDeployedUrl(null);
    setDeploymentSteps(initialSteps);
    setCurrentStepIndex(0);

    try {
      console.log('Starting deployment for:', selectedRepoData);
      // Call real Cloud Function
      const result = await startDeployment(selectedRepoData.id, selectedRepoData.owner, selectedRepoData.name);
      console.log('Deployment started successfully:', result);
      setDeploymentId(result.deploymentId);
    } catch (error) {
      console.error('Failed to start deployment:', error);
      setIsDeploying(false);
      
      // Show more detailed error information
      let errorMessage = 'Deployment failed: ';
      if (error.message) {
        errorMessage += error.message;
      } else if (typeof error === 'string') {
        errorMessage += error;
      } else {
        errorMessage += 'Unknown error occurred';
      }
      
      // Show error in a more user-friendly way
      alert(errorMessage);
    }
  }, [selectedRepo, repos]);

  // Check GitHub token status
  const checkTokenStatus = useCallback(async () => {
    try {
      const status = await checkGitHubTokenStatus();
      setGithubTokenStatus(status);
      console.log('GitHub token status:', status);
    } catch (error) {
      console.error('Error checking GitHub token status:', error);
    }
  }, []);

  // Re-authenticate with GitHub
  const reAuthenticateGitHub = useCallback(async () => {
    try {
      await signInWithGitHub();
      await checkTokenStatus();
      alert('GitHub authentication successful! You can now deploy.');
    } catch (error) {
      console.error('GitHub re-authentication failed:', error);
      alert('GitHub authentication failed. Please try again.');
    }
  }, [checkTokenStatus]);

  // Watch deployment progress in real-time
  useEffect(() => {
    if (!deploymentId) return;

    const unsubscribe = watchDeployment(deploymentId, (deployment) => {
      console.log('Received deployment update:', deployment);
      if (!deployment) {
        console.log('No deployment data received');
        return;
      }

      // Update steps based on deployment status
      let newSteps = [...deploymentSteps];
      let newCurrentStepIndex = currentStepIndex;

      switch (deployment.status) {
        case 'detecting_language':
          newSteps[0] = { ...newSteps[0], status: 'in-progress', details: deployment.message };
          newCurrentStepIndex = 0;
          break;
        case 'analyzing':
          newSteps[0] = { ...newSteps[0], status: 'success', details: 'Language detected' };
          newSteps[1] = { ...newSteps[1], status: 'in-progress', details: deployment.message };
          newCurrentStepIndex = 1;
          break;
        case 'fixing':
          newSteps[0] = { ...newSteps[0], status: 'success', details: 'Language detected' };
          newSteps[1] = { ...newSteps[1], status: 'success', details: 'Analysis complete' };
          newSteps[2] = { ...newSteps[2], status: 'in-progress', details: deployment.message };
          newCurrentStepIndex = 2;
          break;
        case 'deploying':
          newSteps[0] = { ...newSteps[0], status: 'success', details: 'Language detected' };
          newSteps[1] = { ...newSteps[1], status: 'success', details: 'Analysis complete' };
          newSteps[2] = { ...newSteps[2], status: 'success', details: 'Fixes applied' };
          newSteps[3] = { ...newSteps[3], status: 'in-progress', details: 'Setting up CI/CD pipeline...' };
          newSteps[4] = { ...newSteps[4], status: 'in-progress', details: 'Installing dependencies...' };
          newSteps[5] = { ...newSteps[5], status: 'in-progress', details: 'Creating Docker image...' };
          newSteps[6] = { ...newSteps[6], status: 'in-progress', details: deployment.message };
          newCurrentStepIndex = 6;
          break;
        case 'deployed':
          newSteps = newSteps.map(step => ({ ...step, status: 'success', details: 'Completed successfully' }));
          // Only set URL if we have a real deployment URL
          if (deployment.deploymentUrl) {
            setDeployedUrl(deployment.deploymentUrl);
          }
          setIsDeploying(false);
          break;
        case 'failed':
          // Mark the current step as failed and show error details
          if (newCurrentStepIndex < newSteps.length) {
            newSteps[newCurrentStepIndex] = { ...newSteps[newCurrentStepIndex], status: 'error', details: deployment.message };
          }
          // Also show any error details from the deployment
          if (deployment.errors && deployment.errors.length > 0) {
            console.error('Deployment errors:', deployment.errors);
          }
          setIsDeploying(false);
          break;
      }

      setDeploymentSteps(newSteps);
      setCurrentStepIndex(newCurrentStepIndex);
    });

    return () => unsubscribe();
  }, [deploymentId]);

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

  // Check GitHub token status on mount
  useEffect(() => {
    checkTokenStatus();
  }, [checkTokenStatus]);

  // Check for admin permissions when selected repo changes
  useEffect(() => {
    if (selectedRepo && repos) {
      const repoData = repos.find(r => r.id === selectedRepo);
      if (repoData) {
        setIsCheckingAdmin(true);
        checkRepoPermission(repoData.owner, repoData.name)
          .then(({ isAdmin }) => {
            setIsAdmin(isAdmin);
          })
          .catch(err => {
            console.error('Error checking repo permission', err);
            setIsAdmin(false); // Default to false on error
          })
          .finally(() => {
            setIsCheckingAdmin(false);
          });
      }
    }
  }, [selectedRepo, repos]);

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
        
        {/* GitHub Authentication Status - Only show when not authenticated and not deploying */}
        {githubTokenStatus && !githubTokenStatus.hasToken && !isDeploying && (
          <Card className="mb-6">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icons.GitHub size={24} className="text-on-surface" />
                  <div>
                    <h3 className="text-lg font-medium text-on-surface">GitHub Authentication</h3>
                    <p className="text-sm text-on-surface-variant">
                      ❌ Not connected - Please authenticate to deploy
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={reAuthenticateGitHub}
                  variant="primary"
                  size="sm"
                >
                  Connect GitHub
                </Button>
              </div>
            </div>
          </Card>
        )}
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
                  <Button onClick={runDeployment} className="w-full mt-6" disabled={!isAdmin || isCheckingAdmin}>
                    {isCheckingAdmin ? 'Checking permissions...' : 'Deploy Now'}
                  </Button>

                  {!isCheckingAdmin && !isAdmin && repos && repos.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-error-container/20 text-on-error-container text-sm">
                      <p className="font-medium">Admin Permissions Required</p>
                      <p>
                        You need admin access to this repository to deploy it. Please ask a repository owner to grant you admin permissions.
                      </p>
                    </div>
                  )}
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
            {(isDeploying || deployedUrl || (deploymentId && !isDeploying && !deployedUrl)) && (
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

                {/* Show failure message if deployment failed */}
                {deploymentId && !isDeploying && !deployedUrl && deploymentSteps.some(step => step.status === 'error') && (
                  <Card className="p-6 mb-8">
                      <div className="text-center">
                          <Icons.XCircle size={48} className="text-error mx-auto mb-4" />
                          <h2 className="text-xl font-medium text-on-surface mb-2">Deployment Failed</h2>
                          <p className="text-on-surface-variant mb-4">The deployment encountered an error. Please check the details below and try again.</p>
                          <div className="text-left bg-error-container/20 p-4 rounded-lg">
                              <p className="text-sm text-error font-medium mb-2">Common causes:</p>
                              <ul className="text-sm text-on-surface-variant list-disc list-inside space-y-1">
                                  <li><strong>Automatic setup failed:</strong> DevYntra tried to configure secrets automatically but encountered an issue</li>
                                  <li><strong>Repository permissions:</strong> Ensure DevYntra has admin access to your repository</li>
                                  <li><strong>Build errors:</strong> TypeScript errors, missing dependencies, or lockfile issues</li>
                                  <li><strong>GitHub API limits:</strong> Check if you've hit GitHub API rate limits</li>
                              </ul>
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