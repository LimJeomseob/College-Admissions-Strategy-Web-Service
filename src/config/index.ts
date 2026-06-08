import type { SubjectCombo, Track } from '../types';

// ───────────────────────────────────────────────────────────
// 서비스 상수 (보고서 기반, 조정 가능)
// ───────────────────────────────────────────────────────────

/**
 * 학생부종합전형 분기 임계값.
 * 추정 9등급이 이 값보다 낮으면(= 등급 숫자 >= 3.5) 종합전형은 사실상 불필요로 보고
 * 교과전형에만 집중하도록 안내한다. (사용자 정책 + 보고서 'MVP=교과전형' 권고)
 */
export const SUBJECT_ONLY_THRESHOLD = 3.5;

/** 환산표 커버리지 (5등급 평균) — 초과 시 외삽 경고 */
export const CONVERSION_COVERAGE = { min: 1.0, max: 3.5 } as const;

/** 3단계 매칭 여유분: 학생 환산등급 + 여유분 까지 지원가능권으로 포함 */
export const MATCH_MARGIN = 0.5;

/** 안정/적정/소신 구간 경계 (입결 - 학생등급 = gap) */
export const RISK_BANDS = {
  /** gap >= 안정 → 입결보다 충분히 우수 */
  stable: 0.3,
  /** gap >= 적정 */
  moderate: -0.2,
  // 그 외(소신/도전)
} as const;

/** 계열별 기본 반영과목 조합 (대학 미지정 시 fallback) */
export const DEFAULT_COMBO_BY_TRACK: Record<Track, SubjectCombo> = {
  인문: '국수영사',
  자연: '국수영과',
};

/** 결과 면책·프레이밍 문구 (보고서 5장 — 예측 아닌 참고 지표) */
export const DISCLAIMER =
  '본 결과는 과거(2023~25) 9등급 입결에 현재 위치를 투영한 참고 지표입니다. ' +
  '미래(2028) 합격을 예측하지 않으며, 환산값은 모형별 차이가 있어 참고 범위를 함께 확인하세요.';
