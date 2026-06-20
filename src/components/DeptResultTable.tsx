import { Fragment, useMemo, useState } from 'react';
import type { ConversionRow, DeptRow, RiskBand } from '../types';
import { bandOf, deptMatches, deptsFor, nine2five } from '../data/loadDeptAdmissions';

// ④ 지원가능 대학·학과 표
// - 구간/연도 필터, 정렬(구간/경쟁률/등급), 보기(연도별 행 / 학과별 연도 가로 펼침)
// - 대학별 그룹 헤더(접기) + 구간 요약 배지
// - 등급은 9등급 기준, 괄호는 5등급 환산(근사)

interface Row extends DeptRow {
  univName: string;
  band: RiskBand | '—';
}
interface Pivot {
  univName: string;
  type: string;
  detail: string;
  dept: string;
  byYear: Map<number, Row>;
  latest: Row;
  band: RiskBand | '—';
}
type SortBy = 'band' | 'comp' | 'grade';
type ViewMode = 'byYear' | 'byDept';

interface Props {
  selectedUnivs: string[];
  desiredMajor: string;
  est9: number;
  deptMap: Record<string, DeptRow[]>;
  conversion: ConversionRow[];
  loading: boolean;
}

const BAND_CLASS: Record<RiskBand, string> = { 안정: 'band-stable', 적정: 'band-moderate', 소신: 'band-reach' };
const BANDS: RiskBand[] = ['안정', '적정', '소신'];
const BAND_ORDER: Record<string, number> = { 안정: 0, 적정: 1, 소신: 2, '—': 3 };
const fmt = (n: number | null, d = 0) => (n == null ? '—' : n.toFixed(d));

