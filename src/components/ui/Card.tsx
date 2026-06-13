import type { ReactNode } from 'react';
import './Card.css';

interface CardProps {
  title?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

// 베이지 그라데이션 카드 — [아이콘?] [굵은 제목] → [가로 구분선] → [설명]
export function Card({ title, icon, children, className = '' }: CardProps) {
  return (
    <div className={`ui-card ${className}`.trim()}>
      {icon && <div className="ui-card-icon" aria-hidden>{icon}</div>}
      {title && <h3 className="ui-card-title">{title}</h3>}
      <hr className="ui-card-divider" />
      <div className="ui-card-body">{children}</div>
    </div>
  );
}
