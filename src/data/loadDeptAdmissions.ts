import type { ConversionRow, DeptRow } from '../types';

// 학과 입결 DB(public/data/deptAdmissions.json) 접근.
// 대학 canon 키로 그룹화돼 있음. 선택 대학명을 동일 canon으로 변환해 조회.

type DeptMap = Record<string, DeptRow[]>;

let cache: DeptMap | null = null;
let inflight: Promise<DeptMap> | null = null;

export function loadDeptAdmissions(): Promise<DeptMap> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    const url = `${import.meta.env.BASE_URL}data/deptAdmissions.json`;
    inflight = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<DeptMap>) : ({} as DeptMap)))
      .then((d) => {
        cache = d;
        return d;
      })
      .catch(() => {
        cache = {};
        return cache;
      });
  }
  return inflight;
}

/** ETL과 동일한 대학명 정규화(국립 제거·여대→여자대·과기대→과학기술대·캠퍼스 괄호 제거 등) */
export function canonUniv(name: string): string {
  let s = String(name ?? '').replace(/\s+/g, '').trim();
  s = s.replace(/^국립/, '');
  s = s.replace(/대\(([^)]*)\)학교/, '대학교');
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/여대/, '여자대');
  s = s.replace(/과기대/, '과학기술대');
  s = s.replace(/교대학교/, '교육대학교');
  return s;
}

export function deptsFor(map: DeptMap, univName: string): DeptRow[] {
  return map[canonUniv(univName)] ?? [];
}

/** 9등급 값을 환산표 기준 5등급으로 역환산(근사). 범위 밖은 끝점으로 클램프. */
export function nine2five(conversion: ConversionRow[], g9: number | null): number | null {
  if (g9 == null || conversion.length === 0) return null;
  const t = [...conversion].sort((a, b) => a.est9 - b.est9);
  if (g9 <= t[0].est9) return round2(t[0].avg5);
  const last = t[t.length - 1];
  if (g9 >= last.est9) return round2(last.avg5);
  for (let i = 0; i < t.length - 1; i++) {
    const lo = t[i];
    const hi = t[i + 1];
    if (g9 >= lo.est9 && g9 <= hi.est9) {
      const r = (g9 - lo.est9) / (hi.est9 - lo.est9);
      return round2(lo.avg5 + r * (hi.avg5 - lo.avg5));
    }
  }
  return round2(last.avg5);
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/** 9등급 컷(g50/g70)과 학생 환산등급(est9)으로 구간 판정 */
export function bandOf(est9: number, g50: number | null, g70: number | null): '안정' | '적정' | '소신' | '—' {
  if (g50 == null && g70 == null) return '—';
  if (g50 != null && est9 <= g50) return '안정';
  if (g70 != null && est9 <= g70) return '적정';
  return '소신';
}

// ── 교과전형 지원 대학·모집단위를 구분(안정/적정/소신)별로 수집 (최종 보고서용) ──
export interface GyoBandRow {
  band: '안정' | '적정' | '소신';
  univName: string;
  dept: string;
  type: string;
  g50: number | null;
  g70: number | null;
}
const BAND_RANK: Record<string, number> = { 안정: 0, 적정: 1, 소신: 2 };

/** 선택 대학의 교과전형 학과를 최신 연도 기준으로 밴드 판정해 수집·정렬. */
export function collectGyoBands(
  map: DeptMap,
  selectedUnivs: string[],
  desired: string,
  est9: number,
): GyoBandRow[] {
  const out: GyoBandRow[] = [];
  for (const univ of selectedUnivs) {
    const depts = deptsFor(map, univ).filter(
      (d) => (d.type ?? '').includes('교과') && deptMatches(d.dept, desired),
    );
    // type|detail|dept 기준 최신 연도 1건만.
    const latest = new Map<string, DeptRow>();
    for (const d of depts) {
      const k = `${d.type}|${d.detail}|${d.dept}`;
      const prev = latest.get(k);
      if (!prev || (d.year ?? 0) >= (prev.year ?? 0)) latest.set(k, d);
    }
    for (const d of latest.values()) {
      const band = bandOf(est9, d.g50, d.g70);
      if (band === '—') continue;
      out.push({ band, univName: univ, dept: d.dept, type: d.type, g50: d.g50, g70: d.g70 });
    }
  }
  out.sort(
    (a, b) =>
      BAND_RANK[a.band] - BAND_RANK[b.band] ||
      a.univName.localeCompare(b.univName) ||
      a.dept.localeCompare(b.dept),
  );
  return out;
}

// ── 학과명 80% 유사 매칭 ──
function normDept(s: string): string {
  return String(s ?? '')
    .replace(/\s/g, '')
    .replace(/(학과|학부|전공|계열|과)$/, '');
}
function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}
function dice(a: string, b: string): number {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.length === 0 || B.length === 0) return 0;
  const m = new Map<string, number>();
  for (const g of A) m.set(g, (m.get(g) ?? 0) + 1);
  let inter = 0;
  for (const g of B) {
    const c = m.get(g) ?? 0;
    if (c > 0) {
      inter++;
      m.set(g, c - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

/** 희망학과가 비어 있으면 항상 true(전체). 있으면 포함 또는 80%+ 유사 시 true. */
export function deptMatches(dept: string, desired: string): boolean {
  const b = normDept(desired);
  if (!b) return true;
  const a = normDept(dept);
  if (!a) return false;
  if (a.includes(b) || b.includes(a)) return true;
  return dice(a, b) >= 0.8;
}
