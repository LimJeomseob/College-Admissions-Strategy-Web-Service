import type { SubjectStrategyCard } from '../types';

// ④ 교과전형 준비전략 카드 (분기 A)

interface Props {
  cards: SubjectStrategyCard[];
  subjectOnly: boolean;
  onSelect?: (univName: string) => void;
}

export function StrategyCards({ cards, onSelect }: Props) {
  if (cards.length === 0) return null;

  return (
    <div className="panel">
      <h2>④ 교과전형 준비전략</h2>
      <p className="subtitle muted">카드를 클릭하면 해당 대학의 상세 정보를 볼 수 있습니다.</p>
      <div className="card-grid">
        {cards.map((c, i) => (
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
            {c.detail ? (
              <dl>
                <div><dt>전형방법</dt><dd>{c.detail.method}</dd></div>
                <div><dt>수능최저</dt><dd>{c.detail.minCsat ?? '없음'}</dd></div>
                <div><dt>반영교과</dt><dd>{c.detail.reflectedSubjects} ({c.detail.reflectMethod})</dd></div>
                <div><dt>활용지표</dt><dd>{c.detail.indicator}</dd></div>
              </dl>
            ) : (
              <p className="muted">교과 반영방법 상세 준비 중 — 입결 라인 기반 추천</p>
            )}
            <p className="advantage">{c.advantage}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
