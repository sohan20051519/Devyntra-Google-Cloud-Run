import React from 'react';
import Card from '../ui/Card';
import { Icons } from '../icons/Icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string; }> = ({ title, value, icon, color }) => (
    <Card className="flex items-center p-6">
        <div className={`p-3 rounded-full mr-4 ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm text-on-surface-variant">{title}</p>
            <p className="text-2xl font-bold text-on-surface">{value}</p>
        </div>
    </Card>
)

interface OverviewPageProps {
  totalDeployments: number;
  successfulBuilds: number;
  failedBuilds: number;
  connectedRepos: number;
  weeklyActivity: { name: string; deployments: number; builds: number }[];
  recentActivity: { id: string; type: 'deployment' | 'bugfix' | 'repo'; description: string; time: string }[];
}

const OverviewPage: React.FC<OverviewPageProps> = ({
  totalDeployments,
  successfulBuilds,
  failedBuilds,
  connectedRepos,
  weeklyActivity,
  recentActivity
}) => {
  return (
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="flex-shrink-0">
        <h1 className="text-3xl font-bold text-on-background mb-8">Overview</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Deployments" value={totalDeployments.toString()} icon={<Icons.Deployments size={24} className="text-on-primary-container"/>} color="bg-primary-container" />
          <StatCard title="Successful Builds" value={successfulBuilds.toLocaleString()} icon={<Icons.CheckCircle size={24} className="text-green-800"/>} color="bg-green-100" />
          <StatCard title="Failed Builds" value={failedBuilds.toString()} icon={<Icons.XCircle size={24} className="text-on-error-container"/>} color="bg-error-container" />
          <StatCard title="Connected Repos" value={connectedRepos.toString()} icon={<Icons.GitHub size={24} className="text-on-secondary-container"/>} color="bg-secondary-container" />
        </div>

        <Card className="mb-8">
          <h2 className="text-xl font-medium text-on-surface mb-4">Activity This Week</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={weeklyActivity} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                <XAxis dataKey="name" stroke="#79747E" />
                <YAxis stroke="#79747E" />
                <Tooltip contentStyle={{ backgroundColor: '#FFFBFE', border: '1px solid #E7E0EC', borderRadius: '1rem' }}/>
                <Legend />
                <Line type="monotone" dataKey="deployments" stroke="#6750A4" strokeWidth={2} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="builds" stroke="#625B71" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div>
          <h2 className="text-xl font-medium text-on-surface mb-4">Recent Activity</h2>
          <Card>
              <ul className="divide-y divide-outline/30">
                  {recentActivity.map(activity => (
                      <li key={activity.id} className="flex items-center justify-between p-4">
                          <div className="flex items-center">
                              {activity.type === 'deployment' && <Icons.NewDeployment size={20} className="text-primary mr-4"/>}
                              {activity.type === 'bugfix' && <Icons.DevAI size={20} className="text-secondary mr-4"/>}
                              {activity.type === 'repo' && <Icons.GitHub size={20} className="text-on-background mr-4"/>}
                              <div>
                                  <p className="font-medium">{activity.description}</p>
                                  <p className="text-sm text-on-surface-variant">{activity.time}</p>
                              </div>
                          </div>
                          <Icons.ChevronRight size={20} className="text-outline"/>
                      </li>
                  ))}
              </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;