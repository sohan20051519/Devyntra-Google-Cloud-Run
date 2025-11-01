import React, { useEffect, useMemo, useState } from 'react';
import { Deployment } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Icons } from '../icons/Icons';
import { watchDeployment } from '../../services/firestore';
import { Globe, GitCommit, GitBranch } from 'lucide-react';
import { redeploy, rollback, deriveServiceName, deleteDeployment, deleteService, setAutoRedeploy } from '../../services/firestore';
import ConfirmationModal from '../ui/ConfirmationModal';
import InlineAlert from '../ui/InlineAlert';

const mockDeploymentLogs: string[] = [];

const StatusBadge: React.FC<{ status: Deployment['status'] }> = ({ status }) => {
  const baseClasses = 'px-3 py-1 text-xs font-medium rounded-full inline-flex items-center gap-1.5';
  if (status === 'deployed') return <span className={`${baseClasses} bg-green-100 text-green-800`}><Icons.CheckCircle size={12} />Deployed</span>;
  if (status === 'failed') return <span className={`${baseClasses} bg-error-container text-on-error-container`}><Icons.XCircle size={12} />Failed</span>;
  return <span className={`${baseClasses} bg-blue-100 text-blue-800`}><Icons.Spinner size={12} className="animate-spin" />{status.replace(/_/g,' ')}</span>;
};

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string | React.ReactNode }> = ({ icon, label, value }) => (
    <div className="flex flex-col sm:flex-row justify-between sm:items-center text-sm py-3">
        <div className="flex items-center text-on-surface-variant mb-1 sm:mb-0">
            {icon}
            <span className="ml-2">{label}</span>
        </div>
        <div className="font-medium text-on-surface text-left sm:text-right">{value}</div>
    </div>
)

