import React, { useState, useEffect } from 'react';
import { Log } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Icons } from '../icons/Icons';
import { auth } from '../../services/firebase';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firestore';
import { formatTimestamp } from '../../services/utils';

interface LogsPageProps {
    filterRepo: string | null;
    onClearFilter: () => void;
}

const ActionBadge: React.FC<{ action: string }> = ({ action }) => {
    let colorClasses = 'bg-gray-100 text-gray-800';
    if (action.includes('SUCCESS')) colorClasses = 'bg-green-100 text-green-800';
    if (action.includes('FAIL')) colorClasses = 'bg-error-container text-on-error-container';
    if (action.includes('AI')) colorClasses = 'bg-primary-container text-on-primary-container';
    if (action.includes('REPO')) colorClasses = 'bg-secondary-container text-on-secondary-container';

    return <span className={`px-2 py-0.5 text-xs font-mono rounded ${colorClasses}`}>{action}</span>
}

const LogCard: React.FC<{ log: Log }> = ({ log }) => (
    <Card className="mb-4">
        <div className="flex justify-between items-start mb-2">
            <span className="font-medium text-on-surface">{log.user}</span>
            <ActionBadge action={log.action} />
        </div>
        <p className="text-sm text-on-surface-variant mb-3">{log.details}</p>
        <p className="text-xs text-right text-on-surface-variant/80 font-mono">{formatTimestamp(log.timestamp)}</p>
    </Card>
);

