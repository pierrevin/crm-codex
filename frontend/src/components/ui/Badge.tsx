import { ReactNode } from 'react';

export type BadgeVariant = 'pending' | 'processed' | 'verified' | 'paid' | 'rejected' | 'forecast';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processed: 'bg-blue-100 text-blue-700',
  verified: 'bg-green-100 text-green-700',
  paid: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  forecast: 'bg-purple-100 text-purple-700',
};

export function Badge({ variant, children, className = '' }: BadgeProps) {
  const baseStyles = 'inline-flex rounded-full px-2 py-1 text-xs font-medium';
  const finalClassName = `${baseStyles} ${variantStyles[variant]} ${className}`.trim();

  return <span className={finalClassName}>{children}</span>;
}

