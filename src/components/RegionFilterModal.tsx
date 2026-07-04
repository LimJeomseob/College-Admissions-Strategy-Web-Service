import { useEffect, useState } from 'react';
import { REGION_GROUPS, type Region } from '../data/univRegion';

// 3단계 진입 시 자동으로 뜨는 지역 선택 팝업.
// 체크박스로 시·도를 고르면 해당 지역 대학만 표시(미선택 = 전체).

interface Props {
  initial: Set<Region>;
  onApply: (regions: Set<Region>) => void;
  onClose: () => void;
}

export function RegionFilterModal({ initial, onApply, onClose }: Props) {
  const [sel, setSel] = useState<Set<Region>>(new Set(initial));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (r: Region) =>
    setSel((prev) => {
      const next = new Set(prev);
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" role="dialog" aria-modal="true" aria-label="지역 선택" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>지역 선택</h3>
          <button className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </header>

        <div className="modal-body">
          <p className="subtitle muted">보고 싶은 지역을 선택하세요. 선택하지 않으면 전체 지역이 표시됩니다.</p>
          {REGION_GROUPS.map((g) => (
            <div key={g.label} className="region-group">
              <span className="region-group-label">{g.label}</span>
              <div className="region-chips">
                {g.regions.map((r) => (
                  <label key={r} className={`region-chip${sel.has(r) ? ' on' : ''}`}>
                    <input type="checkbox" checked={sel.has(r)} onChange={() => toggle(r)} />
                    {r}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <footer className="modal-foot region-foot">
          <button type="button" className="detail-btn" onClick={() => setSel(new Set())}>전체 해제</button>
          <button type="button" className="primary" onClick={() => onApply(sel)}>적용</button>
        </footer>
      </div>
    </div>
  );
}
