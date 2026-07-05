import type { FinalReportData } from '../types';
import type { GyoBandRow } from '../data/loadDeptAdmissions';

// 최종 보고서 본문 렌더(요약·교과전형 구분표·대학·조언) — FinalReport(6단계)와 마이페이지 저장본에서 공용.

const BADGE_CLASS: Record<string, string> = {
  교과: 'rep-type-gyo',
  종합: 'rep-type-jong',
  '교과·종합': 'rep-type-both',
};
const GYO_BAND_CLASS: Record<string, string> = { 안정: 'band-안정', 적정: 'band-적정', 소신: 'band-소신' };

export function ReportContent({ report, gyo }: { report: FinalReportData; gyo?: GyoBandRow[] }) {
  return (
    <div className="report-body">
      <section className="report-section">
        <h3>진단 요약</h3>
        <p>{report.summary}</p>
      </section>

      {gyo && gyo.length > 0 && (
        <section className="report-section">
          <h3>교과전형 지원 가능 대학 · 안정/적정/소신</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="result-table">
              <thead>
                <tr><th>구분</th><th>대학</th><th>모집단위</th></tr>
              </thead>
              <tbody>
                {gyo.map((g, i) => (
                  <tr key={i}>
                    <td><span className={`band-tag ${GYO_BAND_CLASS[g.band] ?? ''}`}>{g.band}</span></td>
                    <td>{g.univName}</td>
                    <td>{g.dept}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="report-section">
        <h3>지원 대학 · 전형 구분</h3>
        <div className="report-univs">
          {report.universities.map((u, i) => (
            <article key={i} className="report-univ">
              <header>
                <strong>{u.name}</strong>
                <span className={`rep-type-badge ${BADGE_CLASS[u.type] ?? ''}`}>{u.type}</span>
              </header>
              {u.note && <p className="report-note">{u.note}</p>}
              {u.subjects.length > 0 && (
                <p className="report-subjects">
                  <span className="muted">권장 선택과목: </span>
                  {u.subjects.map((s, j) => (
                    <span key={j} className="subject-chip chip-rec">{s}</span>
                  ))}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="report-section">
        <h3>종합 조언</h3>
        <ul className="report-advice">
          {report.advice.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </section>

      <p className="muted report-foot">본 보고서는 AI가 자동 생성한 참고 자료이며, 실제 지원은 대학별 최신 요강을 확인하세요.</p>
    </div>
  );
}
