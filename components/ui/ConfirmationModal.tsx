
import React from 'react';
import ReactDOM from 'react-dom';
import Button from './Button';
import Card from './Card';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'filled' | 'outlined' | 'text';
  confirmClassName?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', confirmVariant = 'filled', confirmClassName = '' }) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="!bg-surface p-6 rounded-2xl shadow-2xl border border-outline/20 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold text-on-surface mb-4">{title}</h2>
        <p className="text-on-surface-variant mb-6">{message}</p>
        <div className="flex justify-end gap-4">
          <Button variant="text" onClick={onClose}>
            {cancelText}
          </Button>
          <Button variant={confirmVariant} className={confirmClassName} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </Card>
    </div>,
    document.body
  );
};

export default ConfirmationModal;
