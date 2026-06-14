import { useEffect, useState } from 'react';
import type { SubjectStrategyCard } from '../types';
import { loadUniversitySummaries, pickSummary } from '../data/loadUniversityDetail';

// ④ 교과전형 준비전략 카드 (분기 A)
// 대학 상세를 2줄로 요약해 안내하고, 클릭하면 전체 상세 모달을 연다.

interface Props {
  cards: SubjectStrategyCard[];
  subjectOnly: boolean;
  onSelect?: (univName: string) => void;
}

export function StrategyCards({ cards, onSelect }: Props) {
  const [summaries, setSummaries] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    loadUniversitySummaries().then((m) => active && setSummaries(m));
    return () => {
      active = false;
    };
  }, []);

  if (cards.length === 0) return null;

  return (
    <div className="panel">
      <h2>④ 교과전형 준비전략</h2>
      <p className="subtitle muted">카드를 클릭하면 해당 대학의 상세 정보를 볼 수 있습니다.</p>
      <div className="card-grid">
        {cards.map((c, i) => {
          const summary = pickSummary(summaries, c.match.row.univName);
          return (
            <article
              key={i}
              className={`strategy-card${onSelect ? ' clickable' : ''}`}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onClick={onSelect ? () => onSelect(c.match.row.univName) : undefined}
              onKeyDown={
                onSelect
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(c.match.row.univName);
                      }
                    }
                  : undefined
              }
            >
              <header>
                <strong>{c.match.row.univName}</strong> · {c.match.row.unit}
                <span className={`band-tag band-${c.match.band}`}>{c.match.band}</span>
              </header>
              {summary ? (
                <p className="card-summary">{summary}</p>
              ) : (
                <p className="advantage">{c.advantage}</p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
