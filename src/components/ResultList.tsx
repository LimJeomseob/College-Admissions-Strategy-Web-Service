import type { MatchOutput } from '../engine';
import type { RiskBand } from '../types';

// ③ 결과: 지원가능 리스트 + 입결 미공개 섹션

const BAND_CLASS: Record<RiskBand, string> = {
  안정: 'band-stable',
  적정: 'band-moderate',
  소신: 'band-reach',
};

interface Props {
  output: MatchOutput;
  subjectOnly: boolean;
}

export function ResultList({ output, subjectOnly }: Props) {
  const list = subjectOnly
    ? output.matched.filter((m) => m.row.admissionType === '학생부교과')
    : output.matched;

  return (
    <div className="panel">
      <h2>③ 지원 가능 대학·학과 {subjectOnly && <small>(교과전형 집중)</small>}</h2>
      {list.length === 0 ? (
        <p>지원 가능권에 해당하는 모집단위가 없습니다. 필터/성적을 확인하세요.</p>
      ) : (
        <table className="result-table">
          <thead>
            <tr>
              <th>구간</th>
              <th>대학</th>
              <th>모집단위</th>
              <th>전형</th>
              <th>입결(기준)</th>
              <th>3개년</th>
              <th>경쟁률</th>
              <th>수능최저</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m, i) => (
              <tr key={i} className={BAND_CLASS[m.band]}>
                <td><span className="band-tag">{m.band}</span></td>
                <td>{m.row.univName}</td>
                <td>
                  {m.row.unit}
                  {m.majorMatch && <span className="major-badge">희망</span>}
                </td>
                <td>{m.row.admissionType.replace('학생부', '')}</td>
                <td>
                  {m.row.cutGrade?.toFixed(2)}
                  <small className="basis"> ({m.row.cutBasis})</small>
                </td>
                <td className="history">
                  {m.row.history.map((h) => (h.grade != null ? h.grade.toFixed(1) : '–')).join(' / ')}
                </td>
                <td>{m.row.competitionRate != null ? `${m.row.competitionRate.toFixed(1)}:1` : '—'}</td>
                <td>{m.row.minCsat ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {output.undisclosed.length > 0 && (
        <details className="undisclosed">
          <summary>입결 미공개 모집단위 ({output.undisclosed.length}건) — 임의 추정 없이 별도 표시</summary>
          <ul>
            {output.undisclosed.map((r, i) => (
              <li key={i}>{r.univName} · {r.unit} · {r.admissionType.replace('학생부', '')}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
