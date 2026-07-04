import type { ComboAverages, ConversionResult, TriageResult } from '../types';

// ② 5등급 → 9등급 환산 결과. 현재 성적(조합 평균) + 환산 등급(범위) + 분기 안내.

interface Props {
  averages: ComboAverages;
  conv: ConversionResult;
  triage: TriageResult;
}

export function ConversionPanel({ averages, conv, triage }: Props) {
  const lo = conv.refRange ? conv.refRange.min : conv.est9;
  const hi = conv.refRange ? conv.refRange.max : conv.est9;

  return (
    <div className="panel">
      <h2>5등급 → 9등급</h2>
      <p className="convert-intro">
        <b>5등급 성적은 입시 결과가 아직 존재하지 않기 때문에, 성적을 기반으로 변환합니다.</b>
      </p>
      <p className="convert-sub muted">성적 입력 한 번으로 수시 지원이 가능한 모든 대학을 찾아냅니다.</p>

      <p className="convert-caption">5등급 체계에서 계산한 현재 성적</p>
      <div className="avg-grid">
        {(Object.keys(averages) as (keyof ComboAverages)[]).map((k) => (
          <div key={k} className="avg-cell">
            <span className="avg-label">{k}</span>
            <span className="avg-value">{averages[k] != null ? averages[k]!.toFixed(2) : '—'}</span>
          </div>
        ))}
      </div>

      <div className="convert-result">
        <span className="convert-result-num">{conv.est9.toFixed(2)}</span>
        <p className="convert-result-line">
          9등급 체제에서는 약 <b>{lo.toFixed(2)}</b>에서 <b>{hi.toFixed(2)}</b>등급에 해당합니다.
        </p>
      </div>

      {conv.extrapolated && (
        <p className="warn">
          ⚠ 환산표 커버리지(5등급 1.00~3.50)를 벗어났습니다. 추정치는 외삽값이므로 참고용으로만 활용하세요.
        </p>
      )}

      <p className={triage.subjectOnly ? 'triage subject-only' : 'triage'}>{triage.message}</p>
    </div>
  );
}
