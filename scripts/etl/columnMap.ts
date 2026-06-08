// ───────────────────────────────────────────────────────────
// 원본 DB 컬럼명 ↔ 내부 표준 필드 매핑
//
// ⚠ 실제 5종 DB 업로드 후, 각 파일의 실제 헤더에 맞춰 이 파일만 수정하면
//    ETL 본문 로직(normalize/clean/build)은 그대로 동작한다.
//    (보고서 기준 추정 헤더로 초기값을 채워 둠)
// ───────────────────────────────────────────────────────────

export const FILES = {
  conversion: '5등급_9등급_환산_DB.xlsx',
  admissions: '2026_수시입결_DB.xlsx',
  subjectTrack: '대학교과전형_DB.xlsx',
  // Phase 2(종합전형)에서 사용
  recommendBySubject: '2028_권역별대학별_권장과목DB.xlsx',
  majorSubjects: '2028_전공관련과목현황_DB.xlsx',
} as const;

/** 5등급_9등급_환산_DB */
export const CONVERSION_COLS = {
  avg5: '5등급평균',
  est9_5050: '통합50:50',
  busan: '부산',
  daejin: '대진대',
  gyeonggi: '경기',
};

/** 2026_수시입결_DB */
export const ADMISSION_COLS = {
  univName: '대학명',
  region: '지역',
  track: '계열',
  admissionType: '전형유형',
  admissionName: '전형명',
  unit: '모집단위',
  cutGrade2025: '2025입결',
  cutGrade2024: '2024입결',
  cutGrade2023: '2023입결',
  cutBasis: '입결기준',
  competitionRate: '경쟁률',
  minCsat: '수능최저',
};

/** 대학교과전형_DB */
export const SUBJECT_TRACK_COLS = {
  univName: '대학명',
  admissionName: '전형명',
  method: '전형방법',
  minCsat: '수능최저',
  reflectedSubjects: '반영교과',
  reflectMethod: '반영방법',
  indicator: '활용지표',
};

/**
 * 대학명 표준화 별칭 사전.
 * key = 표준 univCode, value = 표기 변형 목록.
 * (보고서 3.2의 예시를 초기값으로 수록)
 */
export const UNIV_ALIASES: Record<string, { name: string; region: string; aliases: string[] }> = {
  GNU: {
    name: '경상국립대학교',
    region: '경남',
    aliases: ['경상대학교', '경상대', '경상국립대'],
  },
  SEOULTECH: {
    name: '서울과학기술대학교',
    region: '서울',
    aliases: ['서울과기대', '서울과학기술대'],
  },
  HYU_ERICA: {
    name: '한양대학교(ERICA)',
    region: '경기',
    aliases: ['한양대 에리카', '한양대학교 ERICA', '한양대(ERICA)'],
  },
};
