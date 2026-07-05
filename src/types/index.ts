// ───────────────────────────────────────────────────────────
// 도메인 타입 정의 — 엔진/데이터 레이어 공통
// ───────────────────────────────────────────────────────────

/** 계열 구분 */
export type Track = '인문' | '자연';

/** 반영과목 조합 키 (1단계 산출) */
export type SubjectCombo = '전과목' | '국수영사과' | '국수영사' | '국수영과';

/** 전형유형 (MVP 범위: 교과/종합. 논술·실기는 범위 외) */
export type AdmissionType = '학생부교과' | '학생부종합' | '논술' | '실기실적';

/** 1단계: 과목별 입력 행 */
export interface SubjectInput {
  /** 교과군: 국어/수학/영어/사회/과학/기타 */
  category: '국어' | '수학' | '영어' | '사회' | '과학' | '기타';
  name: string;
  /** 5등급 성적 (1~5) */
  grade5: number;
  /** 단위수(가중평균 가중치) */
  credits: number;
}

/** 1단계 산출: 반영과목 조합별 5등급 가중평균 */
export type ComboAverages = Record<SubjectCombo, number | null>;

/** 환산표 한 행 (5등급 평균 → 9등급 추정) */
export interface ConversionRow {
  avg5: number;
  /** 기본 모형: 50:50 통합(부산+대진대) */
  est9: number;
  /** 참고 범위(모형별 값) */
  refs: {
    busan?: number;
    daejin?: number;
    gyeonggi?: number;
  };
}

/** 2단계 산출: 환산 결과 */
export interface ConversionResult {
  avg5: number;
  est9: number;
  refRange: { min: number; max: number } | null;
  /** 커버리지(5등급 1.00~3.50) 초과 시 외삽 경고 */
  extrapolated: boolean;
}

/** 입결 DB 한 행 (정제 후) */
export interface AdmissionRow {
  univCode: string;
  univName: string;
  region: string;
  track: Track | null;
  admissionType: AdmissionType;
  admissionName: string;
  unit: string; // 모집단위(학과/계열)
  /** 입결 9등급 (없으면 null → 입결 미공개) */
  cutGrade: number | null;
  /** 산출 기준: 평균/70%컷/80%컷 등 */
  cutBasis: string;
  /** 최근 3개년 입결 */
  history: { year: number; grade: number | null }[];
  competitionRate: number | null;
  /** 수능최저학력기준 원문 */
  minCsat: string | null;
}

/** 교과전형 상세 (대학교과전형_DB, 수도권 31개교) */
export interface SubjectTrackRow {
  univCode: string;
  univName: string;
  admissionName: string;
  /** 전형방법 (예: 교과100%, 교과80+면접20) */
  method: string;
  minCsat: string | null;
  /** 반영교과 (예: 국수영사) */
  reflectedSubjects: string;
  /** 반영과목 조합 키 (매칭/재투영용) */
  combo: SubjectCombo;
  /** 교과성적 반영방법 (예: 상위 N과목, 전과목) */
  reflectMethod: string;
  /** 활용지표 (등급/성취도) */
  indicator: string;
}

/** 3단계 매칭 결과 구간 */
export type RiskBand = '안정' | '적정' | '소신';

export interface MatchResult {
  row: AdmissionRow;
  /** 매칭에 사용한 조합 평균의 환산 9등급 */
  appliedEst9: number;
  appliedCombo: SubjectCombo;
  band: RiskBand;
  /** 입결 - 학생등급 (양수=여유) */
  gap: number;
  /** 희망학과/계열과 일치 시 표시 (옵셔널 — 기존 로직/테스트 영향 없음) */
  majorMatch?: boolean;
}

/** 희망학과(세션 입력) — 자유입력 원문 + 매핑된 계열/계열구분 */
export interface DesiredMajor {
  raw: string;
  families: string[];
  track: Track | null;
}

