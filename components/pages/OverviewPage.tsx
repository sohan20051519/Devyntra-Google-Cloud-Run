import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { Icons } from '../icons/Icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getDeploymentStats, getRecentActivity } from '../../services/firestore';
import { formatTimestamp } from '../../services/utils';
import { auth } from '../../services/firebase';

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

const OverviewPage: React.FC = () => {
  const [stats, setStats] = useState({ total: 0, deployed: 0, failed: 0, inProgress: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }

      try {
        const [statsData, activityData] = await Promise.all([
          getDeploymentStats(auth.currentUser.uid),
          getRecentActivity(auth.currentUser.uid, 10)
        ]);
        
        setStats(statsData);
        setRecentActivity(activityData);
      } catch (error) {
        console.error('Failed to load overview data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Generate chart data from recent activity
  const generateChartData = () => {
    const last7Days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      const dayActivity = recentActivity.filter(activity => {
        const activityDate = activity.createdAt?.toDate ? activity.createdAt.toDate() : new Date(activity.createdAt);
        return activityDate.toDateString() === date.toDateString();
      });
      
      last7Days.push({
        name: dayName,
        deployments: dayActivity.filter(a => a.status === 'deployed').length,
        builds: dayActivity.length
      });
    }
    
    return last7Days;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full animate-fade-in-up">
        <div className="flex-shrink-0">
          <h1 className="text-3xl font-bold text-on-background mb-8">Overview</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Icons.Spinner size={48} className="animate-spin mx-auto mb-4 text-primary" />
            <p className="text-on-surface-variant">Loading overview...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="flex-shrink-0">
        <h1 className="text-3xl font-bold text-on-background mb-8">Overview</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Deployments" value={stats.total.toString()} icon={<Icons.Deployments size={24} className="text-on-primary-container"/>} color="bg-primary-container" />
          <StatCard title="Successful Deployments" value={stats.deployed.toString()} icon={<Icons.CheckCircle size={24} className="text-green-800"/>} color="bg-green-100" />
          <StatCard title="Failed Deployments" value={stats.failed.toString()} icon={<Icons.XCircle size={24} className="text-on-error-container"/>} color="bg-error-container" />
          <StatCard title="In Progress" value={stats.inProgress.toString()} icon={<Icons.Spinner size={24} className="text-blue-800"/>} color="bg-blue-100" />
        </div>

        <Card className="mb-8">
          <h2 className="text-xl font-medium text-on-surface mb-4">Activity This Week</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={generateChartData()} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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
                  {recentActivity.length === 0 ? (
                    <li className="p-8 text-center text-on-surface-variant">
                      No recent activity. Start your first deployment!
                    </li>
                  ) : (
                    recentActivity.map((activity, index) => (
                      <li key={activity.id || index} className="flex items-center justify-between p-4">
                          <div className="flex items-center">
                              <Icons.NewDeployment size={20} className="text-primary mr-4"/>
                              <div>
                                  <p className="font-medium">
                                    {activity.status === 'deployed' ? `Deployment of \`${activity.repoName}\` successful.` :
                                     activity.status === 'failed' ? `Deployment of \`${activity.repoName}\` failed.` :
                                     `Deployment of \`${activity.repoName}\` ${activity.status}.`}
                                  </p>
                                  <p className="text-sm text-on-surface-variant">{formatTimestamp(activity.createdAt)}</p>
                              </div>
                          </div>
                          <Icons.ChevronRight size={20} className="text-outline"/>
                      </li>
                    ))
                  )}
              </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;