import React, { useState, useEffect } from 'react';
import { Deployment } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Icons } from '../icons/Icons';
import { getDeployments, deleteFailedDeployments, deleteInProgressDeployments } from '../../services/firestore';
import ConfirmationModal from '../ui/ConfirmationModal';
import InlineAlert from '../ui/InlineAlert';
import { formatDeploymentStatus, formatTimestamp } from '../../services/utils';
import { auth, reauthorizeWithGitHub } from '../../services/firebase';

interface DeploymentsPageProps {
  onViewDetails: (deployment: Deployment) => void;
  onNewDeployment: () => void;
  onViewLogs: (deployment: Deployment) => void;
}

const StatusBadge: React.FC<{ status: Deployment['status'] }> = ({ status }) => {
  const baseClasses = 'px-3 py-1 text-xs font-medium rounded-full inline-flex items-center gap-1.5';
  switch (status) {
    case 'deployed':
      return <span className={`${baseClasses} bg-green-100 text-green-800`}><Icons.CheckCircle size={12} />Deployed</span>;
    case 'deploying':
    case 'analyzing':
    case 'fixing':
    case 'detecting_language':
      return <span className={`${baseClasses} bg-blue-100 text-blue-800`}><Icons.Spinner size={12} className="animate-spin" />{formatDeploymentStatus(status)}</span>;
    case 'failed':
      return <span className={`${baseClasses} bg-red-100 text-red-800`}><Icons.XCircle size={12} />Failed</span>;
    default:
      return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{formatDeploymentStatus(status)}</span>;
  }
};

