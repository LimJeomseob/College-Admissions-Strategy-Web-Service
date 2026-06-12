import { Link, NavLink } from 'react-router-dom';
import './Navbar.css';

// 상단 내비게이션 — sticky navy 바. 브랜드 + 주요 경로 링크.
export function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          대입 전략
        </Link>
        <nav className="navbar-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            홈
          </NavLink>
          <NavLink to="/tool" className={({ isActive }) => (isActive ? 'active' : '')}>
            전략 도구
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
