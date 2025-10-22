import React from 'react';
import { Deployment } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Icons } from '../icons/Icons';
import { Globe, GitCommit, GitBranch } from 'lucide-react';

const mockDeploymentLogs = [
    { id: '1', time: '2 minutes ago', message: 'Deployment successful. Service is live.' },
    { id: '2', time: '3 minutes ago', message: 'Finalizing deployment and running health checks.' },
    { id: '3', time: '4 minutes ago', message: 'Pushing image to Google Cloud Registry.' },
    { id: '4', time: '5 minutes ago', message: 'Successfully built docker image.' },
    { id: '5', time: '6 minutes ago', message: 'Build process started.' },
];

const StatusBadge: React.FC<{ status: Deployment['status'] }> = ({ status }) => {
  const baseClasses = 'px-3 py-1 text-xs font-medium rounded-full inline-flex items-center gap-1.5';
  switch (status) {
    case 'Deployed':
      return <span className={`${baseClasses} bg-green-100 text-green-800`}><Icons.CheckCircle size={12} />Deployed</span>;
    case 'Building':
      return <span className={`${baseClasses} bg-blue-100 text-blue-800`}><Icons.Spinner size={12} className="animate-spin" />Building</span>;
    case 'Failed':
      return <span className={`${baseClasses} bg-error-container text-on-error-container`}><Icons.XCircle size={12} />Failed</span>;
    default:
      return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>;
  }
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

const DeploymentDetailsPage: React.FC<{ deployment: Deployment; onBack: () => void; onViewLogs: (deployment: Deployment) => void; }> = ({ deployment, onBack, onViewLogs }) => {
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
                            <StatusBadge status={deployment.status}/>
                        </div>
                    </div>
                    <div className="mt-4 sm:mt-0 flex gap-2">
                        {deployment.url !== '-' && (
                            <a href={deployment.url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outlined">Visit Site</Button>
                            </a>
                        )}
                        <Button variant="filled">Redeploy</Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Content */}
                  <div className="lg:col-span-2 space-y-6">
                      <Card>
                          <h2 className="text-xl font-medium text-on-surface mb-4 border-b border-outline/30 pb-3">Deployment Details</h2>
                          <div className="divide-y divide-outline/20">
                              <InfoItem icon={<Globe size={16}/>} label="Live URL" value={deployment.url !== '-' ? <a href={deployment.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{deployment.url}</a> : '-'}/>
                              <InfoItem icon={<GitBranch size={16}/>} label="Branch" value={deployment.branch} />
                              <InfoItem icon={<GitCommit size={16}/>} label="Commit" value={<span className="font-mono text-xs">{deployment.commitHash}</span>} />
                              <InfoItem icon={<Icons.Deployments size={16}/>} label="Deployed At" value={deployment.deployedAt} />
                          </div>
                      </Card>

                      <Card>
                          <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-medium text-on-surface">Activity Logs</h2>
                            <Button variant="text" onClick={() => onViewLogs(deployment)}>View all logs <Icons.ArrowRight size={14} className="ml-1"/></Button>
                          </div>
                          <div className="font-mono text-sm bg-inverse-surface text-inverse-on-surface rounded-lg p-4 overflow-x-auto">
                              {mockDeploymentLogs.map(log => (
                                  <div key={log.id} className="flex">
                                      <span className="text-inverse-on-surface/50 mr-4 whitespace-nowrap">{log.time}</span>
                                      <p className="break-words text-inverse-on-surface">{log.message}</p>
                                  </div>
                              ))}
                          </div>
                      </Card>
                  </div>

                  {/* Sidebar */}
                  <div className="lg:col-span-1 space-y-6">
                      <Card>
                          <h2 className="text-xl font-medium text-on-surface mb-4">Manage</h2>
                          <div className="space-y-2">
                              <Button variant="outlined" className="w-full">Rollback to Previous Version</Button>
                              <Button variant="outlined" className="w-full">View GitHub Actions</Button>
                              <Button variant="outlined" className="border-error text-error hover:bg-error-container w-full mt-4">Delete Deployment</Button>
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