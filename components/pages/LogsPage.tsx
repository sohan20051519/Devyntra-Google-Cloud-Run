import React from 'react';
import { Log } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';

const mockLogs: Log[] = [
    { id: '1', timestamp: '2023-10-27 10:05:12', user: 'john.doe', action: 'DEPLOYMENT_SUCCESS', details: 'Repository `project-phoenix` deployed successfully.' },
    { id: '2', timestamp: '2023-10-27 10:02:45', user: 'system', action: 'AI_FIX_APPLIED', details: 'DevAI fixed 3 bugs in `project-phoenix` and pushed to main.' },
    { id: '3', timestamp: '2023-10-27 09:15:30', user: 'john.doe', action: 'REPO_CONNECT', details: 'Connected new repository `mobile-landing`.' },
    { id: '4', timestamp: '2023-10-26 15:45:01', user: 'john.doe', action: 'DEPLOYMENT_START', details: 'Initiated deployment for `web-app-v2`.' },
    { id: '5', timestamp: '2023-10-26 15:50:15', user: 'system', action: 'DEPLOYMENT_FAIL', details: 'Deployment for `mobile-landing` failed at build step.' },
    { id: '6', timestamp: '2023-10-26 15:46:00', user: 'system', action: 'BUILD_SUCCESS', details: 'Build for `web-app-v2` completed.' },
    { id: '7', timestamp: '2023-10-26 15:47:00', user: 'john.doe', action: 'DEPLOYMENT_SUCCESS', details: 'Repository `web-app-v2` deployed successfully.' },
];

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
        <p className="text-xs text-right text-on-surface-variant/80 font-mono">{log.timestamp}</p>
    </Card>
);

const LogsPage: React.FC<LogsPageProps> = ({ filterRepo, onClearFilter }) => {
  const filteredLogs = filterRepo
    ? mockLogs.filter(log => log.details.toLowerCase().includes(`\`${filterRepo.toLowerCase()}\``))
    : mockLogs;

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
            <p className="text-on-surface-variant">No logs found for this repository.</p>
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
                              <td className="p-4 text-on-surface-variant whitespace-nowrap">{log.timestamp}</td>
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