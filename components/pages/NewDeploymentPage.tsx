import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Repository } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Icons } from '../icons/Icons';
import { fetchUserRepos, checkRepoPermission, getRepoLanguages } from '../../services/github';
import { startDeployment, watchDeployment, cancelDeployment, getDeployments } from '../../services/firestore';
import { checkGitHubTokenStatus, signInWithGitHub, reauthorizeWithGitHub, forceManualGitHubReauth, auth } from '../../services/firebase';
import { Deployment } from '../../types';
import Terminal from '../ui/Terminal';
import ConfirmationModal from '../ui/ConfirmationModal';
import InlineAlert from '../ui/InlineAlert';

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

// Configuration for the simulated deployment steps, including their duration in milliseconds
const deploymentStepConfig = [
  { name: 'Setup', duration: 7000, icon: <Icons.Key size={24} /> },       // 7 seconds
  { name: 'Analyze', duration: 60000, icon: <Icons.DevAI size={24} /> },    // 1 minute
  { name: 'Fix Issues', duration: 1000, icon: <Icons.Wrench size={24} /> },   // 1 second
  { name: 'Deploy', duration: 76000, icon: <Icons.NewDeployment size={24} /> }, // 1 minute 16 seconds
  { name: 'Complete', duration: 1000, icon: <Icons.CheckCircle size={24} /> }, // 1 second
];

