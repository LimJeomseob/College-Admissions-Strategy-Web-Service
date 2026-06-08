import type { MatchOutput } from './match';
import type { MatchResult } from '../types';
import type { MajorLookup } from '../data/majorFamilies';

// ───────────────────────────────────────────────────────────
// 희망학과/계열 부합 표시 + 우선 정렬
// match.ts 를 건드리지 않고 결과만 후처리 → 기존 테스트 불변.
// 행을 제거하지 않고(band 분류 보존), 부합 항목을 각 구간 내에서 앞으로 올린다.
// ───────────────────────────────────────────────────────────

function matchesMajor(unit: string, keywords: string[]): boolean {
  if (!unit) return false;
  const u = unit.replace(/\s+/g, '').toLowerCase();
  return keywords.some((k) => {
    const kk = k.replace(/\s+/g, '').toLowerCase();
    return kk.length > 0 && u.includes(kk);
  });
}

/** 희망학과 lookup 결과로 matched 에 majorMatch 플래그를 달고 부합 항목을 우선 정렬 */
export function annotateByMajor(output: MatchOutput, lookup: MajorLookup): MatchOutput {
  if (!lookup.keywords.length) return output;

  const annotated: MatchResult[] = output.matched.map((m) => ({
    ...m,
    majorMatch: matchesMajor(m.row.unit, lookup.keywords),
  }));

  // 안정/적정/소신 순서는 보존하고, 같은 구간 안에서 부합 항목을 앞으로.
  const bandOrder = (b: MatchResult['band']) => (b === '안정' ? 0 : b === '적정' ? 1 : 2);
  const sorted = annotated
    .map((m, i) => ({ m, i }))
    .sort(
      (a, b) =>
        bandOrder(a.m.band) - bandOrder(b.m.band) ||
        Number(b.m.majorMatch) - Number(a.m.majorMatch) ||
        a.i - b.i,
    )
    .map(({ m }) => m);

  return { matched: sorted, undisclosed: output.undisclosed };
}
