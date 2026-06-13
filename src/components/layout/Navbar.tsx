import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import './Navbar.css';

// 상단 내비게이션 — 화이트 sticky 헤더. 좌측 로고+메뉴(현재=블랙 알약),
// 우측 인증 액션(블랙/그린 알약).
export function Navbar() {
  const { configured, user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link ${isActive ? 'active' : ''}`.trim();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="navbar-left">
          <Link to="/" className="navbar-brand">대입 전략</Link>
          <nav className="navbar-nav">
            <NavLink to="/" end className={navClass}>홈</NavLink>
            <NavLink to="/tool" className={navClass}>전략 도구</NavLink>
            {configured && user && <NavLink to="/mypage" className={navClass}>마이페이지</NavLink>}
          </nav>
        </div>

        <div className="navbar-actions">
          {configured && isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `pill pill-admin ${isActive ? 'active' : ''}`.trim()}
            >
              ⚙ 관리자
            </NavLink>
          )}
          {configured && !user && (
            <>
              <NavLink to="/login" className="pill pill-black">👤 로그인</NavLink>
              <Link to="/tool" className="pill pill-green">무료로 시작</Link>
            </>
          )}
          {configured && user && (
            <>
              <Link to="/tool" className="pill pill-green">전략 도구</Link>
              <button
                type="button"
                className="pill pill-ghost"
                onClick={async () => {
                  await signOut();
                  navigate('/');
                }}
              >
                로그아웃
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
