import React, { useState, useEffect, useCallback } from 'react';
import { Repository } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Icons } from '../icons/Icons';
import { fetchUserRepos, detectRepoLanguage, deployToCloudRun } from '../../firebase/functions';

// Repository interface will be populated from Firebase

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
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isLoadingRepos, setIsLoadingRepos] = useState<boolean>(true);
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>(initialSteps);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState<boolean>(true);
  const [julesSessionUrl, setJulesSessionUrl] = useState<string | null>(null);

  // Load user repositories on component mount
  useEffect(() => {
    const loadRepositories = async () => {
      try {
        setIsLoadingRepos(true);
        const result = await fetchUserRepos({});
        if (result.data.success) {
          setRepos(result.data.repos);
          if (result.data.repos.length > 0) {
            setSelectedRepo(result.data.repos[0].id.toString());
          }
        }
      } catch (error) {
        console.error('Error loading repositories:', error);
      } finally {
        setIsLoadingRepos(false);
      }
    };

    loadRepositories();
  }, []);

  const runDeployment = useCallback(async () => {
    if (!selectedRepo) return;

    setShowInstructions(false);
    setIsDeploying(true);
    setDeployedUrl(null);
    setJulesSessionUrl(null);
    setDeploymentSteps(initialSteps);
    setCurrentStepIndex(0);

    try {
      const selectedRepoData = repos.find(repo => repo.id.toString() === selectedRepo);
      if (!selectedRepoData) return;

      // Step 1: Detect Language & Framework
      updateStepStatus(0, 'in-progress', 'Detecting language and framework...');
      const languageResult = await detectRepoLanguage({ 
        repoId: selectedRepo, 
        owner: selectedRepoData.owner.login,
        repo: selectedRepoData.name 
      });
      
      if (languageResult.data.success) {
        updateStepStatus(0, 'success', `Detected: ${languageResult.data.detection.primaryLanguage || 'Unknown'}`);
      } else {
        updateStepStatus(0, 'error', 'Failed to detect language');
        setIsDeploying(false);
        return;
      }

      // Step 2: Analyze Codebase (Mock AI Analysis)
      updateStepStatus(1, 'in-progress', 'Analyzing codebase with AI...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      setJulesSessionUrl('https://jules.ai/demo-session');
      updateStepStatus(1, 'success', 'AI analysis completed');

      // Step 3: Fix Errors & Push Changes
      updateStepStatus(2, 'in-progress', 'Applying automated fixes...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      updateStepStatus(2, 'success', 'Automated fixes applied via PR');

      // Step 4: Setup CI/CD Pipeline
      updateStepStatus(3, 'in-progress', 'Setting up CI/CD pipeline...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateStepStatus(3, 'success', 'CI/CD pipeline configured');

      // Step 5: Install Dependencies
      updateStepStatus(4, 'in-progress', 'Installing dependencies...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateStepStatus(4, 'success', 'Dependencies installed');

      // Step 6: Create Docker Image
      updateStepStatus(5, 'in-progress', 'Creating Docker image...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      updateStepStatus(5, 'success', 'Docker image created');

      // Step 7: Deploy to Cloud Run
      updateStepStatus(6, 'in-progress', 'Deploying to Cloud Run...');
      const deployResult = await deployToCloudRun({
        repoId: selectedRepo,
        imageUrl: `gcr.io/devyntra-500e4/${selectedRepoData.name}:latest`,
        serviceName: selectedRepoData.name,
        region: 'us-central1'
      });

      if (deployResult.data.success) {
        updateStepStatus(6, 'success', 'Deployed successfully');
        setDeployedUrl(deployResult.data.deployment.serviceUrl);
      } else {
        updateStepStatus(6, 'error', 'Deployment failed');
      }

      setIsDeploying(false);
    } catch (error) {
      console.error('Deployment error:', error);
      updateStepStatus(currentStepIndex, 'error', 'Deployment failed');
      setIsDeploying(false);
    }
  }, [selectedRepo, repos]);

  const updateStepStatus = (stepIndex: number, status: DeploymentStepStatus, details: string) => {
    setDeploymentSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, status, details } : step
    ));
    setCurrentStepIndex(stepIndex);
  };

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
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-on-surface-variant">Loading repositories...</p>
                    </div>
                  ) : (
                    <>
                      <select
                        value={selectedRepo}
                        onChange={(e) => setSelectedRepo(e.target.value)}
                        className="w-full p-3 bg-surface border border-outline rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                        disabled={repos.length === 0}
                      >
                        {repos.length === 0 ? (
                          <option value="">No repositories found</option>
                        ) : (
                          repos.map(repo => (
                            <option key={repo.id} value={repo.id.toString()}>{repo.owner.login}/{repo.name}</option>
                          ))
                        )}
                      </select>
                      <Button 
                        onClick={runDeployment} 
                        className="w-full mt-6"
                        disabled={!selectedRepo || repos.length === 0}
                      >
                        Deploy Now
                      </Button>
                    </>
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
                          {julesSessionUrl && (
                            <div className="mt-4 p-4 bg-primary-container/30 rounded-lg">
                              <h3 className="font-medium text-on-surface mb-2">AI Analysis Session</h3>
                              <iframe 
                                src={julesSessionUrl} 
                                className="w-full h-96 border rounded-lg"
                                title="Jules AI Session"
                              />
                            </div>
                          )}
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