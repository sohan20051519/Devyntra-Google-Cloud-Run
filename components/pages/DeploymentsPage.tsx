import React from 'react';
import { Deployment } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Icons } from '../icons/Icons';

const mockDeployments: Deployment[] = [
  { id: '1', repoName: 'project-phoenix', status: 'Deployed', url: 'https://project-phoenix-xyz123.run.app', deployedAt: '2 minutes ago', branch: 'main', commitHash: 'a1b2c3d' },
  { id: '2', repoName: 'web-app-v2', status: 'Deployed', url: 'https://web-app-v2-abc456.run.app', deployedAt: '1 day ago', branch: 'main', commitHash: 'e4f5g6h' },
  { id: '3', repoName: 'mobile-landing', status: 'Failed', url: '-', deployedAt: '3 days ago', branch: 'feature/new-design', commitHash: 'i7j8k9l' },
  { id: '4', repoName: 'api-gateway', status: 'Building', url: '-', deployedAt: '5 minutes ago', branch: 'develop', commitHash: 'm0n1o2p' },
];

interface DeploymentsPageProps {
  onViewDetails: (deployment: Deployment) => void;
  onNewDeployment: () => void;
}

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

const DeploymentCard: React.FC<{ deployment: Deployment; onViewDetails: (deployment: Deployment) => void; }> = ({ deployment, onViewDetails }) => (
  <Card className="mb-4">
    <div className="flex justify-between items-start">
      <span className="font-medium text-on-surface">{deployment.repoName}</span>
      <StatusBadge status={deployment.status} />
    </div>
    <div className="mt-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-on-surface-variant">URL:</span>
        {deployment.url !== '-' ? (
          <a href={deployment.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{deployment.url}</a>
        ) : (
          <span className="text-on-surface-variant">-</span>
        )}
      </div>
      <div className="flex justify-between">
        <span className="text-on-surface-variant">Deployed At:</span>
        <span className="text-on-surface-variant">{deployment.deployedAt}</span>
      </div>
    </div>
    <div className="mt-4 pt-4 border-t border-outline/20 flex gap-2 justify-end">
        <Button variant="text" className="px-3 py-1 h-auto text-xs" onClick={() => onViewDetails(deployment)}>Manage</Button>
        <Button variant="text" className="px-3 py-1 h-auto text-xs" onClick={() => onViewDetails(deployment)}>Logs</Button>
    </div>
  </Card>
);

const DeploymentsPage: React.FC<DeploymentsPageProps> = ({ onViewDetails, onNewDeployment }) => {
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
      
      <div className="flex-1 overflow-y-auto">
        {/* Mobile View: List of Cards */}
        <div className="md:hidden">
          {mockDeployments.map(dep => <DeploymentCard key={dep.id} deployment={dep} onViewDetails={onViewDetails} />)}
        </div>

        {/* Desktop View: Table */}
        <Card className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-outline/30">
              <tr>
                <th className="p-4 text-sm font-medium text-on-surface-variant">Repository</th>
                <th className="p-4 text-sm font-medium text-on-surface-variant">Status</th>
                <th className="p-4 text-sm font-medium text-on-surface-variant">URL</th>
                <th className="p-4 text-sm font-medium text-on-surface-variant">Deployed At</th>
                <th className="p-4 text-sm font-medium text-on-surface-variant">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockDeployments.map((dep) => (
                <tr key={dep.id} className="border-b border-outline/20 last:border-b-0 hover:bg-surface-variant/30">
                  <td className="p-4 font-medium text-on-surface">{dep.repoName}</td>
                  <td className="p-4"><StatusBadge status={dep.status} /></td>
                  <td className="p-4">
                    {dep.url !== '-' ? (
                      <a href={dep.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{dep.url}</a>
                    ) : (
                      <span className="text-on-surface-variant">-</span>
                    )}
                  </td>
                  <td className="p-4 text-on-surface-variant">{dep.deployedAt}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Button variant="text" className="px-2 py-1 h-auto text-xs" onClick={() => onViewDetails(dep)}>Manage</Button>
                      <Button variant="text" className="px-2 py-1 h-auto text-xs" onClick={() => onViewDetails(dep)}>Logs</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
};

export default DeploymentsPage;