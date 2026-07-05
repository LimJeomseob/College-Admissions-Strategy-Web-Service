import { Fragment, useMemo, useState } from 'react';
import type { ConversionRow, DeptRow, JonghapPick, RiskBand } from '../types';
import { bandOf, deptMatches, deptsFor, nine2five } from '../data/loadDeptAdmissions';

/** 종합전형 선택 키 (5단계 추천 연동) */
export const pickKey = (p: { univName: string; type: string; detail: string; dept: string }) =>
  `${p.univName}|${p.type}|${p.detail}|${p.dept}`;

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
type TypeFilter = 'all' | '교과' | '종합';
const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: '교과', label: '교과전형 모아보기' },
  { key: '종합', label: '종합전형 모아보기' },
];
const BAND_TABS: ('all' | RiskBand)[] = ['all', '안정', '적정', '소신'];
const SORT_TABS: { key: SortBy; label: string }[] = [
  { key: 'band', label: '구분순' },
  { key: 'comp', label: '경쟁률순' },
  { key: 'grade', label: '등급순' },
];

interface Props {
  selectedUnivs: string[];
  desiredMajor: string;
  est9: number;
  deptMap: Record<string, DeptRow[]>;
  conversion: ConversionRow[];
  loading: boolean;
  /** 5단계 연동: 선택된 종합전형 항목 키 집합 */
  selectedJonghap: Set<string>;
  onToggleJonghap: (pick: JonghapPick) => void;
  /** 최종보고서 연동: 선택된 교과전형 항목 키 집합 */
  selectedGyo: Set<string>;
  onToggleGyo: (pick: JonghapPick) => void;
}

const isJonghap = (type: string) => type.includes('종합');

const BAND_CLASS: Record<RiskBand, string> = { 안정: 'band-stable', 적정: 'band-moderate', 소신: 'band-reach' };
const BANDS: RiskBand[] = ['안정', '적정', '소신'];
const BAND_ORDER: Record<string, number> = { 안정: 0, 적정: 1, 소신: 2, '—': 3 };

export function DeptResultTable({
  selectedUnivs,
  desiredMajor,
  est9,
  deptMap,
  conversion,
  loading,
  selectedJonghap,
  onToggleJonghap,
  selectedGyo,
  onToggleGyo,
}: Props) {
  const [bandFilter, setBandFilter] = useState<'all' | RiskBand>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('band');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { allRows, emptyUnivs, yearsDesc } = useMemo(() => {
    const allRows: Row[] = [];
    const emptyUnivs: string[] = [];
    for (const univ of selectedUnivs) {
      const depts = deptsFor(deptMap, univ).filter((d) => deptMatches(d.dept, desiredMajor));
      if (depts.length === 0) emptyUnivs.push(univ);
      for (const d of depts) allRows.push({ ...d, univName: univ, band: bandOf(est9, d.g50, d.g70) });
    }
    const yearsDesc = [...new Set(allRows.map((r) => r.year))].sort((a, b) => b - a);
    return { allRows, emptyUnivs, yearsDesc };
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
      if (typeFilter === '교과' && !p.type.includes('교과')) continue;
      if (typeFilter === '종합' && !isJonghap(p.type)) continue;
      const arr = map.get(p.univName) ?? [];
      arr.push(p);
      map.set(p.univName, arr);
    }
    return [...map.entries()].map(([u, ps]) => [u, ps.sort(cmpPivot)] as const);
  }, [allRows, bandFilter, typeFilter, sortBy]);

  const shownCount = groups.reduce((s, [, items]) => s + items.length, 0);
  const colCount = 5 + yearsDesc.length;
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
        <h2>4단계 수시 지원의 교과·종합 전형 추천 대학</h2>
        <p className="muted">이전 단계에서 지원할 대학을 먼저 선택해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>4단계 수시 지원의 교과·종합 전형 추천 대학</h2>
      <p className="subtitle muted">
        선택 {selectedUnivs.length}개 대학 · {shownCount}개 학과
        {desiredMajor ? ` · 희망학과 “${desiredMajor}”` : ' · 전체 학과'} · 셀: 위=50%컷 / 아래=70%컷, 5등급(9등급)
      </p>
      <p className="subtitle muted">💡 <b>종합</b> 글자를 누르면 5단계 선택과목 추천에, <b>교과</b> 글자를 누르면 최종 보고서 표에 담깁니다.</p>

      <div className="type-tabs" role="tablist">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={typeFilter === t.key}
            className={`type-tab${typeFilter === t.key ? ' active' : ''}`}
            onClick={() => setTypeFilter(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="table-filters">
        <div className="band-btns" role="group" aria-label="구분">
          {BAND_TABS.map((b) => (
            <button
              key={b}
              type="button"
              className={`band-btn${bandFilter === b ? ' active' : ''}${b !== 'all' ? ` band-${b}` : ''}`}
              onClick={() => setBandFilter(b)}
            >
              {b === 'all' ? '전체' : b}
            </button>
          ))}
        </div>
        <div className="sort-group" role="group" aria-label="정렬">
          <span className="filter-cap">정렬</span>
          {SORT_TABS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`band-btn${sortBy === s.key ? ' active' : ''}`}
              onClick={() => setSortBy(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
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
                {yearsDesc.map((y) => <th key={y}>{y}</th>)}
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
                      items.map((p, i) => {
                        const jong = isJonghap(p.type);
                        const gyo = !jong && p.type.includes('교과');
                        const picked = jong && selectedJonghap.has(pickKey(p));
                        const gyoPicked = gyo && selectedGyo.has(pickKey(p));
                        const cls = [
                          p.band !== '—' ? BAND_CLASS[p.band] : '',
                          picked || gyoPicked ? 'jonghap-selected' : '',
                        ].filter(Boolean).join(' ') || undefined;
                        return (
                        <tr key={i} className={cls}>
                          <td><span className="band-tag">{p.band}</span>{(picked || gyoPicked) && <span className="jonghap-check"> ✓</span>}</td>
                          <td>{p.univName}</td>
                          <td>
                            {jong ? (
                              <button
                                type="button"
                                className={`jonghap-type-btn${picked ? ' picked' : ''}`}
                                onClick={() => onToggleJonghap({ univName: p.univName, type: p.type, detail: p.detail, dept: p.dept })}
                                title="클릭하면 5단계 선택과목 추천에 담깁니다"
                              >
                                {p.type.replace('전형', '')}
                              </button>
                            ) : gyo ? (
                              <button
                                type="button"
                                className={`jonghap-type-btn${gyoPicked ? ' picked' : ''}`}
                                onClick={() => onToggleGyo({ univName: p.univName, type: p.type, detail: p.detail, dept: p.dept })}
                                title="클릭하면 최종 보고서 교과전형 표에 담깁니다"
                              >
                                {p.type.replace('전형', '')}
                              </button>
                            ) : (
                              p.type.replace('전형', '')
                            )}
                          </td>
                          <td>{p.detail || '—'}</td>
                          <td>{p.dept}</td>
                          {yearsDesc.map((y) => {
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
                        );
                      })}
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
