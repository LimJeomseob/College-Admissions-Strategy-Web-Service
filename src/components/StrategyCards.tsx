import { useEffect, useMemo, useState } from 'react';
import type { SubjectStrategyCard } from '../types';
import { loadUniversitySummaries, pickSummary } from '../data/loadUniversityDetail';
import { regionOf, type Region } from '../data/univRegion';
import { RegionFilterModal } from './RegionFilterModal';

// ③ 교과 전형 지원 가능 대학 카드 — 대학을 선택(토글)하면 ④ 표가 만들어진다.
// 진입 시 지역 선택 팝업 자동 표시 → 선택 지역 대학만 소팅. 카드 내 "상세" = 대학 상세 모달.

interface Props {
  cards: SubjectStrategyCard[];
  selectedUnivs: string[];
  onToggle: (univName: string) => void;
  onDetail: (univName: string) => void;
}

export function StrategyCards({ cards, selectedUnivs, onToggle, onDetail }: Props) {
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [regions, setRegions] = useState<Set<Region>>(new Set());
  const [regionOpen, setRegionOpen] = useState(true); // 진입 시 자동 표시

  useEffect(() => {
    let active = true;
    loadUniversitySummaries().then((m) => active && setSummaries(m));
    return () => {
      active = false;
    };
  }, []);

  const shown = useMemo(
    () => (regions.size === 0 ? cards : cards.filter((c) => regions.has(regionOf(c.match.row.univName)))),
    [cards, regions],
  );

  if (cards.length === 0) return null;
  const selected = new Set(selectedUnivs);
  const regionLabel = regions.size === 0 ? '전체 지역' : [...regions].join('·');

  return (
    <div className="panel">
      <h2>3단계 교과 전형 지원 가능 대학</h2>
      <p className="subtitle muted">
        지원할 대학을 선택하세요(여러 개 가능).
        {selectedUnivs.length > 0 && <> · 현재 <b>{selectedUnivs.length}개</b> 선택됨</>}
      </p>
      <div className="table-filters">
        <button type="button" className="type-tab active" onClick={() => setRegionOpen(true)}>📍 지역 선택</button>
        <span className="muted" style={{ fontSize: '.85rem' }}>{regionLabel} · {shown.length}개 대학</span>
      </div>

      {regionOpen && (
        <RegionFilterModal
          initial={regions}
          onApply={(r) => { setRegions(r); setRegionOpen(false); }}
          onClose={() => setRegionOpen(false)}
        />
      )}

      {shown.length === 0 ? (
        <p className="muted">선택한 지역에 해당하는 추천 대학이 없습니다. 지역을 다시 선택해 보세요.</p>
      ) : (
      <div className="card-grid">
        {shown.map((c, i) => {
          const univ = c.match.row.univName;
          const summary = pickSummary(summaries, univ);
          const isSel = selected.has(univ);
          return (
            <article
              key={i}
              className={`strategy-card clickable${isSel ? ' selected' : ''}`}
              role="button"
              aria-pressed={isSel}
              tabIndex={0}
              onClick={() => onToggle(univ)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggle(univ);
                }
              }}
            >
              <header>
                <strong>{univ}</strong> · {c.match.row.unit}
                <span className={`band-tag band-${c.match.band}`}>{c.match.band}</span>
              </header>
              {summary ? (
                <p className="card-summary">{summary}</p>
              ) : (
                <p className="advantage">{c.advantage}</p>
              )}
              <div className="card-actions">
                <span className="select-hint">{isSel ? '✓ 선택됨 (클릭해 해제)' : '클릭하여 선택'}</span>
                <button
                  type="button"
                  className="detail-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDetail(univ);
                  }}
                >
                  상세
                </button>
              </div>
            </article>
          );
        })}
      </div>
      )}
    </div>
  );
}
