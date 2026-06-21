import { Fragment, useMemo, useState } from 'react';
import type { ConversionRow, DeptRow, RiskBand } from '../types';
import { bandOf, deptMatches, deptsFor, nine2five } from '../data/loadDeptAdmissions';

// 4단계 지원가능 대학·학과 표 — 선택 대학 + 희망학과 기반.
// 학과별 연도 가로(피벗) 고정. 대학별 그룹 헤더(접기)+구분 요약 배지. 정렬 선택.
// 등급 셀은 5등급(9등급) 표기, 셀 위=50%컷 / 아래=70%컷.

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

export function DeptResultTable({ selectedUnivs, desiredMajor, est9, deptMap, conversion, loading }: Props) {
  const [bandFilter, setBandFilter] = useState<'all' | RiskBand>('all');
  const [sortBy, setSortBy] = useState<SortBy>('band');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { allRows, emptyUnivs, yearsAsc } = useMemo(() => {
    const allRows: Row[] = [];
    const emptyUnivs: string[] = [];
    for (const univ of selectedUnivs) {
      const depts = deptsFor(deptMap, univ).filter((d) => deptMatches(d.dept, desiredMajor));
      if (depts.length === 0) emptyUnivs.push(univ);
      for (const d of depts) allRows.push({ ...d, univName: univ, band: bandOf(est9, d.g50, d.g70) });
    }
    const yearsAsc = [...new Set(allRows.map((r) => r.year))].sort((a, b) => a - b);
    return { allRows, emptyUnivs, yearsAsc };
  }, [selectedUnivs, desiredMajor, est9, deptMap]);

  const cmpPivot = (a: Pivot, b: Pivot) =>
    (sortBy === 'comp'
      ? (b.latest.comp ?? -1) - (a.latest.comp ?? -1)
      : sortBy === 'grade'
        ? (a.latest.g50 ?? 99) - (b.latest.g50 ?? 99)
        : BAND_ORDER[a.band] - BAND_ORDER[b.band]) || a.dept.localeCompare(b.dept);

  // 학과별 피벗 그룹 (대학 → 피벗[]) : 연도를 가로로
  const groups = useMemo(() => {
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

  const shownCount = groups.reduce((s, [, items]) => s + items.length, 0);
  const colCount = 5 + yearsAsc.length;
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
        <h2>4단계 지원 가능 대학·학과</h2>
        <p className="muted">‘교과전형 준비전략’ 탭에서 지원할 대학을 선택하면 학과별 입결 표가 만들어집니다.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>4단계 지원 가능 대학·학과</h2>
      <p className="subtitle muted">
        선택 {selectedUnivs.length}개 대학 · {shownCount}개 학과
        {desiredMajor ? ` · 희망학과 “${desiredMajor}”` : ' · 전체 학과'} · 셀: 위=50%컷 / 아래=70%컷, 5등급(9등급)
      </p>

      <div className="table-filters">
        <label>정렬
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="band">구분순</option>
            <option value="comp">실경쟁률순</option>
            <option value="grade">등급순</option>
          </select>
        </label>
        <label>구분
          <select value={bandFilter} onChange={(e) => setBandFilter(e.target.value as 'all' | RiskBand)}>
            <option value="all">전체</option>
            <option value="안정">안정</option>
            <option value="적정">적정</option>
            <option value="소신">소신</option>
          </select>
        </label>
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
              <tr>
                <th>구분</th><th>대학</th><th>전형</th><th>세부전형</th><th>모집단위</th>
                {yearsAsc.map((y) => <th key={y}>{y}</th>)}
              </tr>
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
                          {bandCounts(items).map(([b, n]) => (
                            <span key={b} className={`band-tag band-${b}`}>{b} {n}</span>
                          ))}
                        </span>
                      </td>
                    </tr>
                    {!isCol &&
                      items.map((p, i) => (
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

// 등급 셀: 5등급(9등급) — '5등' 글자 미표기, 5등급을 앞에 표시
function cutCell(g9: number | null, conversion: ConversionRow[]) {
  if (g9 == null) return '—';
  const five = nine2five(conversion, g9);
  return five == null ? g9.toFixed(2) : `${five.toFixed(2)} (${g9.toFixed(2)})`;
}
