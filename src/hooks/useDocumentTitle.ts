import { useEffect } from 'react';

const SITE = '대입 전략 서비스';

// 페이지별 문서 제목 설정 (UX/SEO). 언마운트 시 기본 제목 복원.
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
  }, [title]);
}