const DeploymentCard: React.FC<{ deployment: Deployment; onViewDetails: (deployment: Deployment) => void; onViewLogs: (deployment: Deployment) => void; onReauthorize: () => void; }> = ({ deployment, onViewDetails, onViewLogs, onReauthorize }) => {
  const needsReauthorization = deployment.status === 'failed' && (
    deployment.statusReason?.includes('Failed to automatically setup GitHub secrets') ||
    deployment.statusReason?.includes('Organization approval required') ||
    deployment.statusReason?.includes('Repository permissions denied') ||
    deployment.statusReason?.includes('requires approval')
  );

  return (
    <Card className="mb-4">
      <div className="flex justify-between items-start">
        <span className="font-medium text-on-surface">{deployment.repoName}</span>
        <StatusBadge status={deployment.status} />
      </div>
      {needsReauthorization && (
        <div className="mt-2 text-xs text-red-700 p-2 bg-red-50 rounded-md">
          <strong>Permission Issue:</strong> {deployment.statusReason || 'Could not set up GitHub secrets. You may need to grant access to your repository or organization.'}
          <Button
            variant="outlined"
            size="sm"
            className="w-full mt-2"
            onClick={onReauthorize}
            icon={<Icons.GitHub size={14} />}
          >
            Re-authorize with GitHub
          </Button>
        </div>
      )}
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Language:</span>
          <span className="text-on-surface-variant">{deployment.language || 'Unknown'}/{deployment.framework || 'Unknown'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">URL:</span>
          {deployment.deploymentUrl ? (
            <a href={deployment.deploymentUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{deployment.deploymentUrl}</a>
          ) : (
            <span className="text-on-surface-variant">-</span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Created:</span>
          <span className="text-on-surface-variant">{formatTimestamp(deployment.createdAt)}</span>
        </div>
        {deployment.prUrl && (
          <div className="flex justify-between">
            <span className="text-on-surface-variant">PR:</span>
            <a href={deployment.prUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">#{deployment.prNumber}</a>
          </div>
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-outline/20 flex gap-2 justify-end">
        <Button variant="text" className="px-3 py-1 h-auto text-xs" onClick={() => onViewDetails(deployment)}>Manage</Button>
        <Button variant="text" className="px-3 py-1 h-auto text-xs" onClick={() => onViewLogs(deployment)}>Logs</Button>
      </div>
    </Card>
  );
};

const DeploymentsPage: React.FC<DeploymentsPageProps> = ({ onViewDetails, onNewDeployment, onViewLogs }) => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reauthorizationStatus, setReauthorizationStatus] = useState<'idle' | 'authorizing' | 'success' | 'error'>('idle');
  const [showClearFailedModal, setShowClearFailedModal] = useState(false);
  const [showClearInProgressModal, setShowClearInProgressModal] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string } | null>(null);

  const loadDeployments = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const userDeployments = await getDeployments(auth.currentUser.uid);
      // De-duplicate by repoOwner/repoName; keep most-recent updatedAt
      const byRepo = new Map<string, Deployment>();
      for (const d of userDeployments) {
        const key = `${d.repoOwner}/${d.repoName}`;
        const prev = byRepo.get(key);
        const dTime = (d.updatedAt as any)?.toDate?.()?.getTime?.() || 0;
        const pTime = (prev as any)?.updatedAt?.toDate?.()?.getTime?.() || 0;
        if (!prev || dTime >= pTime) byRepo.set(key, d);
      }
      setDeployments(Array.from(byRepo.values()));
    } catch (err: any) {
      console.error('Failed to load deployments:', err);
      setError(err.message || 'Failed to load deployments');
    } finally {
      setLoading(false);
    }
  };

  const handleReauthorize = async () => {
    setReauthorizationStatus('authorizing');
    try {
      await reauthorizeWithGitHub();
      setReauthorizationStatus('success');
      // Refresh deployments to reflect any potential fixes
      await loadDeployments();
    } catch (err) {
      console.error('Re-authorization failed:', err);
      setReauthorizationStatus('error');
    }
  };

  const handleClearFailedDeployments = async () => {
    if (!auth.currentUser) return;
    try {
      const count = await deleteFailedDeployments(auth.currentUser.uid);
      setBanner({ type: 'success', message: `Cleared ${count} failed deployment(s).` });
      await loadDeployments();
    } catch (err) {
      console.error('Failed to clear deployments:', err);
      setBanner({ type: 'error', message: 'Failed to clear deployments.' });
    }
  };

  useEffect(() => {
    loadDeployments();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-full animate-fade-in-up">
        <div className="flex-shrink-0">
          <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
            <div className="text-center md:text-left">
                <h1 className="text-3xl font-bold text-on-background">Deployments</h1>
                <p className="text-on-surface-variant mt-1">Manage and monitor all your project deployments.</p>
            </div>
            <Button variant="filled" icon={<Icons.Plus size={16}/>} className="w-full md:w-auto" onClick={onNewDeployment}>New Deployment</Button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Icons.Spinner size={48} className="animate-spin mx-auto mb-4 text-primary" />
            <p className="text-on-surface-variant">Loading deployments...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full animate-fade-in-up">
        <div className="flex-shrink-0">
          <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
            <div className="text-center md:text-left">
                <h1 className="text-3xl font-bold text-on-background">Deployments</h1>
                <p className="text-on-surface-variant mt-1">Manage and monitor all your project deployments.</p>
            </div>
            <Button variant="filled" icon={<Icons.Plus size={16}/>} className="w-full md:w-auto" onClick={onNewDeployment}>New Deployment</Button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Card className="p-6 text-center">
            <Icons.XCircle size={48} className="text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-on-surface mb-2">Error Loading Deployments</h2>
            <p className="text-on-surface-variant mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="flex-shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
          <div className="text-center md:text-left">
              <h1 className="text-3xl font-bold text-on-background">Deployments</h1>
              <p className="text-on-surface-variant mt-1">Manage and monitor all your project deployments.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="filled" icon={<Icons.Plus size={16}/>} className="w-full md:w-auto" onClick={onNewDeployment}>New Deployment</Button>
            {deployments.some(d => d.status === 'failed') && (
              <Button 
                variant="outlined" 
                icon={<Icons.XCircle size={16}/>} 
                className="w-full md:w-auto" 
                onClick={() => setShowClearFailedModal(true)}
              >
                Clear Failed
              </Button>
            )}
            {deployments.some(d => ['starting','injecting_secrets','detecting_language','analyzing','fixing','deploying'].includes(d.status)) && (
              <Button 
                variant="outlined" 
                icon={<Icons.Spinner size={16} className="animate-spin"/>} 
                className="w-full md:w-auto" 
                onClick={() => setShowClearInProgressModal(true)}
              >
                Clear In-Progress
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {banner && (
          <div className="mb-4">
            <InlineAlert type={banner.type} message={banner.message} onClose={() => setBanner(null)} />
          </div>
        )}
        {deployments.length === 0 ? (
          <Card className="p-8 text-center">
            <Icons.NewDeployment size={64} className="text-on-surface-variant mx-auto mb-4" />
            <h2 className="text-xl font-medium text-on-surface mb-2">No Deployments Yet</h2>
            <p className="text-on-surface-variant mb-6">Start by creating your first deployment.</p>
            <Button onClick={onNewDeployment}>Create First Deployment</Button>
          </Card>
        ) : (
          <>
            {/* Reauthorization status message */}
            {reauthorizationStatus === 'success' && (
              <div className="mb-4 p-3 bg-green-100 text-green-800 text-sm rounded-md">
                Successfully re-authorized. Please try deploying again.
              </div>
            )}
            {reauthorizationStatus === 'error' && (
              <div className="mb-4 p-3 bg-red-100 text-red-800 text-sm rounded-md">
                Re-authorization failed. Please try again or contact support.
              </div>
            )}

            {/* Mobile View: List of Cards */}
            <div className="md:hidden">
              {deployments.map(dep => <DeploymentCard key={dep.id} deployment={dep} onViewDetails={onViewDetails} onViewLogs={onViewLogs} onReauthorize={handleReauthorize} />)}
            </div>

            {/* Desktop View: Table */}
            <Card className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-outline/30">
                  <tr>
                    <th className="p-4 text-sm font-medium text-on-surface-variant">Repository</th>
                    <th className="p-4 text-sm font-medium text-on-surface-variant">Language</th>
                    <th className="p-4 text-sm font-medium text-on-surface-variant">Status</th>
                    <th className="p-4 text-sm font-medium text-on-surface-variant">URL</th>
                    <th className="p-4 text-sm font-medium text-on-surface-variant">Created</th>
                    <th className="p-4 text-sm font-medium text-on-surface-variant">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((dep) => {
                    const needsReauthorization = dep.status === 'failed' && (
                      dep.statusReason?.includes('Failed to automatically setup GitHub secrets') ||
                      dep.statusReason?.includes('Organization approval required') ||
                      dep.statusReason?.includes('Repository permissions denied') ||
                      dep.statusReason?.includes('requires approval')
                    );
                    return (
                      <tr key={dep.id} className="border-b border-outline/20 last:border-b-0 hover:bg-surface-variant/30">
                        <td className="p-4 font-medium text-on-surface">{dep.repoName}</td>
                        <td className="p-4 text-on-surface-variant">{dep.language || 'Unknown'}/{dep.framework || 'Unknown'}</td>
                        <td className="p-4">
                          <StatusBadge status={dep.status} />
                          {needsReauthorization && (
                            <p className="mt-1 text-xs text-red-700">Permission issue</p>
                          )}
                        </td>
                        <td className="p-4">
                        {dep.deploymentUrl ? (
                          <a href={dep.deploymentUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{dep.deploymentUrl}</a>
                        ) : (
                          <span className="text-on-surface-variant">-</span>
                        )}
                      </td>
                      <td className="p-4 text-on-surface-variant">{formatTimestamp(dep.createdAt)}</td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {needsReauthorization ? (
                            <Button variant="outlined" size="sm" className="whitespace-nowrap" onClick={handleReauthorize} icon={<Icons.GitHub size={14} />}>
                              Re-authorize
                            </Button>
                          ) : (
                            <>
                              <Button variant="text" className="px-2 py-1 h-auto text-xs" onClick={() => onViewDetails(dep)}>Manage</Button>
                              <Button variant="text" className="px-2 py-1 h-auto text-xs" onClick={() => onViewLogs(dep)}>Logs</Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </div>
    </div>
    <ConfirmationModal
      isOpen={showClearFailedModal}
      onClose={() => setShowClearFailedModal(false)}
      onConfirm={async () => { setShowClearFailedModal(false); await handleClearFailedDeployments(); }}
      title="Clear Failed Deployments"
      message="Clear all failed deployments from Firebase? This will permanently delete them."
      confirmText="Clear Failed"
      confirmVariant="filled"
      confirmClassName="bg-error text-white"
    />
    <ConfirmationModal
      isOpen={showClearInProgressModal}
      onClose={() => setShowClearInProgressModal(false)}
      onConfirm={async () => { setShowClearInProgressModal(false); if (!auth.currentUser) return; try { const n = await deleteInProgressDeployments(auth.currentUser.uid); setBanner({ type: 'success', message: `Cleared ${n} in-progress deployment(s).` }); await loadDeployments(); } catch (e) { setBanner({ type: 'error', message: 'Failed to clear in-progress deployments.' }); } }}
      title="Clear In-Progress Deployments"
      message="This will remove all deployments currently marked as in-progress from the list."
      confirmText="Clear In-Progress"
      confirmVariant="filled"
      confirmClassName="bg-error text-white"
    />
  </>
  );
};

export default DeploymentsPage;