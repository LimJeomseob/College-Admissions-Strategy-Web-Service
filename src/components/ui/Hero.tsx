import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  subtitle: ReactNode;
  cta?: ReactNode;
}

export function Hero({ title, subtitle, cta }: Props) {
  return (
    <section className="hero">
      <div className="container hero-inner">
        <h1 className="hero-title">{title}</h1>
        <p className="hero-sub">{subtitle}</p>
        {cta && <div className="hero-cta">{cta}</div>}
      </div>
    </section>
  );
}
