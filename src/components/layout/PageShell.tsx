import { Link, Outlet } from 'react-router-dom';
import { DISCLAIMER } from '../../config';

// 공통 레이아웃 셸 — 상단 내비 + 라우트 본문(Outlet) + 하단 푸터.
// (Phase A 커밋 2에서 Navbar/Footer 컴포넌트로 교체 예정)
export function PageShell() {
  return (
    <div className="app-shell">
      <header className="navbar">
        <Link to="/" className="brand">대입 전략</Link>
        <nav className="nav-links">
          <Link to="/tool">전략 도구</Link>
        </nav>
      </header>
      <Outlet />
      <footer className="footer">
        <p className="disclaimer">{DISCLAIMER}</p>
      </footer>
    </div>
  );
}
