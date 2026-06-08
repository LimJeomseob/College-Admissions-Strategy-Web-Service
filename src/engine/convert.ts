import { CONVERSION_COVERAGE } from '../config';
import type { ConversionResult, ConversionRow } from '../types';
import { round2 } from './grade';

// ───────────────────────────────────────────────────────────
// [2단계] 5등급 평균 → 9등급 추정 (선형 보간 + 외삽 경고)
// 기본 모형: 50:50 통합(부산교육청 + 대진대 동등가중)
// ───────────────────────────────────────────────────────────

/** 정렬된 환산표에서 avg5에 해당하는 9등급 추정치를 선형 보간 */
function interpolate(table: ConversionRow[], avg5: number, pick: (r: ConversionRow) => number): number {
  // table은 avg5 오름차순 가정
  const first = table[0];
  const last = table[table.length - 1];
  if (avg5 <= first.avg5) return pick(first);
  if (avg5 >= last.avg5) return pick(last);

  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i];
    const hi = table[i + 1];
    if (avg5 >= lo.avg5 && avg5 <= hi.avg5) {
      const t = (avg5 - lo.avg5) / (hi.avg5 - lo.avg5);
      return pick(lo) + t * (pick(hi) - pick(lo));
    }
  }
  return pick(last);
}

export function convert(table: ConversionRow[], avg5: number): ConversionResult {
  if (table.length === 0) {
    throw new Error('환산표가 비어 있습니다.');
  }
  const sorted = [...table].sort((a, b) => a.avg5 - b.avg5);
  const est9 = round2(interpolate(sorted, avg5, (r) => r.est9));

  // 참고 범위: 모형별 값의 min~max
  const refRow = nearestRow(sorted, avg5);
  const refVals = [refRow.refs.busan, refRow.refs.daejin, refRow.refs.gyeonggi].filter(
    (v): v is number => typeof v === 'number',
  );
  const refRange =
    refVals.length > 0 ? { min: round2(Math.min(...refVals)), max: round2(Math.max(...refVals)) } : null;

  const extrapolated = avg5 < CONVERSION_COVERAGE.min || avg5 > CONVERSION_COVERAGE.max;

  return { avg5: round2(avg5), est9, refRange, extrapolated };
}

function nearestRow(sorted: ConversionRow[], avg5: number): ConversionRow {
  return sorted.reduce((best, r) =>
    Math.abs(r.avg5 - avg5) < Math.abs(best.avg5 - avg5) ? r : best,
  );
}
