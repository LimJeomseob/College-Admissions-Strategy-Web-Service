import { SUBJECT_ONLY_THRESHOLD } from '../config';
import type { TriageResult } from '../types';

// ───────────────────────────────────────────────────────────
// 전형 분기(triage)
// 추정 9등급이 3.5보다 낮으면(= 등급 숫자 >= 3.5) 학생부종합전형은
// 사실상 불필요 → 교과전형에만 집중하도록 안내.
// ───────────────────────────────────────────────────────────

export function triage(est9: number): TriageResult {
  const subjectOnly = est9 >= SUBJECT_ONLY_THRESHOLD;
  return {
    subjectOnly,
    threshold: SUBJECT_ONLY_THRESHOLD,
    message: subjectOnly
      ? `추정 9등급 ${est9.toFixed(2)}등급대에서는 학생부종합전형 경쟁력이 낮습니다. ` +
        `교과전형에 집중하여 반영방법이 유리한 대학을 공략하는 전략을 권장합니다.`
      : `추정 9등급 ${est9.toFixed(2)}등급대는 교과·종합 양 전형 모두 검토 가능합니다. ` +
        `(종합전형 상세 전략은 다음 단계에서 제공 예정)`,
  };
}
