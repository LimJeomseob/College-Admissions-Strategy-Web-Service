import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import './Navbar.css';

// 상단 내비게이션 — sticky navy 바. 브랜드 + 주요 경로 + 인증 상태별 링크.
export function Navbar() {
  const { configured, user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          대입 전략
        </Link>
        <nav className="navbar-links">
          <NavLink to="/" end className={navClass}>홈</NavLink>
          <NavLink to="/tool" className={navClass}>전략 도구</NavLink>
          {configured && user && <NavLink to="/mypage" className={navClass}>마이페이지</NavLink>}
          {configured && isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `navbar-admin ${isActive ? 'active' : ''}`.trim()}
            >
              ⚙ 관리자
            </NavLink>
          )}
          {configured && !user && <NavLink to="/login" className={navClass}>로그인</NavLink>}
          {configured && user && (
            <button
              type="button"
              className="navbar-signout"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
            >
              로그아웃
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
