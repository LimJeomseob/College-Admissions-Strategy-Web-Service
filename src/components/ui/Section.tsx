import type { ReactNode } from 'react';
import './Section.css';

interface SectionProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 토큰 표면색 배경 적용 */
  soft?: boolean;
}

export function Section({ title, subtitle, children, className = '', soft = false }: SectionProps) {
  return (
    <section className={`ui-section ${soft ? 'ui-section-soft' : ''} ${className}`.trim()}>
      <div className="ui-section-inner">
        {title && <h2 className="ui-section-title">{title}</h2>}
        {subtitle && <p className="ui-section-subtitle">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}
