import React, { useState } from 'react';
import { Icons } from './icons/Icons';
import { Page } from '../types';
import { signOutUser, signInWithGitHub, hardSignOut } from '../services/firebase';
import ConfirmationModal from './ui/ConfirmationModal';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  onLogout: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userProp?: any | null;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <li>
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex items-center p-3 rounded-full text-sm font-medium transition-colors duration-200 ${
        isActive
          ? 'bg-primary-container text-on-primary-container'
          : 'text-on-surface-variant hover:bg-surface-variant'
      }`}
    >
      <span className="mr-4">{icon}</span>
      <span>{label}</span>
    </a>
  </li>
);

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, onLogout, isOpen, setIsOpen, userProp }) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const navItems = [
    { id: Page.Overview, label: 'Overview', icon: <Icons.Dashboard size={20} /> },
    { id: Page.NewDeployment, label: 'New Deployment', icon: <Icons.NewDeployment size={20} /> },
    { id: Page.Deployments, label: 'Deployments', icon: <Icons.Deployments size={20} /> },
    { id: Page.DevAI, label: 'DevAI', icon: <Icons.DevAI size={20} /> },
    { id: Page.Logs, label: 'Logs', icon: <Icons.Logs size={20} /> },
    { id: Page.Settings, label: 'Settings', icon: <Icons.Settings size={20} /> },
  ];

  const handleNavigate = (page: Page) => {
    setActivePage(page);
    setIsOpen(false); // Close sidebar on mobile after navigation
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    // Delegate sign-out and routing to App
    onLogout();
    setIsOpen(false);
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const handleConnect = async () => {
    try {
      const res = await signInWithGitHub();
      if (res?.accessToken) {
        localStorage.setItem('github_access_token', res.accessToken);
      }
    } catch (e) {
      console.error('Connect failed', e);
      alert('GitHub connect failed. Check console for details.');
    }
  };

  // use user from parent when available
  const user = userProp ?? null;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-30 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      ></div>

      <aside className={`w-64 bg-surface flex flex-col border-r border-outline/20 fixed top-0 left-0 h-full z-40 transition-transform transform md:relative md:translate-x-0 md:z-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-outline/20">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <Icons.Code size={24} className="text-on-primary" />
            </div>
            <h1 className="text-xl font-bold text-primary">Devyntra</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                isActive={activePage === item.id}
                onClick={() => handleNavigate(item.id)}
              />
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-outline/20">
          <div className="flex items-center mb-3">
            <img src={user?.photoURL || 'https://picsum.photos/40/40'} alt="User Avatar" className="w-8 h-8 rounded-full mr-3" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-on-surface text-sm truncate">{user?.displayName ?? (localStorage.getItem('github_email')?.split('@')[0]) ?? 'Unnamed'}</p>
              <p className="text-xs text-on-surface-variant truncate">{user?.email ?? localStorage.getItem('github_email') ?? 'Not connected'}</p>
            </div>
          </div>
          <ul>
            {user ? (
              <NavItem
                icon={<Icons.Logout size={20} />}
                label="Logout"
                isActive={false}
                onClick={handleLogoutClick}
              />
            ) : (
              <NavItem
                icon={<Icons.GitHub size={20} />}
                label="Connect GitHub"
                isActive={false}
                onClick={async () => { await handleConnect(); setIsOpen(false); }}
              />
            )}
          </ul>
        </div>
      </aside>
      
      <ConfirmationModal
        isOpen={showLogoutModal}
        onClose={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to logout? You'll need to reconnect your GitHub account to continue using Devyntra."
      />
    </>
  );
};

export default Sidebar;