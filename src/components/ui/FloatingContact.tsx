import './FloatingContact.css';

// 우측 하단 고정 플로팅 '문의' 버튼 (옐로우 알약). 진로·적성 참고 사이트로 연결.
export function FloatingContact() {
  return (
    <a
      className="floating-contact"
      href="https://isyou1.com/Whatisis_you"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="문의하기"
    >
      <span aria-hidden>💬</span>
      <span className="floating-contact-text">문의</span>
    </a>
  );
}
