import { useMemo } from 'react';
import type { DeptRow, RiskBand } from '../types';
import { bandOf, deptMatches, deptsFor } from '../data/loadDeptAdmissions';

// ④ 지원가능 대학·학과 표 — 선택 대학 + 희망학과(80% 유사) 기반, 학과 입결 DB에서 작성.

interface Row extends DeptRow {
  univName: string;
  band: '안정' | '적정' | '소신' | '—';
}

interface Props {
  selectedUnivs: string[];
  desiredMajor: string;
  est9: number;
  deptMap: Record<string, DeptRow[]>;
  loading: boolean;
}

const BAND_CLASS: Record<RiskBand, string> = {
  안정: 'band-stable',
  적정: 'band-moderate',
  소신: 'band-reach',
};
const BAND_ORDER: Record<string, number> = { 안정: 0, 적정: 1, 소신: 2, '—': 3 };
const fmt = (n: number | null, d = 0) => (n == null ? '—' : n.toFixed(d));

export function DeptResultTable({ selectedUnivs, desiredMajor, est9, deptMap, loading }: Props) {
  const { rows, emptyUnivs } = useMemo(() => {
    const rows: Row[] = [];
    const emptyUnivs: string[] = [];
    for (const univ of selectedUnivs) {
      const depts = deptsFor(deptMap, univ).filter((d) => deptMatches(d.dept, desiredMajor));
      if (depts.length === 0) emptyUnivs.push(univ);
      for (const d of depts) rows.push({ ...d, univName: univ, band: bandOf(est9, d.g50, d.g70) });
    }
    rows.sort(
      (a, b) =>
        a.univName.localeCompare(b.univName) ||
        a.dept.localeCompare(b.dept) ||
        a.type.localeCompare(b.type) ||
        b.year - a.year,
    );
    return { rows, emptyUnivs };
  }, [selectedUnivs, desiredMajor, est9, deptMap]);

  if (selectedUnivs.length === 0) {
    return (
      <div className="panel">
        <h2>지원 가능 대학·학과</h2>
        <p className="muted">‘교과전형 준비전략’ 탭에서 지원할 대학을 선택하면 학과별 입결 표가 만들어집니다.</p>
      </div>
    );
  }

  // 구간 우선 정렬을 위해 그룹 정렬(안정→적정→소신) 적용
  const sorted = [...rows].sort((a, b) => BAND_ORDER[a.band] - BAND_ORDER[b.band]);

  return (
    <div className="panel">
      <h2>지원 가능 대학·학과</h2>
      <p className="subtitle muted">
        선택 {selectedUnivs.length}개 대학 · {rows.length}개 학과·연도
        {desiredMajor ? ` · 희망학과 “${desiredMajor}” 80%+ 유사` : ' · 전체 학과'}
        {' '}(등급50/70은 9등급 기준)
      </p>
      {loading ? (
        <p className="muted">입결 데이터를 불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="muted">선택한 대학의 입결 데이터가 없습니다{desiredMajor ? ' (희망학과 조건을 비우면 전체 학과를 볼 수 있어요)' : ''}.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="result-table">
            <thead>
              <tr>
                <th>구간</th><th>대학</th><th>학년도</th><th>전형</th><th>세부전형</th>
                <th>모집단위</th><th>모집인원</th><th>실경쟁률</th><th>추합</th><th>등급50</th><th>등급70</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
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
                  <td>{fmt(r.g50, 2)}</td>
                  <td>{fmt(r.g70, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {emptyUnivs.length > 0 && (
        <p className="muted" style={{ marginTop: 8 }}>
          입결 데이터 없음: {emptyUnivs.join(', ')}
        </p>
      )}
    </div>
  );
}
