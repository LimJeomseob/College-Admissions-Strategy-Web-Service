import type { Track } from '../types';

// ───────────────────────────────────────────────────────────
// 희망학과 → 계열(families)/계열구분(track) 매핑 (스타터 표)
// TS 모듈로 두어 fetch 불필요 + 타입/테스트 용이.
// 사범대·상경/경영·공과·자연과학·의약·인문·사회과학·예체능 커버.
// ───────────────────────────────────────────────────────────

export interface MajorFamily {
  /** 소속 단과대학/계열 (예: 공과대학) */
  families: string[];
  track: Track;
  /** 모집단위 텍스트 매칭용 키워드 */
  keywords: string[];
}

export const MAJOR_FAMILIES: Record<string, MajorFamily> = {
  // 사범 / 교육
  교육학과: { families: ['사범대학', '사회과학대학'], track: '인문', keywords: ['교육', '사범'] },
  국어교육과: { families: ['사범대학'], track: '인문', keywords: ['국어교육', '교육'] },
  체육교육과: { families: ['사범대학', '예체능'], track: '인문', keywords: ['체육', '스포츠'] },

  // 상경 / 경영
  경영학과: { families: ['경영대학', '상경계열'], track: '인문', keywords: ['경영', '경상', '회계'] },
  경제학과: { families: ['상경계열', '사회과학대학'], track: '인문', keywords: ['경제', '무역'] },

  // 사회과학
  행정학과: { families: ['사회과학대학'], track: '인문', keywords: ['행정', '정책'] },
  정치외교학과: { families: ['사회과학대학'], track: '인문', keywords: ['정치', '외교'] },
  사회학과: { families: ['사회과학대학'], track: '인문', keywords: ['사회학'] },
  심리학과: { families: ['사회과학대학'], track: '인문', keywords: ['심리'] },
  미디어커뮤니케이션학과: { families: ['사회과학대학'], track: '인문', keywords: ['미디어', '언론', '신문방송', '커뮤니케이션'] },

  // 인문
  국어국문학과: { families: ['인문대학'], track: '인문', keywords: ['국어국문', '국문'] },
  영어영문학과: { families: ['인문대학'], track: '인문', keywords: ['영어영문', '영문'] },
  사학과: { families: ['인문대학'], track: '인문', keywords: ['사학', '역사'] },
  철학과: { families: ['인문대학'], track: '인문', keywords: ['철학'] },

  // 공과
  컴퓨터공학과: { families: ['공과대학', 'IT대학'], track: '자연', keywords: ['컴퓨터', '소프트', '소프트웨어', '정보', 'AI', '인공지능'] },
  전자공학과: { families: ['공과대학'], track: '자연', keywords: ['전자', '전기', '반도체'] },
  기계공학과: { families: ['공과대학'], track: '자연', keywords: ['기계', '로봇'] },
  화학공학과: { families: ['공과대학'], track: '자연', keywords: ['화학공학', '화공', '신소재'] },
  건축학과: { families: ['공과대학'], track: '자연', keywords: ['건축', '토목'] },

  // 자연과학
  수학과: { families: ['자연과학대학'], track: '자연', keywords: ['수학', '통계'] },
  물리학과: { families: ['자연과학대학'], track: '자연', keywords: ['물리'] },
  화학과: { families: ['자연과학대학'], track: '자연', keywords: ['화학'] },
  생명과학과: { families: ['자연과학대학'], track: '자연', keywords: ['생명', '생물'] },

  // 의약 / 보건
  의예과: { families: ['의과대학'], track: '자연', keywords: ['의예', '의학'] },
  간호학과: { families: ['간호대학'], track: '자연', keywords: ['간호'] },
  약학과: { families: ['약학대학'], track: '자연', keywords: ['약학', '제약'] },

  // 예체능
  디자인학과: { families: ['예술대학', '예체능'], track: '인문', keywords: ['디자인', '시각'] },
  음악학과: { families: ['예술대학', '예체능'], track: '인문', keywords: ['음악', '실용음악'] },
};

export interface MajorLookup {
  /** 매칭된 표준 학과명(없으면 입력 원문) */
  major: string;
  families: string[];
  track: Track | null;
  /** 모집단위 텍스트 매칭용 키워드 (폴백 시 빈 배열) */
  keywords: string[];
}

const FALLBACK = (raw: string): MajorLookup => ({
  major: raw,
  families: [],
  track: null,
  keywords: [],
});

/**
 * 희망학과 자유입력 → 계열 매핑.
 * ① 정확매칭 ② 키워드/부분일치 ③ 폴백.
 */
export function lookupMajor(input: string): MajorLookup {
  const q = (input || '').trim();
  if (q === '') return FALLBACK(q);

  // ① 정확매칭
  const exact = MAJOR_FAMILIES[q];
  if (exact) {
    return { major: q, families: exact.families, track: exact.track, keywords: exact.keywords };
  }

  // ② 키워드 / 부분일치
  for (const [major, mf] of Object.entries(MAJOR_FAMILIES)) {
    const hitMajor = major.includes(q) || q.includes(major);
    const hitKeyword = mf.keywords.some((k) => q.includes(k) || k.includes(q));
    if (hitMajor || hitKeyword) {
      return { major, families: mf.families, track: mf.track, keywords: mf.keywords };
    }
  }

  // ③ 폴백
  return FALLBACK(q);
}
