import React from 'react';

// Fix: Update CardProps to extend React.HTMLAttributes to allow passing standard HTML attributes like 'style'.
// This makes the component more flexible and fixes the type error in LandingPage.tsx.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick, ...props }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-surface-variant/30 rounded-2xl p-4 md:p-6 shadow-sm transition-shadow hover:shadow-md ${onClick ? 'cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;