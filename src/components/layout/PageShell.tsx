import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

// 공통 레이아웃 셸 — Navbar + 라우트 본문(Outlet) + Footer.
export function PageShell() {
  return (
    <div className="app-shell">
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
}
