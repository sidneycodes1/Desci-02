import React, { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'solid' | 'gradient';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'glass',
  className = '',
  ...props
}) => {
  const variantStyles = {
    glass:
      'bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-2xl shadow-black/40 rounded-xl',
    solid: 'bg-slate-900 border border-slate-800 shadow-xl rounded-xl',
    gradient:
      'bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-xl',
  };

  return (
    <div className={`${variantStyles[variant]} p-6 transition-all duration-200 ${className}`} {...props}>
      {children}
    </div>
  );
};
