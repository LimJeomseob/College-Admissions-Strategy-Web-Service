import type { ReactNode } from 'react';
import './Hero.css';

interface HeroProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function Hero({ title, subtitle, actions }: HeroProps) {
  return (
    <div className="ui-hero">
      <div className="ui-hero-inner">
        <h1 className="ui-hero-title">{title}</h1>
        {subtitle && <p className="ui-hero-subtitle">{subtitle}</p>}
        {actions && <div className="ui-hero-actions">{actions}</div>}
      </div>
    </div>
  );
}
