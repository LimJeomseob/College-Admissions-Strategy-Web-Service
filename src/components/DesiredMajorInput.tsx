import { MAJOR_FAMILIES } from '../data/majorFamilies';

// 희망학과 자유입력 (datalist 제안) — 세션 한정, 저장하지 않음.

const SUGGESTIONS = Object.keys(MAJOR_FAMILIES);

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function DesiredMajorInput({ value, onChange }: Props) {
  return (
    <div className="desired-major">
      <label>
        희망학과 <small className="muted">(선택 · 결과 우선정렬용, 저장되지 않음)</small>
        <input
          list="major-suggestions"
          value={value}
          placeholder="예: 컴퓨터공학과, 경영학과"
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <datalist id="major-suggestions">
        {SUGGESTIONS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </div>
  );
}
