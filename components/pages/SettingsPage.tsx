import React from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';

const SettingsInput: React.FC<{ label: string; type: string; value: string; disabled?: boolean }> = ({ label, type, value, disabled }) => (
    <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-1">{label}</label>
        <input 
            type={type} 
            defaultValue={value} 
            disabled={disabled}
            className="w-full p-3 bg-surface border border-outline rounded-lg focus:ring-2 focus:ring-primary focus:outline-none disabled:bg-surface-variant/30"
        />
    </div>
)

const SettingsPage: React.FC = () => {
  return (
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="flex-shrink-0">
        <h1 className="text-3xl font-bold text-on-background mb-8">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-8">
          <Card>
              <h2 className="text-xl font-medium text-on-surface mb-6 border-b border-outline/30 pb-4">Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SettingsInput label="Full Name" type="text" value="John Doe" />
                  <SettingsInput label="Email Address" type="email" value="john.doe@example.com" disabled />
              </div>
              <div className="mt-6 flex justify-end">
                  <Button className="w-full md:w-auto">Save Changes</Button>
              </div>
          </Card>

          <Card>
              <h2 className="text-xl font-medium text-on-surface mb-6 border-b border-outline/30 pb-4">GitHub Integration</h2>
              <div className="flex flex-col gap-4 text-center sm:text-left sm:flex-row sm:items-center sm:justify-between">
                  <div>
                      <p className="font-medium text-on-surface">Connected as `john-doe`</p>
                      <p className="text-sm text-on-surface-variant">Devyntra has access to all repositories.</p>
                  </div>
                  <Button variant="outlined" className="border-error text-error hover:bg-error-container w-full sm:w-auto">Disconnect</Button>
              </div>
          </Card>
          
          <Card>
              <h2 className="text-xl font-medium text-on-surface mb-6 border-b border-outline/30 pb-4">Billing</h2>
              <div className="flex flex-col gap-4 text-center sm:text-left sm:flex-row sm:items-center sm:justify-between">
                  <div>
                      <p className="font-medium text-on-surface">Pro Plan</p>
                      <p className="text-sm text-on-surface-variant">Next billing date: November 1, 2023</p>
                  </div>
                  <Button variant="outlined" className="w-full sm:w-auto">Manage Subscription</Button>
              </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;