const DeploymentDetailsPage: React.FC<{ deployment: Deployment; onBack: () => void; onViewLogs: (deployment: Deployment) => void; onRedeploy: (deploymentId: string) => void; }> = ({ deployment, onBack, onViewLogs, onRedeploy }) => {
    const [busy, setBusy] = useState<'idle' | 'redeploy' | 'rollback' | 'delete' | 'auto'>('idle');
    const [liveStatus, setLiveStatus] = useState<Deployment['status'] | undefined>(deployment.status);
    const [liveMessage, setLiveMessage] = useState<string | undefined>(undefined);
    const [liveUrl, setLiveUrl] = useState<string | undefined>(deployment.deploymentUrl || undefined);
    const [liveSubstep, setLiveSubstep] = useState<string | undefined>(undefined);
    const [liveLogs, setLiveLogs] = useState<string[]>([]);
    const [autoRedeployEnabled, setAutoRedeployEnabled] = useState<boolean>(Boolean((deployment as any)?.autoRedeployEnabled));
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
    const [showRedeployConfirm, setShowRedeployConfirm] = useState<boolean>(false);
    const [showRollbackConfirm, setShowRollbackConfirm] = useState<boolean>(false);
    const [showToggleAutoConfirm, setShowToggleAutoConfirm] = useState<boolean>(false);
    const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string } | null>(null);

    const actionsUrl = `https://github.com/${deployment.repoOwner}/${deployment.repoName}/actions/workflows/deploy-cloudrun.yml`;
    const serviceName = deployment.cloudRunServiceName || deriveServiceName(deployment.repoName);
    const effectiveId = deployment.id || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') || undefined : undefined);

    useEffect(() => {
      if (!effectiveId) return;
      const unsubscribe = watchDeployment(String(effectiveId), (d) => {
        if (!d) return;
        if (d.status) setLiveStatus(d.status);
        if (typeof d.message === 'string') setLiveMessage(d.message);
        if (typeof d.deploySubstep === 'string') setLiveSubstep(d.deploySubstep);
        if (typeof d.deploymentUrl === 'string' && d.deploymentUrl) setLiveUrl(d.deploymentUrl);
        if (typeof (d as any).autoRedeployEnabled === 'boolean') setAutoRedeployEnabled(Boolean((d as any).autoRedeployEnabled));
        if (Array.isArray(d.logs) && d.logs.length) {
          setLiveLogs(prev => {
            const existing = new Set(prev);
            const add = d.logs.slice(-10).filter(l => !existing.has(l));
            return add.length ? [...prev, ...add] : prev;
          });
        }
      });
      return () => { try { unsubscribe(); } catch {} };
    }, [effectiveId]);

    const handleRedeploy = async () => {
      try {
        setBusy('redeploy');
        await redeploy(deployment.repoOwner, deployment.repoName);
        onRedeploy(deployment.id);
      } catch (e:any) {
        setBanner({ type: 'error', message: `Redeploy failed: ${e?.message || e}` });
      } finally {
        setBusy('idle');
      }
    };

    const handleToggleAutoRedeploy = async () => {
      try {
        setBusy('auto');
        const res = await setAutoRedeploy(deployment.id, deployment.repoOwner, deployment.repoName, !autoRedeployEnabled);
        setAutoRedeployEnabled(Boolean(res.enabled));
        setBanner({ type: 'success', message: res.enabled ? 'Auto redeploy enabled. New pushes to the default branch will redeploy automatically.' : 'Auto redeploy disabled.' });
      } catch (e:any) {
        setBanner({ type: 'error', message: `Auto redeploy toggle failed: ${e?.message || e}` });
      } finally {
        setBusy('idle');
      }
    };

    const handleRollback = async () => {
      try {
        setBusy('rollback');
        const res = await rollback(deployment.repoOwner, deployment.repoName, serviceName);
        if (res.ok) {
          if (res.deploymentUrl) window.open(res.deploymentUrl, '_blank');
          setBanner({ type: 'success', message: 'Rollback triggered to previous revision.' });
        } else {
          setBanner({ type: 'error', message: 'Rollback request failed.' });
        }
      } catch (e:any) {
        setBanner({ type: 'error', message: `Rollback failed: ${e?.message || e}` });
      } finally {
        setBusy('idle');
      }
    };

    const handleDeleteConfirmed = async () => {
      try {
        setBusy('delete');
        setShowDeleteConfirm(false);
        // Delete Cloud Run service first
        await deleteService(deployment.repoOwner, deployment.repoName, serviceName);
        // Then remove record from Firestore
        await deleteDeployment(deployment.id);
        setBanner({ type: 'success', message: 'Cloud Run service deleted and deployment record removed.' });
        onBack();
      } catch (e:any) {
        setBanner({ type: 'error', message: `Delete failed: ${e?.message || e}` });
      } finally {
        setBusy('idle');
      }
    };

    const isAutoInProgress = autoRedeployEnabled && (liveStatus === 'analyzing' || liveStatus === 'fixing' || liveStatus === 'deploying');
    const displayStatus = liveUrl && liveStatus !== 'failed' ? 'deployed' : (liveStatus || deployment.status);

    return (
      <div className="flex flex-col h-full animate-fade-in-up">

            {/* Header */}
            <div className="flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
                    <div>
                        <Button variant="text" onClick={onBack} className="mb-2 -ml-4">
                            <Icons.ArrowLeft size={16} className="mr-2"/> Back to Deployments
                        </Button>
                        <div className="flex items-center gap-4">
                            <h1 className="text-3xl font-bold text-on-background">{deployment.repoName}</h1>
                            <StatusBadge status={displayStatus}/>
                            {isAutoInProgress && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary-container text-on-primary-container">
                                <Icons.Spinner size={12} className="animate-spin" /> Auto redeploying…
                              </span>
                            )}
                        </div>
                    </div>
                    <div className="mt-4 sm:mt-0 flex gap-2">
                        {deployment.deploymentUrl && (
                            <a href={deployment.deploymentUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="outlined">Visit Site</Button>
                            </a>
                        )}
                        <Button variant="outlined" disabled={busy!=='idle'} onClick={() => setShowToggleAutoConfirm(true)}>{busy==='auto' ? (autoRedeployEnabled ? 'Disabling...' : 'Enabling...') : (autoRedeployEnabled ? 'Disable Auto Redeploy' : 'Enable Auto Redeploy')}</Button>
                        <Button variant="filled" disabled={busy!=='idle'} onClick={() => setShowRedeployConfirm(true)}>{busy==='redeploy' ? 'Redeploying...' : 'Redeploy'}</Button>
                    </div>
                </div>
            </div>
            {banner && (
              <div className="mb-4">
                <InlineAlert type={banner.type} message={banner.message} onClose={() => setBanner(null)} />
              </div>
            )}
            <ConfirmationModal
              isOpen={showDeleteConfirm}
              onClose={() => setShowDeleteConfirm(false)}
              onConfirm={handleDeleteConfirmed}
              title="Delete Deployment"
              message="Delete this Cloud Run service and remove the deployment record? This action is irreversible."
              confirmText="Delete"
              confirmVariant="filled"
              confirmClassName="bg-error text-white"
            />
            <ConfirmationModal
              isOpen={showRedeployConfirm}
              onClose={() => setShowRedeployConfirm(false)}
              onConfirm={async () => { setShowRedeployConfirm(false); await handleRedeploy(); }}
              title="Trigger Redeploy"
              message="Start a new deploy run for this project?"
              confirmText="Redeploy"
              confirmVariant="filled"
            />
            <ConfirmationModal
              isOpen={showRollbackConfirm}
              onClose={() => setShowRollbackConfirm(false)}
              onConfirm={async () => { setShowRollbackConfirm(false); await handleRollback(); }}
              title="Rollback Service"
              message="Rollback Cloud Run service to the previous revision?"
              confirmText="Rollback"
              confirmVariant="filled"
            />
            <ConfirmationModal
              isOpen={showToggleAutoConfirm}
              onClose={() => setShowToggleAutoConfirm(false)}
              onConfirm={async () => { setShowToggleAutoConfirm(false); await handleToggleAutoRedeploy(); }}
              title={autoRedeployEnabled ? 'Disable Auto Redeploy' : 'Enable Auto Redeploy'}
              message={autoRedeployEnabled ? 'Turn off auto redeploy for pushes to default branch?' : 'Enable auto redeploy on pushes to the default branch?'}
              confirmText={autoRedeployEnabled ? 'Disable' : 'Enable'}
              confirmVariant="filled"
            />
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Content */}
                  <div className="lg:col-span-2 space-y-6">
                      <Card>
                          <h2 className="text-xl font-medium text-on-surface mb-4 border-b border-outline/30 pb-3">Deployment Details</h2>
                          <div className="divide-y divide-outline/20">
                              <InfoItem icon={<Globe size={16}/>} label="Live URL" value={liveUrl ? <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{liveUrl}</a> : '-'} />
                              <InfoItem icon={<GitBranch size={16}/>} label="Service" value={serviceName} />
                              <InfoItem icon={<Icons.Deployments size={16}/>} label="Status" value={displayStatus + (liveSubstep ? ` • ${liveSubstep}` : '')} />
                              {liveMessage && (
                                <div className="text-sm text-on-surface-variant mt-2">{liveMessage}</div>
                              )}

                          </div>
                      </Card>

                      <Card>
                          <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-medium text-on-surface">Activity Logs</h2>
                            {isAutoInProgress && (
                              <span className="inline-flex items-center gap-1 text-sm text-on-surface-variant">
                                <Icons.Spinner size={14} className="animate-spin" /> Auto redeploying
                              </span>
                            )}
                            <Button variant="text" onClick={() => onViewLogs(deployment)}>View all logs <Icons.ArrowRight size={14} className="ml-1"/></Button>
                          </div>
                          <div className="font-mono text-sm bg-inverse-surface text-inverse-on-surface rounded-lg p-4 overflow-x-auto">
                              {liveLogs && liveLogs.length > 0 ? (
                                liveLogs.map((line, idx) => {
                                  const cls = (() => {
                                    if (/❌|failed/i.test(line)) return 'text-red-400';
                                    if (/⚠️|warn/i.test(line)) return 'text-yellow-400';
                                    if (
                                      /✅/.test(line) ||
                                      /🔔/.test(line) ||
                                      /Setup complete/.test(line) ||
                                      /Analyze complete/.test(line) ||
                                      /Fix Issues skipped/.test(line) ||
                                      /Fix Issues complete with jules/.test(line) ||
                                      /auto create ci\/cd pipeline and deployed with docker using gcp/.test(line)
                                    ) return 'text-green-400';
                                    return 'text-inverse-on-surface';
                                  })();
                                  return (
                                    <div key={idx} className="flex">
                                      <span className="text-inverse-on-surface/50 mr-4 whitespace-nowrap">•</span>
                                      <p className={`break-words ${cls}`}>{line}</p>
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-inverse-on-surface/70">Waiting for logs...</p>
                              )}
                          </div>
                      </Card>
                  </div>

                  {/* Sidebar */}
                  <div className="lg:col-span-1 space-y-6">
                      <Card>
                          <h2 className="text-xl font-medium text-on-surface mb-4">Manage</h2>
                          <div className="space-y-2">
                              <Button variant="outlined" className="w-full" disabled={busy!=='idle'} onClick={() => setShowRollbackConfirm(true)}>{busy==='rollback' ? 'Rolling back...' : 'Rollback to Previous Version'}</Button>
                              <Button variant="outlined" className="w-full" onClick={() => window.open(actionsUrl, '_blank')}>View GitHub Actions</Button>
                              <Button variant="outlined" className="border-error text-error hover:bg-error-container w-full mt-4" disabled={busy!=='idle'} onClick={() => setShowDeleteConfirm(true)}>{busy==='delete' ? 'Deleting...' : 'Delete Deployment (Service + Record)'}</Button>
                          </div>
                      </Card>

                      <Card>
                          <h2 className="text-xl font-medium text-on-surface mb-4">Environment Variables</h2>
                          <p className="text-sm text-on-surface-variant mb-4">These are available to your application at runtime.</p>
                          <div className="space-y-2 text-xs font-mono">
                            <p><span className="text-on-surface-variant">DATABASE_URL:</span> <span className="text-on-surface">********</span></p>
                            <p><span className="text-on-surface-variant">NODE_ENV:</span> <span className="text-on-surface">production</span></p>
                          </div>
                          <Button variant="text" className="w-full mt-4">Edit Variables</Button>
                      </Card>
                  </div>
              </div>
            </div>
        </div>
    );
}

export default DeploymentDetailsPage;