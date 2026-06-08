import type { ComboAverages, SubjectCombo, SubjectInput } from '../types';

// ───────────────────────────────────────────────────────────
// [1단계] 전 과목 내신성적 입력 → 반영과목 조합별 5등급 가중평균
// ───────────────────────────────────────────────────────────

/** 각 조합에 포함되는 교과군 */
const COMBO_CATEGORIES: Record<SubjectCombo, SubjectInput['category'][]> = {
  전과목: ['국어', '수학', '영어', '사회', '과학', '기타'],
  국수영사과: ['국어', '수학', '영어', '사회', '과학'],
  국수영사: ['국어', '수학', '영어', '사회'],
  국수영과: ['국어', '수학', '영어', '과학'],
};

/** 단위수 가중평균. 입력이 없으면 null (미입력 과목 자동 제외) */
function weightedAverage(rows: SubjectInput[]): number | null {
  const valid = rows.filter(
    (r) => Number.isFinite(r.grade5) && r.grade5 > 0 && Number.isFinite(r.credits) && r.credits > 0,
  );
  if (valid.length === 0) return null;
  const totalCredits = valid.reduce((s, r) => s + r.credits, 0);
  const weighted = valid.reduce((s, r) => s + r.grade5 * r.credits, 0);
  return round2(weighted / totalCredits);
}

/** 반영과목 조합 4종의 평균을 동시 산출 */
export function computeComboAverages(subjects: SubjectInput[]): ComboAverages {
  const result = {} as ComboAverages;
  (Object.keys(COMBO_CATEGORIES) as SubjectCombo[]).forEach((combo) => {
    const cats = COMBO_CATEGORIES[combo];
    result[combo] = weightedAverage(subjects.filter((s) => cats.includes(s.category)));
  });
  return result;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
