import { useEffect, useMemo, useState } from 'react';
import type { AdmissionRow } from '../types';
import { getUniversityDetail } from '../data/loadUniversityDetail';

// 추천카드/행 클릭 시 표시되는 대학 상세 모달.
// ① 합격선 라인 요약(dataLayer admissions) + ② 대학별 상세 DB(HTML, lazy fetch).

interface Props {
  univName: string;
  admissions: AdmissionRow[];
  onClose: () => void;
  /** 있으면 모달 하단에 "다음 단계로 이동" 버튼 표시 */
  onNext?: () => void;
}

const TYPE_LABEL = (t: string) => t.replace('학생부', '');

export function UniversityDetailModal({ univName, admissions, onClose, onNext }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 해당 대학의 합격선 라인(계열·전형별) — 입결 우수(낮은 등급) 순
  const lines = useMemo(
    () =>
      admissions
        .filter((a) => a.univName === univName)
        .sort((a, b) => (a.cutGrade ?? 99) - (b.cutGrade ?? 99)),
    [admissions, univName],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setHtml(null);
    getUniversityDetail(univName).then((d) => {
      if (!active) return;
      setHtml(d);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [univName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${univName} 상세`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h3>{univName}</h3>
          <button className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </header>

        <div className="modal-body">
          {lines.length > 0 && (
            <section className="univ-lines">
              <h4>합격선 라인 (계열·전형별)</h4>
              <table className="result-table">
                <thead>
                  <tr><th>계열</th><th>전형</th><th>9등급 합격선</th><th>기준</th></tr>
                </thead>
                <tbody>
                  {lines.map((a, i) => (
                    <tr key={i}>
                      <td>{a.track ?? '—'}</td>
                      <td>{TYPE_LABEL(a.admissionType)}</td>
                      <td>{a.cutGrade?.toFixed(2) ?? '—'}</td>
                      <td className="muted">{a.cutBasis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="univ-detail">
            <h4>대학 상세 (전형방법·수능최저·반영교과 등)</h4>
            {loading ? (
              <p className="muted">상세 자료를 불러오는 중…</p>
            ) : html ? (
              <div className="univ-detail-html" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <p className="muted">이 대학의 상세 자료는 아직 준비되지 않았습니다. (합격선 라인만 제공)</p>
            )}
          </section>
        </div>

        {onNext && (
          <footer className="modal-foot">
            <button type="button" className="primary" onClick={onNext}>다음 단계로 이동 (4단계) →</button>
          </footer>
        )}
      </div>
    </div>
  );
}
