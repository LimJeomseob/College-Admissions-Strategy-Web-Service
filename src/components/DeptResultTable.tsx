import { Fragment, useMemo, useState } from 'react';
import type { ConversionRow, DeptRow, RiskBand } from '../types';
import { bandOf, deptMatches, deptsFor, nine2five } from '../data/loadDeptAdmissions';

// ④ 지원가능 대학·학과 표 — 선택 대학 + 희망학과(80% 유사) 기반.
// 구간/연도 필터 · 대학별 그룹 헤더(접기) · 등급은 9등급 기준(5등급 환산 병기).

interface Row extends DeptRow {
  univName: string;
  band: '안정' | '적정' | '소신' | '—';
}

interface Props {
  selectedUnivs: string[];
  desiredMajor: string;
  est9: number;
  deptMap: Record<string, DeptRow[]>;
  conversion: ConversionRow[];
  loading: boolean;
}

const BAND_CLASS: Record<RiskBand, string> = {
  안정: 'band-stable',
  적정: 'band-moderate',
  소신: 'band-reach',
};
const BAND_ORDER: Record<string, number> = { 안정: 0, 적정: 1, 소신: 2, '—': 3 };
const fmt = (n: number | null, d = 0) => (n == null ? '—' : n.toFixed(d));

export function DeptResultTable({ selectedUnivs, desiredMajor, est9, deptMap, conversion, loading }: Props) {
  const [bandFilter, setBandFilter] = useState<'all' | RiskBand>('all');
  const [yearFilter, setYearFilter] = useState<'all' | number>('all');
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

  // 필터 → 정렬(대학 → 구간 → 학과 → 연도desc) → 대학별 그룹화
  const groups = useMemo(() => {
    const rows = allRows
      .filter((r) => bandFilter === 'all' || r.band === bandFilter)
      .filter((r) => yearFilter === 'all' || r.year === yearFilter)
      .sort(
        (a, b) =>
          a.univName.localeCompare(b.univName) ||
          BAND_ORDER[a.band] - BAND_ORDER[b.band] ||
          a.dept.localeCompare(b.dept) ||
          b.year - a.year,
      );
    const map = new Map<string, Row[]>();
    for (const r of rows) (map.get(r.univName) ?? map.set(r.univName, []).get(r.univName)!).push(r);
    return [...map.entries()];
  }, [allRows, bandFilter, yearFilter]);

  const shownCount = groups.reduce((s, [, rs]) => s + rs.length, 0);
  const toggle = (u: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(u) ? next.delete(u) : next.add(u);
      return next;
    });

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
        선택 {selectedUnivs.length}개 대학 · {shownCount}/{allRows.length}개 행
        {desiredMajor ? ` · 희망학과 “${desiredMajor}” 80%+ 유사` : ' · 전체 학과'}
        {' '}· 등급은 <b>9등급</b> 기준, 괄호는 5등급 환산(근사)
      </p>

      <div className="table-filters">
        <label>구간
          <select value={bandFilter} onChange={(e) => setBandFilter(e.target.value as 'all' | RiskBand)}>
            <option value="all">전체</option>
            <option value="안정">안정</option>
            <option value="적정">적정</option>
            <option value="소신">소신</option>
          </select>
        </label>
        <label>학년도
          <select value={String(yearFilter)} onChange={(e) => setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">전체</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
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
                <th>구간</th><th>대학</th><th>학년도</th><th>전형</th><th>세부전형</th>
                <th>모집단위</th><th>모집인원</th><th>실경쟁률</th><th>추합</th>
                <th>등급 50%컷</th><th>등급 70%컷</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([univ, rs]) => {
                const isCol = collapsed.has(univ);
                return (
                  <Fragment key={univ}>
                    <tr className="dept-group-header" onClick={() => toggle(univ)}>
                      <td colSpan={11}>
                        <span className="caret">{isCol ? '▸' : '▾'}</span> <b>{univ}</b> · {rs.length}개 행
                      </td>
                    </tr>
                    {!isCol &&
                      rs.map((r, i) => (
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
