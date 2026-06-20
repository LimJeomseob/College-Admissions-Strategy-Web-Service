import { useEffect, useState } from 'react';
import type { SubjectStrategyCard } from '../types';
import { loadUniversitySummaries, pickSummary } from '../data/loadUniversityDetail';

// ③ 교과전형 준비전략 카드 — 대학을 선택(토글)하면 ④ 지원가능 표가 만들어진다.
// 카드 클릭 = 선택, 카드 내 "상세" 버튼 = 대학 상세 모달.

interface Props {
  cards: SubjectStrategyCard[];
  selectedUnivs: string[];
  onToggle: (univName: string) => void;
  onDetail: (univName: string) => void;
}

export function StrategyCards({ cards, selectedUnivs, onToggle, onDetail }: Props) {
  const [summaries, setSummaries] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    loadUniversitySummaries().then((m) => active && setSummaries(m));
    return () => {
      active = false;
    };
  }, []);

  if (cards.length === 0) return null;
  const selected = new Set(selectedUnivs);

  return (
    <div className="panel">
      <h2>교과전형 준비전략</h2>
      <p className="subtitle muted">
        지원할 대학을 선택하세요(여러 개 가능). 선택하면 <b>‘지원 가능 대학·학과’ 탭</b>에 학과별 입결 표가 만들어집니다.
        {selectedUnivs.length > 0 && <> · 현재 <b>{selectedUnivs.length}개</b> 선택됨</>}
      </p>
      <div className="card-grid">
        {cards.map((c, i) => {
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
    </div>
  );
}