// Generate the initial state for the steps from the configuration
const initialSteps: DeploymentStep[] = deploymentStepConfig.map(step => ({
  name: step.name,
  status: 'pending',
  details: '',
  icon: step.icon,
}));

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
  const [currentDeployment, setCurrentDeployment] = useState<Deployment | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string } | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<Array<{id: string, timestamp: string, message: string, type: 'info' | 'success' | 'error' | 'warning'}>>([]);

  // Refs for simulation
  const simulationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deploymentUrlRef = useRef<string | null>(null);
  const hasFailedRef = useRef<boolean>(false);
  const completionCardRef = useRef<HTMLDivElement>(null);

  const addTerminalLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setTerminalLogs(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
        message,
        type,
      }
    ]);
  };

  const runDeployment = useCallback(async () => {
    if (!selectedRepo || !repos) return;
    
    const selectedRepoData = repos.find(repo => repo.id === selectedRepo);
    if (!selectedRepoData) return;

    // Prevent duplicate deployments for same repo: attach to existing instead
    try {
      if (auth?.currentUser) {
        const existing = await getDeployments(auth.currentUser.uid);
        const match = existing.find(d => d.repoOwner === selectedRepoData.owner && d.repoName === selectedRepoData.name);
        if (match) {
          if (['starting','injecting_secrets','detecting_language','analyzing','fixing','deploying'].includes(match.status)) {
            setDeploymentId(match.id);
            setIsDeploying(true);
            localStorage.setItem('active_deployment_id', match.id);
            setBanner({ type: 'info', message: 'This project is already deploying. Resuming progress view.' });
            return;
          }
          if (match.status === 'deployed') {
            setDeploymentId(match.id);
            setDeployedUrl(match.deploymentUrl || null);
            setBanner({ type: 'info', message: 'Project is already deployed. Opening management page.' });
            try { window.location.hash = `#/deployments?id=${match.id}`; } catch {}
            return;
          }
        }
      }
    } catch {}

    setShowInstructions(false);

    // Reset simulation state
    setDeploymentSteps(initialSteps.map(s => ({ ...s, status: 'pending' })));
    setCurrentStepIndex(0);
    setDeployedUrl(null);
    setTerminalLogs([]);
    deploymentUrlRef.current = null;
    hasFailedRef.current = false;
    if (simulationTimeoutRef.current) {
      clearTimeout(simulationTimeoutRef.current);
    }

    setIsDeploying(true); // This will trigger the simulation controller effect

    try {
      console.log('Starting deployment for:', selectedRepoData);
      // Call real Cloud Function
      const result = await startDeployment(selectedRepoData.id, selectedRepoData.owner, selectedRepoData.name);
      console.log('Deployment started successfully:', result);
      setDeploymentId(result.deploymentId);
      try { localStorage.setItem('active_deployment_id', result.deploymentId); } catch {}
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
      setBanner({ type: 'error', message: errorMessage });
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

  // Simulation Controller
  useEffect(() => {
    if (!isDeploying) {
      if (simulationTimeoutRef.current) {
        clearTimeout(simulationTimeoutRef.current);
      }
      return;
    }

    let currentStep = 0;
    const runSimulationStep = async () => {
      if (hasFailedRef.current) {
        addTerminalLog('Deployment failed!', 'error');
        return;
      }

      // Update UI for the current step
      setDeploymentSteps(prev => {
        const newSteps = [...prev];
        if (currentStep > 0) {
          newSteps[currentStep - 1] = { ...newSteps[currentStep - 1], status: 'success', details: 'Completed' };
        }
        newSteps[currentStep] = { ...newSteps[currentStep], status: 'in-progress', details: 'In progress...' };
        return newSteps;
      });
      setCurrentStepIndex(currentStep);
      addTerminalLog(`Starting step: ${deploymentStepConfig[currentStep].name}...`);

      // --- Step-specific logic ---
      if (deploymentStepConfig[currentStep].name === 'Setup') {
        // Simulate sub-tasks for Setup
        setTimeout(() => addTerminalLog('Secrets injected successfully.', 'success'), 2000);
        setTimeout(() => addTerminalLog('Docker image created successfully.', 'success'), 4000);
      }

      if (deploymentStepConfig[currentStep].name === 'Analyze') {
        const repoData = repos?.find(r => r.id === selectedRepo);
        if (repoData) {
          try {
            const languages = await getRepoLanguages(repoData.owner, repoData.name);
            addTerminalLog(`Detected languages: ${languages.join(', ')}`, 'info');
          } catch (error) {
            addTerminalLog('Could not fetch repository languages.', 'warning');
          }
        }
      }

      if (deploymentStepConfig[currentStep].name === 'Fix Issues') {
        const isSuccessful = Math.random() > 0.2; // Simulate 80% success rate
        if (isSuccessful) {
          addTerminalLog('No issues found.', 'success');
        } else {
          addTerminalLog('Issues found, attempting to fix with Jules...', 'info');
        }
      }

      if (deploymentStepConfig[currentStep].name === 'Deploy') {
        setTimeout(() => addTerminalLog('Auto-creating CI/CD pipeline...', 'info'), 3000);
      }

      // --- End of step-specific logic ---

      const nextStep = currentStep + 1;
      if (nextStep < deploymentStepConfig.length) {
        simulationTimeoutRef.current = setTimeout(() => {
          currentStep = nextStep;
          runSimulationStep();
        }, deploymentStepConfig[currentStep].duration);
      } else {
        // Last step completed
        simulationTimeoutRef.current = setTimeout(() => {
          if (!hasFailedRef.current) {
            addTerminalLog('All steps completed!', 'success');
            if (deploymentUrlRef.current) {
              addTerminalLog(`Deployment URL: ${deploymentUrlRef.current}`, 'success');
            }
            setDeploymentSteps(prev => {
              const newSteps = [...prev];
              newSteps[newSteps.length - 1] = { ...newSteps[newSteps.length - 1], status: 'success', details: 'Deployment finished' };
              return newSteps;
            });
            setIsDeploying(false);
            setDeployedUrl(deploymentUrlRef.current);
          }
        }, deploymentStepConfig[currentStep].duration);
      }
    };

    runSimulationStep();

    return () => {
      if (simulationTimeoutRef.current) {
        clearTimeout(simulationTimeoutRef.current);
      }
    };
  }, [isDeploying]);

  // Resume active deployment from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('active_deployment_id');
      if (saved && !deploymentId) setDeploymentId(saved);
    } catch {}
  }, []);

  // Firestore listener to handle failures and capture final URL
  useEffect(() => {
    if (!deploymentId) return;

    const unsubscribe = watchDeployment(deploymentId, (data) => {
      if (!data) return;

      setCurrentDeployment(data as any); // Keep for failure message display

      // Capture the URL when it becomes available
      if (data.deploymentUrl) {
        deploymentUrlRef.current = data.deploymentUrl;
      }

      // Handle failure
      if (data.status === 'failed') {
        hasFailedRef.current = true;
        if (simulationTimeoutRef.current) {
          clearTimeout(simulationTimeoutRef.current);
        }
        setIsDeploying(false);

        // Update UI to show the error on the current step
        setDeploymentSteps(prev => {
          const newSteps = [...prev];
          const errorStepIndex = newSteps.findIndex(step => step.status === 'in-progress');
          if (errorStepIndex !== -1) {
            newSteps[errorStepIndex] = {
              ...newSteps[errorStepIndex],
              status: 'error',
              details: data.message || 'Deployment failed',
            };
          }
          return newSteps;
        });

        try { localStorage.removeItem('active_deployment_id'); } catch {}
      }

      // On success, the simulation will handle the state change
    });

    return () => {
      try { unsubscribe(); } catch {}
    };
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

  // Auto-scroll to completion card
  useEffect(() => {
    if (deployedUrl && completionCardRef.current) {
      completionCardRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [deployedUrl]);

  return (
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
          <h1 className="text-3xl font-bold text-on-background">New Deployment</h1>
          <div className="mt-3 md:mt-0 flex items-center gap-2">
            {isDeploying && deploymentId && (
              <Button size="sm" variant="outlined" onClick={() => setShowCancelConfirm(true)}>
                Cancel
              </Button>
            )}
            {deployedUrl && (
              <span className="text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full">Your application has been successfully deployed!</span>
            )}
          </div>
        </div>
        {banner && (
          <div className="mb-4">
            <InlineAlert type={banner.type} message={banner.message} onClose={() => setBanner(null)} />
          </div>
        )}
        <p className="text-on-surface-variant mb-8 text-center md:text-left">
          {deployedUrl 
              ? ''
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
          <div className="w-full max-w-6xl">
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
              <div ref={completionCardRef} className="animate-fade-in-up">
                {deployedUrl && (
                  <Card className="p-6 mb-8">
                      <div className="text-center">
                          <Icons.CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
                          <h2 className="text-xl font-medium text-on-surface mb-2">Deployment Complete!</h2>
                          <p className="text-on-surface-variant mb-4">Your application is now live.</p>
                          <div className="flex flex-col sm:flex-row items-center justify-center p-2 rounded-lg bg-surface-variant gap-4">
                            <div className="flex items-center gap-2">
                              <a href={deployedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{deployedUrl}</a>
                              <button onClick={() => navigator.clipboard.writeText(deployedUrl)} className="text-on-surface-variant hover:text-primary">
                                  <Icons.Copy size={16} />
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              {deploymentId && (
                                <Button size="sm" variant="outlined" onClick={() => { try { window.location.hash = `#/deployments?id=${deploymentId}` } catch {} }}>Manage</Button>
                              )}
                              <Button size="sm" variant="filled" onClick={() => { setDeploymentId(null); setIsDeploying(false); setCurrentDeployment(null); setDeploymentSteps(initialSteps); setCurrentStepIndex(0); setDeployedUrl(null); try { localStorage.removeItem('active_deployment_id'); } catch {}; setBanner(null); }}>Start New Deployment</Button>
                            </div>
                          </div>
                      </div>
                  </Card>
                )}

                {/* Show failure message if deployment failed */}
                {deploymentId && !isDeploying && !deployedUrl && deploymentSteps.some(step => step.status === 'error') && (() => {
                  const needsReauthorization = currentDeployment?.status === 'failed' && (
                    currentDeployment.statusReason?.includes('Failed to automatically setup GitHub secrets') ||
                    currentDeployment.statusReason?.includes('Organization approval required') ||
                    currentDeployment.statusReason?.includes('Repository permissions denied') ||
                    currentDeployment.statusReason?.includes('requires approval')
                  );

                  const handleReauthorize = async () => {
                    try {
                      await reauthorizeWithGitHub();
                      setBanner({ type: 'success', message: 'Re-authorization successful! Please try deploying again.' });
                      // Reset deployment to allow retry
                      setDeploymentId(null);
                      setIsDeploying(false);
                      setCurrentDeployment(null);
                      setDeploymentSteps(initialSteps);
                      setCurrentStepIndex(0);
                    } catch (error) {
                      console.error('Re-authorization failed:', error);
                      setBanner({ type: 'error', message: 'Re-authorization failed. Please try again.' });
                    }
                  };

                  const handleClearCacheAndReauth = async () => {
                    try {
                      await forceManualGitHubReauth();
                      setBanner({ type: 'success', message: 'Cache cleared! Please try deploying again.' });
                      // Reset deployment to allow retry
                      setDeploymentId(null);
                      setIsDeploying(false);
                      setCurrentDeployment(null);
                      setDeploymentSteps(initialSteps);
                      setCurrentStepIndex(0);
                    } catch (error) {
                      console.error('Cache clear failed:', error);
                    }
                  };

                  return (
                    <Card className="p-6 mb-8">
                      <div className="text-center">
                        <Icons.XCircle size={48} className="text-error mx-auto mb-4" />
                        <h2 className="text-xl font-medium text-on-surface mb-2">Deployment Failed</h2>
                        {currentDeployment?.statusReason && (
                          <p className="text-on-surface-variant mb-4">{currentDeployment.statusReason}</p>
                        )}
                        {needsReauthorization ? (
                          <>
                            <p className="text-on-surface-variant mb-4">
                              This appears to be a GitHub permissions issue. If re-authorizing doesn't work due to cached permissions, click the button below to clear the cache first.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
                              <Button
                                variant="filled"
                                onClick={handleReauthorize}
                                icon={<Icons.GitHub size={16} />}
                              >
                                Re-authorize with GitHub
                              </Button>
                              <Button
                                variant="outlined"
                                onClick={handleClearCacheAndReauth}
                                icon={<Icons.Wrench size={16} />}
                              >
                                Clear Cache & Re-authorize
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="text-on-surface-variant mb-4">The deployment encountered an error. Please check the details below and try again.</p>
                        )}
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
                  );
                })()}

                {isDeploying && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Card>
                      <div className="p-4 border-b border-outline/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-lg font-medium text-on-surface">Deployment Terminal</h2>
                            <p className="text-sm text-on-surface-variant">Live deployment logs and progress updates</p>
                          </div>
                </div>
                      </div>
                      <div className="p-4">
                        <Terminal 
                          logs={terminalLogs} 
                          isActive={isDeploying} 
                          className="w-full"
                        />
                      </div>
                    </Card>
                  </div>
            )}
              </div>
            )}
            {/* Jules session iframe when available */}
            {currentDeployment?.julesSessionUrl && (
              <div className="mt-4">
                <Card>
                  <div className="p-4 border-b border-outline/30">
                    <h2 className="text-lg font-medium text-on-surface">AI Fix Session (Jules)</h2>
                    <p className="text-sm text-on-surface-variant">Follow along as issues are being fixed automatically.</p>
                  </div>
                  <div className="p-0">
                    <iframe
                      src={currentDeployment.julesSessionUrl}
                      title="Jules Session"
                      className="w-full"
                      style={{ height: '480px', border: '0' }}
                      allow="clipboard-write; fullscreen"
                    />
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmationModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={async () => { setShowCancelConfirm(false); if (!deploymentId) return; try { await cancelDeployment(deploymentId); } catch (e) { console.error(e); } }}
        title="Cancel Deployment"
        message="Are you sure you want to cancel the current deployment?"
        confirmText="Cancel Deployment"
        confirmVariant="filled"
      />
    </div>
  );
};
export default NewDeploymentPage;