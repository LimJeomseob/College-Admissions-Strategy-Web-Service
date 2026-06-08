import type { ComboAverages, ConversionResult, TriageResult } from '../types';

// ② 환산 결과 + 4종 조합 평균 표시 + 분기 안내

interface Props {
  averages: ComboAverages;
  conv: ConversionResult;
  triage: TriageResult;
}

export function ConversionPanel({ averages, conv, triage }: Props) {
  return (
    <div className="panel">
      <h2>② 성적 체계 환산</h2>
      <div className="avg-grid">
        {(Object.keys(averages) as (keyof ComboAverages)[]).map((k) => (
          <div key={k} className="avg-cell">
            <span className="avg-label">{k}</span>
            <span className="avg-value">{averages[k] != null ? averages[k]!.toFixed(2) : '—'}</span>
          </div>
        ))}
      </div>

      <p className="convert-line">
        전과목 5등급 평균 <b>{conv.avg5.toFixed(2)}</b> → 9등급 추정{' '}
        <b className="est9">{conv.est9.toFixed(2)}</b>
        {conv.refRange && (
          <span className="ref-range"> (참고 범위 {conv.refRange.min.toFixed(2)}~{conv.refRange.max.toFixed(2)})</span>
        )}
      </p>

      {conv.extrapolated && (
        <p className="warn">
          ⚠ 환산표 커버리지(5등급 1.00~3.50)를 벗어났습니다. 추정치는 외삽값이므로 참고용으로만 활용하세요.
        </p>
      )}

      <p className={triage.subjectOnly ? 'triage subject-only' : 'triage'}>{triage.message}</p>
    </div>
  );
}
