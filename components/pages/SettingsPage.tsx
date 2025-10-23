import React, { useEffect, useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { onAuthStateChanged, updateDisplayName, signOutUser } from '../../services/firebase';
import { signInWithGitHub } from '../../services/firebase';

const SettingsInput: React.FC<{ label: string; type: string; value: string; disabled?: boolean; onChange?: (val: string) => void }>
  = ({ label, type, value, disabled, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-on-surface-variant mb-1">{label}</label>
    <input 
      type={type} 
      value={value} 
      disabled={disabled}
      onChange={e => onChange?.(e.target.value)}
      className="w-full p-3 bg-surface border border-outline rounded-lg focus:ring-2 focus:ring-primary focus:outline-none disabled:bg-surface-variant/30"
    />
  </div>
)

// (old declaration removed)

const SettingsPage: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged((u) => {
      setUser(u);
      setDisplayName(u?.displayName ?? '');
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDisplayName(displayName);
      alert('Profile updated');
    } catch (e) {
      console.error('Update failed', e);
      alert('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await signOutUser();
      alert('Disconnected');
    } catch (e) {
      console.error('Disconnect failed', e);
      alert('Failed to disconnect');
    }
  };

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
                  <SettingsInput label="Full Name" type="text" value={displayName} onChange={setDisplayName} />
                  <SettingsInput label="Email Address" type="email" value={user?.email ?? ''} disabled />
              </div>
              <div className="mt-6 flex justify-end">
                  <Button className="w-full md:w-auto" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
              </div>
          </Card>

          <Card>
              <h2 className="text-xl font-medium text-on-surface mb-6 border-b border-outline/30 pb-4">GitHub Integration</h2>
              <div className="flex flex-col gap-4 text-center sm:text-left sm:flex-row sm:items-center sm:justify-between">
                  <div>
                      <p className="font-medium text-on-surface">{user ? (
                        <>Connected as <code className="px-2 py-1 bg-surface-variant rounded">{user.displayName ?? user.email ?? localStorage.getItem('github_email')}</code></>
                      ) : (
                        <>Not connected</>
                      )}</p>
                      <p className="text-sm text-on-surface-variant">Devyntra has access to your connected repositories.</p>
                  </div>
                  {user ? (
                    <Button variant="outlined" className="border-error text-error hover:bg-error-container w-full sm:w-auto" onClick={handleDisconnect}>Disconnect</Button>
                  ) : (
                    <Button variant="outlined" className="w-full sm:w-auto" onClick={async () => {
                      try {
                        const res = await signInWithGitHub();
                        if (res?.accessToken) localStorage.setItem('github_access_token', res.accessToken);
                        alert('Connected');
                      } catch (e) {
                        console.error('Connect failed', e);
                        alert('Connect failed');
                      }
                    }}>Connect GitHub</Button>
                  )}
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