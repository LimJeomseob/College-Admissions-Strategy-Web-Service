import type { ReactNode } from 'react';

interface Props {
  id?: string;
  eyebrow?: string;
  title?: string;
  tone?: 'default' | 'soft' | 'navy';
  children: ReactNode;
}

export function Section({ id, eyebrow, title, tone = 'default', children }: Props) {
  return (
    <section id={id} className={`ui-section tone-${tone}`}>
      <div className="container">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {title && <h2 className="section-title">{title}</h2>}
        {children}
      </div>
    </section>
  );
}
