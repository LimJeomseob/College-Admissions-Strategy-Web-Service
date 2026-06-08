import type { Track } from '../types';

// ───────────────────────────────────────────────────────────
// 희망학과 → 계열(단과대학군) 스타터 매핑표
// 사용자가 희망학과를 적으면 관련 계열을 도출해 매칭 정렬/표시에 활용한다.
// 확장 가능: 키 추가 또는 keywords 보강.
// ───────────────────────────────────────────────────────────

export interface MajorFamily {
  /** 계열/단과대학군 (예: ['사범대', '사회과학대학']) */
  families: string[];
  /** 조합 기본값용 계열 구분 */
  track: Track;
  /** 매칭용 키워드/부분일치어 */
  keywords: string[];
}

export const MAJOR_FAMILIES: Record<string, MajorFamily> = {
  // 인문/사회
  교육학과: { families: ['사범대', '사회과학대학'], track: '인문', keywords: ['교육', '사범', '교사'] },
  국어국문학과: { families: ['인문대학'], track: '인문', keywords: ['국어', '국문', '문예', '문창'] },
  영어영문학과: { families: ['인문대학'], track: '인문', keywords: ['영어', '영문', '외국어'] },
  사학과: { families: ['인문대학'], track: '인문', keywords: ['사학', '역사', '고고'] },
  철학과: { families: ['인문대학'], track: '인문', keywords: ['철학', '윤리'] },
  심리학과: { families: ['사회과학대학'], track: '인문', keywords: ['심리'] },
  사회학과: { families: ['사회과학대학'], track: '인문', keywords: ['사회학', '사회복지', '복지'] },
  정치외교학과: { families: ['사회과학대학'], track: '인문', keywords: ['정치', '외교', '행정', '정책'] },
  법학과: { families: ['법과대학', '사회과학대학'], track: '인문', keywords: ['법학', '법'] },
  경영학과: { families: ['경영대학', '상경대학'], track: '인문', keywords: ['경영', '경제', '상경', '회계', '무역', '금융'] },
  경제학과: { families: ['경영대학', '상경대학'], track: '인문', keywords: ['경제', '상경'] },
  미디어커뮤니케이션학과: { families: ['사회과학대학'], track: '인문', keywords: ['미디어', '언론', '신문방송', '커뮤니케이션', '광고'] },

  // 자연/공학
  컴퓨터공학과: { families: ['공과대학', 'IT대학'], track: '자연', keywords: ['컴퓨터', '소프트', '소프트웨어', 'sw', '인공지능', 'ai', '정보'] },
  전자공학과: { families: ['공과대학'], track: '자연', keywords: ['전자', '전기', '반도체', '제어'] },
  기계공학과: { families: ['공과대학'], track: '자연', keywords: ['기계', '로봇', '자동차'] },
  화학공학과: { families: ['공과대학'], track: '자연', keywords: ['화학공학', '화공', '신소재', '재료'] },
  건축학과: { families: ['공과대학'], track: '자연', keywords: ['건축', '토목', '도시'] },
  수학과: { families: ['자연과학대학'], track: '자연', keywords: ['수학', '통계', '데이터'] },
  물리학과: { families: ['자연과학대학'], track: '자연', keywords: ['물리'] },
  화학과: { families: ['자연과학대학'], track: '자연', keywords: ['화학'] },
  생명과학과: { families: ['자연과학대학'], track: '자연', keywords: ['생명', '생물', '바이오'] },

  // 의약/보건
  의예과: { families: ['의과대학'], track: '자연', keywords: ['의예', '의학', '의대'] },
  간호학과: { families: ['간호대학', '의과대학'], track: '자연', keywords: ['간호'] },
  약학과: { families: ['약학대학'], track: '자연', keywords: ['약학', '제약'] },

  // 예체능
  체육교육과: { families: ['사범대', '예체능대학'], track: '인문', keywords: ['체육', '스포츠'] },
  디자인학과: { families: ['예술대학', '미술대학'], track: '인문', keywords: ['디자인', '미술', '시각', '산업디자인'] },
};

export interface MajorLookup {
  /** 매칭된 표준 학과명 (없으면 입력 echo) */
  major: string | null;
  families: string[];
  track: Track | null;
  /** 매칭에 사용할 키워드(정렬용) */
  keywords: string[];
}

const EMPTY: MajorLookup = { major: null, families: [], track: null, keywords: [] };

/** 희망학과 입력 → 계열 도출 (①정확 ②키워드/부분일치 ③폴백) */
export function lookupMajor(input: string): MajorLookup {
  const q = input.trim();
  if (!q) return EMPTY;
  const norm = q.replace(/\s+/g, '').toLowerCase();

  // ① 정확 매칭 (공백 무시)
  for (const [major, info] of Object.entries(MAJOR_FAMILIES)) {
    if (major.replace(/\s+/g, '').toLowerCase() === norm) {
      return { major, families: info.families, track: info.track, keywords: [major, ...info.keywords] };
    }
  }
  // ② 키워드/부분일치
  for (const [major, info] of Object.entries(MAJOR_FAMILIES)) {
    if (info.keywords.some((k) => norm.includes(k.toLowerCase()) || k.toLowerCase().includes(norm))) {
      return { major, families: info.families, track: info.track, keywords: [major, ...info.keywords] };
    }
  }
  // ③ 폴백 — 입력어 자체를 키워드로 사용
  return { major: q, families: [], track: null, keywords: [q] };
}