export function DeptResultTable({ selectedUnivs, desiredMajor, est9, deptMap, conversion, loading }: Props) {
  const [bandFilter, setBandFilter] = useState<'all' | RiskBand>('all');
  const [yearFilter, setYearFilter] = useState<'all' | number>('all');
  const [sortBy, setSortBy] = useState<SortBy>('band');
  const [viewMode, setViewMode] = useState<ViewMode>('byYear');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { allRows, emptyUnivs, years } = useMemo(() => {
    const allRows: Row[] = [];
    const emptyUnivs: string[] = [];
    for (const univ of selectedUnivs) {
      const depts = deptsFor(deptMap, univ).filter((d) => deptMatches(d.dept, desiredMajor));
      if (depts.length === 0) emptyUnivs.push(univ);
      for (const d of depts) allRows.push({ ...d, univName: univ, band: bandOf(est9, d.g50, d.g70) });
    }
    const years = [...new Set(allRows.map((r) => r.year))].sort((a, b) => b - a);
    return { allRows, emptyUnivs, years };
  }, [selectedUnivs, desiredMajor, est9, deptMap]);
  const yearsAsc = useMemo(() => [...years].sort((a, b) => a - b), [years]);

  const cmpRow = (a: Row, b: Row) =>
    (sortBy === 'comp'
      ? (b.comp ?? -1) - (a.comp ?? -1)
      : sortBy === 'grade'
        ? (a.g50 ?? 99) - (b.g50 ?? 99)
        : BAND_ORDER[a.band] - BAND_ORDER[b.band]) ||
    a.dept.localeCompare(b.dept) ||
    b.year - a.year;
  const cmpPivot = (a: Pivot, b: Pivot) =>
    (sortBy === 'comp'
      ? (b.latest.comp ?? -1) - (a.latest.comp ?? -1)
      : sortBy === 'grade'
        ? (a.latest.g50 ?? 99) - (b.latest.g50 ?? 99)
        : BAND_ORDER[a.band] - BAND_ORDER[b.band]) || a.dept.localeCompare(b.dept);

  // 연도별 행 그룹 (대학 → 행[])
  const yearGroups = useMemo(() => {
    const rows = allRows
      .filter((r) => bandFilter === 'all' || r.band === bandFilter)
      .filter((r) => yearFilter === 'all' || r.year === yearFilter);
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const arr = map.get(r.univName) ?? [];
      arr.push(r);
      map.set(r.univName, arr);
    }
    return [...map.entries()].map(([u, rs]) => [u, rs.sort(cmpRow)] as const);
  }, [allRows, bandFilter, yearFilter, sortBy]);

  // 학과별 피벗 그룹 (대학 → 피벗[]) : 연도를 가로로
  const deptGroups = useMemo(() => {
    const pivots = new Map<string, Pivot>();
    for (const r of allRows) {
      const k = `${r.univName}|${r.type}|${r.detail}|${r.dept}`;
      let p = pivots.get(k);
      if (!p) {
        p = { univName: r.univName, type: r.type, detail: r.detail, dept: r.dept, byYear: new Map(), latest: r, band: r.band };
        pivots.set(k, p);
      }
      p.byYear.set(r.year, r);
      if (r.year >= p.latest.year) {
        p.latest = r;
        p.band = r.band;
      }
    }
    const map = new Map<string, Pivot[]>();
    for (const p of pivots.values()) {
      if (bandFilter !== 'all' && p.band !== bandFilter) continue;
      const arr = map.get(p.univName) ?? [];
      arr.push(p);
      map.set(p.univName, arr);
    }
    return [...map.entries()].map(([u, ps]) => [u, ps.sort(cmpPivot)] as const);
  }, [allRows, bandFilter, sortBy]);

  const groups = viewMode === 'byYear' ? yearGroups : deptGroups;
  const shownCount = groups.reduce((s, [, items]) => s + items.length, 0);
  const colCount = viewMode === 'byYear' ? 11 : 5 + yearsAsc.length;
  const toggle = (u: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(u)) next.delete(u);
      else next.add(u);
      return next;
    });
  const bandCounts = (items: { band: RiskBand | '—' }[]) =>
    BANDS.map((b) => [b, items.filter((it) => it.band === b).length] as const).filter(([, n]) => n > 0);

  if (selectedUnivs.length === 0) {
    return (
      <div className="panel">
        <h2>지원 가능 대학·학과</h2>
        <p className="muted">‘교과전형 준비전략’ 탭에서 지원할 대학을 선택하면 학과별 입결 표가 만들어집니다.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>지원 가능 대학·학과</h2>
      <p className="subtitle muted">
        선택 {selectedUnivs.length}개 대학 · {shownCount}개 {viewMode === 'byYear' ? '행' : '학과'}
        {desiredMajor ? ` · 희망학과 “${desiredMajor}” 80%+ 유사` : ' · 전체 학과'} · 등급은 <b>9등급</b> 기준(괄호 5등급 환산)
        {viewMode === 'byDept' && <> · 셀: 위=50%컷 / 아래=70%컷</>}
      </p>

      <div className="table-filters">
        <label>보기
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}>
            <option value="byYear">연도별 행</option>
            <option value="byDept">학과별(연도 가로)</option>
          </select>
        </label>
        <label>정렬
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="band">구간순</option>
            <option value="comp">실경쟁률순</option>
            <option value="grade">등급순</option>
          </select>
        </label>
        <label>구간
          <select value={bandFilter} onChange={(e) => setBandFilter(e.target.value as 'all' | RiskBand)}>
            <option value="all">전체</option>
            <option value="안정">안정</option>
            <option value="적정">적정</option>
            <option value="소신">소신</option>
          </select>
        </label>
        {viewMode === 'byYear' && (
          <label>학년도
            <select value={String(yearFilter)} onChange={(e) => setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              <option value="all">전체</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        )}
        {collapsed.size > 0 && (
          <button type="button" className="detail-btn" onClick={() => setCollapsed(new Set())}>모두 펼치기</button>
        )}
      </div>

      {loading ? (
        <p className="muted">입결 데이터를 불러오는 중…</p>
      ) : shownCount === 0 ? (
        <p className="muted">조건에 맞는 학과가 없습니다{desiredMajor ? ' (희망학과 조건을 비우면 전체 학과를 볼 수 있어요)' : ''}.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="result-table">
            <thead>
              {viewMode === 'byYear' ? (
                <tr>
                  <th>구간</th><th>대학</th><th>학년도</th><th>전형</th><th>세부전형</th>
                  <th>모집단위</th><th>모집인원</th><th>실경쟁률</th><th>추합</th><th>등급 50%컷</th><th>등급 70%컷</th>
                </tr>
              ) : (
                <tr>
                  <th>구간</th><th>대학</th><th>전형</th><th>세부전형</th><th>모집단위</th>
                  {yearsAsc.map((y) => <th key={y}>{y}</th>)}
                </tr>
              )}
            </thead>
            <tbody>
              {groups.map(([univ, items]) => {
                const isCol = collapsed.has(univ);
                return (
                  <Fragment key={univ}>
                    <tr className="dept-group-header" onClick={() => toggle(univ)}>
                      <td colSpan={colCount}>
                        <span className="caret">{isCol ? '▸' : '▾'}</span> <b>{univ}</b> · {items.length}개{' '}
                        <span className="band-badges">
                          {bandCounts(items as { band: RiskBand | '—' }[]).map(([b, n]) => (
                            <span key={b} className={`band-tag band-${b}`}>{b} {n}</span>
                          ))}
                        </span>
                      </td>
                    </tr>
                    {!isCol && viewMode === 'byYear' &&
                      (items as Row[]).map((r, i) => (
                        <tr key={i} className={r.band !== '—' ? BAND_CLASS[r.band] : undefined}>
                          <td><span className="band-tag">{r.band}</span></td>
                          <td>{r.univName}</td>
                          <td>{r.year}</td>
                          <td>{r.type.replace('전형', '')}</td>
                          <td>{r.detail || '—'}</td>
                          <td>{r.dept}</td>
                          <td>{fmt(r.quota)}</td>
                          <td>{r.comp == null ? '—' : `${r.comp.toFixed(2)}:1`}</td>
                          <td>{fmt(r.addPass)}</td>
                          <td>{cutCell(r.g50, conversion)}</td>
                          <td>{cutCell(r.g70, conversion)}</td>
                        </tr>
                      ))}
                    {!isCol && viewMode === 'byDept' &&
                      (items as Pivot[]).map((p, i) => (
                        <tr key={i} className={p.band !== '—' ? BAND_CLASS[p.band] : undefined}>
                          <td><span className="band-tag">{p.band}</span></td>
                          <td>{p.univName}</td>
                          <td>{p.type.replace('전형', '')}</td>
                          <td>{p.detail || '—'}</td>
                          <td>{p.dept}</td>
                          {yearsAsc.map((y) => {
                            const r = p.byYear.get(y);
                            return (
                              <td key={y}>
                                {r ? (
                                  <div className="pivot-cell">
                                    <span>{cutCell(r.g50, conversion)}</span>
                                    <span className="muted">{cutCell(r.g70, conversion)}</span>
                                  </div>
                                ) : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {emptyUnivs.length > 0 && (
        <p className="muted" style={{ marginTop: 8 }}>입결 데이터 없음: {emptyUnivs.join(', ')}</p>
      )}
    </div>
  );
}

// 9등급 컷 + (5등급 환산) 셀
function cutCell(g9: number | null, conversion: ConversionRow[]) {
  if (g9 == null) return '—';
  const five = nine2five(conversion, g9);
  return (
    <>
      {g9.toFixed(2)}
      {five != null && <small className="muted"> (5등 {five.toFixed(2)})</small>}
    </>
  );
}
