import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { FloatingContact } from '../ui/FloatingContact';

// 공통 레이아웃 셸 — 배경 파스텔 장식 + Navbar + 본문(Outlet) + Footer + 플로팅 문의.
export function PageShell() {
  return (
    <div className="app-shell">
      <div className="bg-decor" aria-hidden>
        <span className="decor decor-blue" />
        <span className="decor decor-orange" />
        <span className="decor decor-red" />
      </div>
      <Navbar />
      <Outlet />
      <Footer />
      <FloatingContact />
    </div>
  );
}
