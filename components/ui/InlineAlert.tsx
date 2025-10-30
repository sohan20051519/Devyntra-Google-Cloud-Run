import React from 'react';
import Card from './Card';
import Button from './Button';
import { Icons } from '../icons/Icons';

export type InlineAlertType = 'success' | 'error' | 'info' | 'warning';

const typeStyles: Record<InlineAlertType, { container: string; icon: React.ReactNode } > = {
  success: { container: 'bg-green-100 text-green-800', icon: <Icons.CheckCircle size={16} className="text-green-700"/> },
  error: { container: 'bg-error-container text-on-error-container', icon: <Icons.XCircle size={16} className="text-on-error-container"/> },
  info: { container: 'bg-blue-100 text-blue-800', icon: <Icons.Info size={16} className="text-blue-700"/> },
  warning: { container: 'bg-yellow-100 text-yellow-900', icon: <Icons.AlertTriangle size={16} className="text-yellow-700"/> },
};

interface InlineAlertProps {
  type: InlineAlertType;
  message: string;
  onClose?: () => void;
  className?: string;
}

const InlineAlert: React.FC<InlineAlertProps> = ({ type, message, onClose, className = '' }) => {
  const style = typeStyles[type];
  return (
    <div className={`rounded-md px-4 py-3 flex items-start gap-2 ${style.container} ${className}`}>
      <div className="mt-0.5">{style.icon}</div>
      <div className="flex-1 text-sm">{message}</div>
      {onClose && (
        <button onClick={onClose} className="text-sm opacity-80 hover:opacity-100">Dismiss</button>
      )}
    </div>
  );
};

export default InlineAlert;
