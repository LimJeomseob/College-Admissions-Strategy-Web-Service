import { DISCLAIMER } from '../../config';
import './Footer.css';

// 하단 푸터 — 면책(DISCLAIMER 재사용) + 참고링크(요청 ③).
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="site-footer-disclaimer">{DISCLAIMER}</p>
        <div className="site-footer-links">
          <a href="https://isyou1.com/Whatisis_you" target="_blank" rel="noopener noreferrer">
            진로·적성 참고: isyou1.com
          </a>
        </div>
        <p className="site-footer-copy">© {new Date().getFullYear()} 대입 전략 서비스</p>
      </div>
    </footer>
  );
}
