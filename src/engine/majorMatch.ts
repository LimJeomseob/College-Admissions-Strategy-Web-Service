import type { MatchOutput } from './match';
import type { MajorLookup } from '../data/majorFamilies';

// ───────────────────────────────────────────────────────────
// 희망학과 기반 결과 후처리 (match.ts 비변경 — 기존 테스트 byte-identical 보장)
// 행을 제거하지 않고, 희망학과/키워드와 일치하는 모집단위를 우선 정렬 +
// majorMatch 플래그만 부여한다.
// ───────────────────────────────────────────────────────────

export function annotateByMajor(output: MatchOutput, lookup: MajorLookup): MatchOutput {
  const needles = [lookup.major, ...lookup.families, ...lookup.keywords]
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (needles.length === 0) return output; // 입력 없음 → 무변경

  const matched = output.matched.map((m) => {
    const hay = `${m.row.unit} ${m.row.univName}`;
    const majorMatch = needles.some((n) => hay.includes(n));
    return { ...m, majorMatch };
  });

  // 희망학과 일치 항목을 위로(stable sort → 그룹 내 기존 밴드 정렬 보존)
  matched.sort((a, b) => (a.majorMatch ? 0 : 1) - (b.majorMatch ? 0 : 1));

  return { matched, undisclosed: output.undisclosed };
}
