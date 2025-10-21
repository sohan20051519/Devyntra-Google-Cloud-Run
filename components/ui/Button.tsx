
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'filled' | 'outlined' | 'text';
  icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'filled', icon, className, ...props }) => {
  const baseStyles = 'px-6 py-2.5 rounded-full font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 focus:outline-none focus:ring-4';

  const variantStyles = {
    filled: 'bg-primary text-on-primary hover:shadow-lg hover:bg-opacity-90 focus:ring-primary-container',
    outlined: 'border border-outline text-primary hover:bg-primary-container focus:ring-primary-container',
    text: 'text-primary hover:bg-primary-container focus:ring-primary-container',
  };

  return (
    <button className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
};

export default Button;
