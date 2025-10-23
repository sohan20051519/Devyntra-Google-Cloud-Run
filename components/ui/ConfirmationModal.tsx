
import React from 'react';
import Button from './Button';
import Card from './Card';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fade-in-up">
      <Card className="bg-surface p-6 rounded-lg shadow-xl w-full max-w-md mx-4">
        <h2 className="text-xl font-bold text-on-surface mb-4">{title}</h2>
        <p className="text-on-surface-variant mb-6">{message}</p>
        <div className="flex justify-end gap-4">
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            Logout
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ConfirmationModal;
