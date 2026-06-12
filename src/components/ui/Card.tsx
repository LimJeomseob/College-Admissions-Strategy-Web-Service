import type { ReactNode } from 'react';
import './Card.css';

interface CardProps {
  title?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, icon, children, className = '' }: CardProps) {
  return (
    <div className={`ui-card ${className}`.trim()}>
      {icon && <div className="ui-card-icon" aria-hidden>{icon}</div>}
      {title && <h3 className="ui-card-title">{title}</h3>}
      <div className="ui-card-body">{children}</div>
    </div>
  );
}
