import { Link, NavLink } from 'react-router-dom';

const REFERENCE_URL = 'https://isyou1.com/Whatisis_you';

export function Navbar() {
  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand">
          대입전략<span className="brand-dot">.</span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>홈</NavLink>
          <NavLink to="/tool">성적 분석</NavLink>
          <a href={REFERENCE_URL} target="_blank" rel="noreferrer">참고자료</a>
        </nav>
      </div>
    </header>
  );
}