const LogsPage: React.FC<LogsPageProps> = ({ filterRepo, onClearFilter }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const loadLogs = async () => {
      try {
        // Get deployments for the user
        const deploymentsRef = collection(db, 'deployments');
        const q = query(
          deploymentsRef,
          where('userId', '==', auth.currentUser!.uid),
          limit(100)
        );

        const snapshot = await getDocs(q);
        const deploymentLogs: Log[] = [];

        snapshot.docs.forEach(doc => {
          const deployment = doc.data();
          
          // Create logs from deployment data
          if (deployment.logs && Array.isArray(deployment.logs)) {
            deployment.logs.forEach((logMessage: string, index: number) => {
              deploymentLogs.push({
                id: `${doc.id}-log-${index}`,
                timestamp: deployment.createdAt?.toDate ? deployment.createdAt.toDate().toISOString() : new Date().toISOString(),
                user: 'system',
                action: getActionFromLog(logMessage),
                details: logMessage,
                repoName: deployment.repoName
              });
            });
          }

          // Add status change logs
          deploymentLogs.push({
            id: `${doc.id}-status`,
            timestamp: deployment.updatedAt?.toDate ? deployment.updatedAt.toDate().toISOString() : new Date().toISOString(),
            user: 'system',
            action: getActionFromStatus(deployment.status),
            details: getStatusMessage(deployment),
            repoName: deployment.repoName
          });

          // Add error logs
          if (deployment.errors && Array.isArray(deployment.errors)) {
            deployment.errors.forEach((error: string, index: number) => {
              deploymentLogs.push({
                id: `${doc.id}-error-${index}`,
                timestamp: deployment.updatedAt?.toDate ? deployment.updatedAt.toDate().toISOString() : new Date().toISOString(),
                user: 'system',
                action: 'ERROR',
                details: error,
                repoName: deployment.repoName
              });
            });
          }
        });

        // Sort by timestamp (newest first)
        deploymentLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setLogs(deploymentLogs);
      } catch (err: any) {
        console.error('Failed to load logs:', err);
        setError(err.message || 'Failed to load logs');
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, []);

  const getActionFromLog = (logMessage: string): string => {
    if (logMessage.includes('Detected language')) return 'LANGUAGE_DETECTED';
    if (logMessage.includes('Analysis workflow')) return 'ANALYSIS_STARTED';
    if (logMessage.includes('Jules session')) return 'AI_SESSION_STARTED';
    if (logMessage.includes('PR created')) return 'PR_CREATED';
    if (logMessage.includes('Auto-merge enabled')) return 'AUTO_MERGE_ENABLED';
    if (logMessage.includes('Deployment workflow')) return 'DEPLOYMENT_STARTED';
    if (logMessage.includes('Deployment completed')) return 'DEPLOYMENT_SUCCESS';
    return 'SYSTEM_LOG';
  };

  const getActionFromStatus = (status: string): string => {
    switch (status) {
      case 'detecting_language': return 'LANGUAGE_DETECTION';
      case 'analyzing': return 'CODE_ANALYSIS';
      case 'fixing': return 'AI_FIXING';
      case 'deploying': return 'DEPLOYING';
      case 'deployed': return 'DEPLOYMENT_SUCCESS';
      case 'failed': return 'DEPLOYMENT_FAILED';
      default: return 'STATUS_UPDATE';
    }
  };

  const getStatusMessage = (deployment: any): string => {
    switch (deployment.status) {
      case 'detecting_language': return `Started deployment for \`${deployment.repoName}\``;
      case 'analyzing': return `Analyzing code for \`${deployment.repoName}\``;
      case 'fixing': return `AI is fixing errors in \`${deployment.repoName}\``;
      case 'deploying': return `Deploying \`${deployment.repoName}\` to Cloud Run`;
      case 'deployed': return `\`${deployment.repoName}\` deployed successfully to ${deployment.deploymentUrl || 'Cloud Run'}`;
      case 'failed': return `Deployment of \`${deployment.repoName}\` failed`;
      default: return `Status update for \`${deployment.repoName}\``;
    }
  };

  const filteredLogs = filterRepo
    ? logs.filter(log => log.repoName?.toLowerCase().includes(filterRepo.toLowerCase()))
    : logs;

  if (loading) {
    return (
      <div className="flex flex-col h-full animate-fade-in-up">
        <div className="flex-shrink-0 mb-8">
          <h1 className="text-3xl font-bold text-on-background mb-2">Activity Logs</h1>
          <p className="text-on-surface-variant">Loading activity logs...</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Icons.Spinner size={48} className="animate-spin mx-auto mb-4 text-primary" />
            <p className="text-on-surface-variant">Loading logs...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full animate-fade-in-up">
        <div className="flex-shrink-0 mb-8">
          <h1 className="text-3xl font-bold text-on-background mb-2">Activity Logs</h1>
          <p className="text-on-surface-variant">Error loading logs</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Card className="p-6 text-center">
            <Icons.XCircle size={48} className="text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-on-surface mb-2">Error Loading Logs</h2>
            <p className="text-on-surface-variant mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="flex-shrink-0 mb-8">
        <h1 className="text-3xl font-bold text-on-background mb-2">Activity Logs</h1>
        {filterRepo ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
            <p className="text-on-surface-variant">
              Showing logs for: <span className="font-medium text-on-surface">{filterRepo}</span>
            </p>
            <Button variant="text" onClick={onClearFilter} className="!justify-start p-1 sm:p-2">Clear Filter</Button>
          </div>
        ) : (
          <p className="text-on-surface-variant">A complete history of all actions performed in your account.</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <Card className="text-center p-8">
            <Icons.Logs size={64} className="text-on-surface-variant mx-auto mb-4" />
            <h2 className="text-xl font-medium text-on-surface mb-2">No Activity Logs</h2>
            <p className="text-on-surface-variant">
              {filterRepo 
                ? `No logs found for repository "${filterRepo}".` 
                : 'No deployment activity yet. Start your first deployment to see logs here.'
              }
            </p>
          </Card>
        ) : (
          <>
            {/* Mobile View */}
            <div className="md:hidden">
              {filteredLogs.map(log => <LogCard key={log.id} log={log} />)}
            </div>
            
            {/* Desktop View */}
            <Card className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="border-b border-outline/30">
                      <tr>
                          <th className="p-4 text-sm font-medium text-on-surface-variant">Timestamp</th>
                          <th className="p-4 text-sm font-medium text-on-surface-variant">User</th>
                          <th className="p-4 text-sm font-medium text-on-surface-variant">Action</th>
                          <th className="p-4 text-sm font-medium text-on-surface-variant">Details</th>
                      </tr>
                  </thead>
                  <tbody>
                      {filteredLogs.map((log) => (
                          <tr key={log.id} className="border-b border-outline/20 last:border-b-0 hover:bg-surface-variant/30 font-mono text-sm">
                              <td className="p-4 text-on-surface-variant whitespace-nowrap">{formatTimestamp(log.timestamp)}</td>
                              <td className="p-4 text-on-surface font-medium">{log.user}</td>
                              <td className="p-4"><ActionBadge action={log.action} /></td>
                              <td className="p-4 text-on-surface-variant">{log.details}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default LogsPage;