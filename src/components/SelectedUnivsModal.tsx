import { useEffect, useMemo } from 'react';
import type { AdmissionRow } from '../types';

// 선택한 대학을 한 번에 모아 보여주는 목록 팝업.
// 각 행: 대학명 + 대표 합격선(가장 낮은 9등급 라인) 요약 + 상세/해제 버튼.

interface Props {
  selectedUnivs: string[];
  admissions: AdmissionRow[];
  onClose: () => void;
  onDetail: (univName: string) => void;
  onToggle: (univName: string) => void;
}

const TYPE_LABEL = (t: string) => t.replace('학생부', '');

export function SelectedUnivsModal({ selectedUnivs, admissions, onClose, onDetail, onToggle }: Props) {
  // 대학별 대표 합격선 라인(가장 우수한 = 낮은 9등급) 미리 계산.
  const bestLine = useMemo(() => {
    const map = new Map<string, AdmissionRow>();
    for (const a of admissions) {
      const cur = map.get(a.univName);
      if (!cur || (a.cutGrade ?? 99) < (cur.cutGrade ?? 99)) map.set(a.univName, a);
    }
    return map;
  }, [admissions]);

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
        aria-label="선택한 대학 목록"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h3>선택한 대학 {selectedUnivs.length}개</h3>
          <button className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </header>

        <div className="modal-body">
          {selectedUnivs.length === 0 ? (
            <p className="muted">선택한 대학이 없습니다. ‘교과전형 준비전략’ 카드에서 대학을 선택하세요.</p>
          ) : (
            <ul className="selected-univ-list">
              {selectedUnivs.map((univ) => {
                const line = bestLine.get(univ);
                return (
                  <li key={univ} className="selected-univ-row">
                    <div className="selected-univ-info">
                      <strong>{univ}</strong>
                      <span className="muted">
                        {line
                          ? `${line.track ?? ''} ${TYPE_LABEL(line.admissionType)} · 9등급 합격선 ${line.cutGrade?.toFixed(2) ?? '—'}`.trim()
                          : '합격선 라인 정보 없음'}
                      </span>
                    </div>
                    <div className="selected-univ-actions">
                      <button type="button" className="detail-btn" onClick={() => onDetail(univ)}>상세</button>
                      <button type="button" className="detail-btn" onClick={() => onToggle(univ)}>해제</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
