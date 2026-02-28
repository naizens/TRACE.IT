import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'ghost' | 'accent';
  size?: 'sm' | 'md';
}

export function Button({ children, variant = 'default', size = 'md', className = '', ...rest }: Props) {
  const base =
    'inline-flex items-center justify-center font-semibold tracking-wide transition-colors cursor-pointer select-none rounded disabled:opacity-40 disabled:pointer-events-none';

  const variants = {
    default: 'bg-surface-2 hover:bg-[#28282c] text-text border border-border',
    ghost:   'bg-transparent hover:bg-surface-2 text-muted hover:text-text',
    accent:  'bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30',
  };

  const sizes = {
    sm: 'px-2.5 py-1 text-[10px] gap-1.5',
    md: 'px-3 py-1.5 text-xs gap-2',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
