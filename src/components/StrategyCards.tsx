import type { SubjectStrategyCard } from '../types';

// ④ 교과전형 준비전략 카드 (분기 A)

interface Props {
  cards: SubjectStrategyCard[];
  subjectOnly: boolean;
}

export function StrategyCards({ cards }: Props) {
  if (cards.length === 0) return null;

  return (
    <div className="panel">
      <h2>④ 교과전형 준비전략</h2>
      <div className="card-grid">
        {cards.map((c, i) => (
          <article key={i} className="strategy-card">
            <header>
              <strong>{c.match.row.univName}</strong> · {c.match.row.unit}
              <span className={`band-tag band-${c.match.band}`}>{c.match.band}</span>
            </header>
            {c.detail ? (
              <dl>
                <div><dt>전형방법</dt><dd>{c.detail.method}</dd></div>
                <div><dt>수능최저</dt><dd>{c.detail.minCsat ?? '없음'}</dd></div>
                <div><dt>반영교과</dt><dd>{c.detail.reflectedSubjects} ({c.detail.reflectMethod})</dd></div>
                <div><dt>활용지표</dt><dd>{c.detail.indicator}</dd></div>
              </dl>
            ) : (
              <p className="muted">수도권 31개교 외 — 상세 전략 미제공(입결만)</p>
            )}
            <p className="advantage">{c.advantage}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
