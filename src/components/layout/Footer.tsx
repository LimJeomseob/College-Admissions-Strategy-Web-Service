import { DISCLAIMER } from '../../config';

const REFERENCE_URL = 'https://isyou1.com/Whatisis_you';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <p className="footer-disclaimer">{DISCLAIMER}</p>
        <p className="footer-meta">
          참고자료:{' '}
          <a href={REFERENCE_URL} target="_blank" rel="noreferrer">
            isyou1.com
          </a>{' '}
          · 데이터 기반 대입 전략(참고 지표)
        </p>
        <p className="footer-copy">© {new Date().getFullYear()} 대입 전략 서비스</p>
      </div>
    </footer>
  );
}
