import type {
  ComboAverages,
  MatchResult,
  SubjectStrategyCard,
  SubjectTrackRow,
} from '../types';

// ───────────────────────────────────────────────────────────
// [4단계] 교과전형 준비전략 (분기 A)
// 3단계 결과 중 학생부교과 항목을 대학교과전형_DB(수도권 31개교)와 조인,
// 반영방법에 학생 성적을 재투영하여 유불리 진단.
// ───────────────────────────────────────────────────────────

export function buildSubjectStrategies(
  matched: MatchResult[],
  subjectTrack: SubjectTrackRow[],
  averages: ComboAverages,
): SubjectStrategyCard[] {
  const byUniv = indexByUniv(subjectTrack);

  return matched
    .filter((m) => m.row.admissionType === '학생부교과')
    .map((m) => {
      const detail = findDetail(byUniv.get(m.row.univCode), m.row.admissionName);
      const reprojectedAvg5 = detail ? averages[detail.combo] : null;
      return {
        match: m,
        detail,
        reprojectedAvg5,
        advantage: diagnose(detail, averages),
      };
    });
}

function indexByUniv(rows: SubjectTrackRow[]): Map<string, SubjectTrackRow[]> {
  const map = new Map<string, SubjectTrackRow[]>();
  for (const r of rows) {
    const list = map.get(r.univCode) ?? [];
    list.push(r);
    map.set(r.univCode, list);
  }
  return map;
}

/** 전형명 우선 매칭, 없으면 첫 항목 */
function findDetail(rows: SubjectTrackRow[] | undefined, admissionName: string): SubjectTrackRow | null {
  if (!rows || rows.length === 0) return null;
  return rows.find((r) => r.admissionName === admissionName) ?? rows[0];
}

/** 반영방법 재투영 유불리 진단 */
function diagnose(
  detail: SubjectTrackRow | null,
  averages: ComboAverages,
): string {
  if (!detail) {
    return '수도권 31개교 외 대학이라 교과전형 상세 전략은 제공되지 않습니다(입결 정보만 참고).';
  }
  const comboAvg = averages[detail.combo];
  const allAvg = averages['전과목'];

  if (comboAvg == null || allAvg == null) {
    return `${detail.reflectedSubjects} 반영(${detail.reflectMethod}). 활용지표: ${detail.indicator}.`;
  }
  // 반영조합 평균이 전과목보다 좋으면 유리
  const diff = Math.round((allAvg - comboAvg) * 100) / 100;
  const verdict =
    diff > 0.05
      ? `반영조합(${detail.combo}) 평균이 전과목보다 ${diff.toFixed(2)}등급 우수 → 이 대학 반영방법에서 유리합니다.`
      : diff < -0.05
        ? `반영조합(${detail.combo}) 평균이 전과목보다 낮음 → 상대적으로 불리할 수 있습니다.`
        : '반영조합과 전과목 평균이 비슷합니다.';
  return `${detail.reflectedSubjects} 반영(${detail.reflectMethod}, ${detail.indicator}). ${verdict}`;
}
