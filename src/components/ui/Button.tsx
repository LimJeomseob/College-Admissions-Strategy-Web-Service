import type { ButtonHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import './Button.css';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return <button className={`ui-btn ui-btn-${variant} ${className}`.trim()} {...rest} />;
}

interface LinkButtonProps {
  to: string;
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

/** 라우터 링크를 버튼 스타일로 — 랜딩 CTA 등에 사용 */
export function LinkButton({ to, variant = 'primary', children, className = '' }: LinkButtonProps) {
  return (
    <Link to={to} className={`ui-btn ui-btn-${variant} ${className}`.trim()}>
      {children}
    </Link>
  );
}
