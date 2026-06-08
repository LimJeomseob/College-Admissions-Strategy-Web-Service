import { DEFAULT_COMBO_BY_TRACK, MATCH_MARGIN, RISK_BANDS } from '../config';
import type {
  AdmissionRow,
  ComboAverages,
  ConversionRow,
  MatchResult,
  RiskBand,
  SubjectCombo,
  Track,
} from '../types';
import { convert } from './convert';

// ───────────────────────────────────────────────────────────
// [3단계] 지원 가능 대학·학과 추출
// 대학별 반영과목 조합에 맞는 평균을 선택해 환산·대조
// ───────────────────────────────────────────────────────────

export interface MatchFilters {
  track?: Track;
  region?: string;
  admissionType?: AdmissionRow['admissionType'];
}

export interface MatchOutput {
  /** 지원 가능권 (입결 보유) */
  matched: MatchResult[];
  /** 입결 미공개 — 임의 추정 금지, 별도 섹션 */
  undisclosed: AdmissionRow[];
}

/** 대학 행에 적용할 반영과목 조합 결정 (현재는 계열 기반 fallback) */
function pickCombo(row: AdmissionRow, studentTrack: Track | undefined): SubjectCombo {
  const track = row.track ?? studentTrack ?? '인문';
  return DEFAULT_COMBO_BY_TRACK[track];
}

function classify(gap: number): RiskBand {
  if (gap >= RISK_BANDS.stable) return '안정';
  if (gap >= RISK_BANDS.moderate) return '적정';
  return '소신';
}

export function match(
  admissions: AdmissionRow[],
  conversionTable: ConversionRow[],
  averages: ComboAverages,
  filters: MatchFilters = {},
): MatchOutput {
  const matched: MatchResult[] = [];
  const undisclosed: AdmissionRow[] = [];

  for (const row of admissions) {
    if (filters.track && row.track && row.track !== filters.track) continue;
    if (filters.region && row.region !== filters.region) continue;
    if (filters.admissionType && row.admissionType !== filters.admissionType) continue;

    // 입결 결측 → 임의 추정 금지, 별도 분리
    if (row.cutGrade == null) {
      undisclosed.push(row);
      continue;
    }

    const combo = pickCombo(row, filters.track);
    const avg5 = averages[combo];
    if (avg5 == null) continue; // 해당 조합 성적 미입력

    const est9 = convert(conversionTable, avg5).est9;
    const gap = round1(row.cutGrade - est9); // 양수 = 입결이 더 낮음(=학생이 더 우수, 여유)

    // 여유분 적용: 학생 환산등급이 입결 + 여유분 안쪽이면 지원가능권
    if (est9 <= row.cutGrade + MATCH_MARGIN) {
      matched.push({ row, appliedEst9: est9, appliedCombo: combo, band: classify(gap), gap });
    }
  }

  // 안정 → 적정 → 소신, 그 안에서 입결 우수 순
  matched.sort((a, b) => bandOrder(a.band) - bandOrder(b.band) || (a.row.cutGrade! - b.row.cutGrade!));
  return { matched, undisclosed };
}

function bandOrder(b: RiskBand): number {
  return b === '안정' ? 0 : b === '적정' ? 1 : 2;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