/** 4단계 교과전략 카드 */
export interface SubjectStrategyCard {
  match: MatchResult;
  detail: SubjectTrackRow | null;
  /** 반영방법 재투영 시 학생 평균 (해당 조합) */
  reprojectedAvg5: number | null;
  /** 유불리 진단 메시지 */
  advantage: string;
}

/** 학과 입결 한 행 (대학학과입결 DB, 연도별) — ④ 지원가능 표 */
export interface DeptRow {
  year: number;
  /** 전형(정규화: 교과/종합/논술/지역전형) */
  type: string;
  detail: string; // 세부전형
  dept: string; // 모집단위(학과)
  quota: number | null; // 모집인원
  comp: number | null; // 실경쟁률
  addPass: number | null; // 추합
  g50: number | null; // 등급50(9등급 50%컷)
  g70: number | null; // 등급70(9등급 70%컷)
}

/** 4단계에서 선택한 학생부종합전형 항목(→ 5단계 선택과목 추천) */
export interface JonghapPick {
  univName: string;
  type: string;
  detail: string;
  dept: string;
}

/** REQ-41: 데이터 부재 학과에 대한 AI 선택과목 추천(타 대학 자료 근거) */
export interface JonghapAiRec {
  핵심: string[];
  권장: string[];
  선택: string[];
  reason: string; // 참조 대학·근거 설명
}

/** REQ-50: 최종 보고서 AI 생성 결과 */
export interface FinalReportData {
  summary: string;
  universities: { name: string; type: '교과' | '종합' | '교과·종합'; note: string; subjects: string[] }[];
  advice: string[];
}

/** 전형 분기(triage) 결과 */
export interface TriageResult {
  /** 교과전형 집중 권장 여부 (추정9등급 >= 임계값) */
  subjectOnly: boolean;
  threshold: number;
  message: string;
}

/** 클라이언트가 로드하는 통합 데이터 레이어 */
export interface DataLayer {
  conversion: ConversionRow[];
  admissions: AdmissionRow[];
  subjectTrack: SubjectTrackRow[];
  universities: { univCode: string; univName: string; region: string }[];
  meta: { generatedAt: string; source: 'mock' | 'real' };
}

// ───────────────────────────────────────────────────────────
// 관리자 단계별 DB(Supabase) 행 타입 — DB 관리 UI/로더 공통
// ───────────────────────────────────────────────────────────

/** 2단계 환산 DB 행 (5등급평균 → 모형별 추정) */
export interface ConversionDbRow {
  id?: number;
  avg5: number;
  busan: number | null;
  daejin: number | null;
  integrated: number | null; // 50:50 통합 (앱 기본 est9)
  gg_jeon: string | null;
  gg_guksuyeongsagwa: string | null;
  gg_guksuyeonggwa: string | null;
  gg_guksuyeongsa: string | null;
}

/** 3단계 교과전형 준비전략 DB 행 */
export interface StrategyDbRow {
  id?: number;
  track: string | null; // 인문 / 자연
  admission_type: string | null; // 교과전형 / 종합전형
  avg5: string | null; // 범위 "2.9~3.0" 허용
  est9: number | null;
  rank300: string | null;
  univ_name: string;
  univ_canon: string;
}

/** 4단계 대학학과입결 DB 행 */
export interface DeptAdmissionsDbRow {
  id?: number;
  univ_canon: string;
  univ_raw: string | null;
  year: number | null;
  type: string | null;
  detail: string | null;
  dept: string | null;
  quota: number | null;
  comp: number | null;
  add_pass: number | null;
  g50: number | null;
  g70: number | null;
}

/** 사용이력 이벤트 종류 */
export type UsageEventType = 'step_enter' | 'step_complete' | 'analysis_run';

/** 사용이력 한 행 */
export interface UsageEvent {
  id?: number;
  user_id: string;
  event_type: UsageEventType;
  step: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}
