import { useState } from 'react';
import type { SubjectInput, Track } from '../types';
import { parseGradeFile } from '../data/parseGradeFile';
import { MAJOR_FAMILIES, lookupMajor } from '../data/majorFamilies';

// ① 입력 계층: 성적표 양식 표 형태 입력 + 파일 업로드 + 희망학과

const CATEGORIES: SubjectInput['category'][] = ['국어', '수학', '영어', '사회', '과학', '기타'];

interface Props {
  track: Track;
  onTrackChange: (t: Track) => void;
  onSubmit: (rows: SubjectInput[]) => void;
  desiredMajor: string;
  onDesiredMajorChange: (v: string) => void;
}

interface Row {
  category: SubjectInput['category'];
  name: string;
  grade5: string;
  credits: string;
}

const emptyRow = (): Row => ({ category: '국어', name: '', grade5: '', credits: '' });

const TEMPLATE_URL = `${import.meta.env.BASE_URL}templates/grade-template.csv`;

export function GradeInputForm({ track, onTrackChange, onSubmit, desiredMajor, onDesiredMajorChange }: Props) {
  const [rows, setRows] = useState<Row[]>([
    { category: '국어', name: '국어', grade5: '2', credits: '4' },
    { category: '수학', name: '수학', grade5: '3', credits: '4' },
    { category: '영어', name: '영어', grade5: '2', credits: '4' },
    { category: '사회', name: '통합사회', grade5: '2', credits: '3' },
    { category: '과학', name: '통합과학', grade5: '3', credits: '3' },
  ]);
  const [upload, setUpload] = useState<{ kind: 'warn' | 'error'; lines: string[] } | null>(null);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재업로드 허용
    if (!file) return;
    try {
      const parsed = await parseGradeFile(file);
      setRows(
        parsed.rows.map((r) => ({
          category: r.category,
          name: r.name,
          grade5: String(r.grade5),
          credits: String(r.credits),
        })),
      );
      if (parsed.track) onTrackChange(parsed.track);
      setUpload(
        parsed.warnings.length
          ? { kind: 'warn', lines: [`${parsed.rows.length}개 과목을 불러왔습니다.`, ...parsed.warnings] }
          : { kind: 'warn', lines: [`${parsed.rows.length}개 과목을 불러왔습니다.`] },
      );
    } catch (err) {
      setUpload({ kind: 'error', lines: [(err as Error).message] });
    }
  };

  const submit = () => {
    const parsed: SubjectInput[] = rows
      .map((r) => ({
        category: r.category,
        name: r.name,
        grade5: parseFloat(r.grade5),
        credits: parseFloat(r.credits),
      }))
      .filter((r) => Number.isFinite(r.grade5) && Number.isFinite(r.credits));
    onSubmit(parsed);
  };

  const families = lookupMajor(desiredMajor).families;

  return (
    <section className="input-form">
      <h2>① 성적 입력</h2>

      <div className="upload-box">
        <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
          파일 업로드
          <input
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </label>
        <a href={TEMPLATE_URL} download className="hint">양식 다운로드(CSV)</a>
        <span className="hint">엑셀(.xlsx)·CSV·텍스트(.txt) 지원 — 헤더: 과목구분, 과목명, 등급, 단위수</span>
      </div>
      {upload && (
        upload.kind === 'error'
          ? <p className="error">{upload.lines[0]}</p>
          : <ul className="upload-warnings">{upload.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      )}

      <div className="track-select">
        계열:
        {(['인문', '자연'] as Track[]).map((t) => (
          <label key={t}>
            <input type="radio" checked={track === t} onChange={() => onTrackChange(t)} /> {t}
          </label>
        ))}
      </div>

      <div className="desired-major">
        <label htmlFor="desired-major-input">희망학과:</label>
        <input
          id="desired-major-input"
          list="major-list"
          value={desiredMajor}
          onChange={(e) => onDesiredMajorChange(e.target.value)}
          placeholder="예: 교육학과"
        />
        <datalist id="major-list">
          {Object.keys(MAJOR_FAMILIES).map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        {families.length > 0 && <span className="families">↳ 계열: {families.join(' · ')}</span>}
      </div>

      <table className="grade-table">
        <thead>
          <tr>
            <th>교과군</th>
            <th>과목명</th>
            <th>5등급</th>
            <th>단위수</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                <select value={r.category} onChange={(e) => update(i, { category: e.target.value as Row['category'] })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </td>
              <td><input value={r.name} onChange={(e) => update(i, { name: e.target.value })} /></td>
              <td><input type="number" min="1" max="5" step="0.01" value={r.grade5} onChange={(e) => update(i, { grade5: e.target.value })} /></td>
              <td><input type="number" min="1" value={r.credits} onChange={(e) => update(i, { credits: e.target.value })} /></td>
              <td><button onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="form-actions">
        <button onClick={() => setRows((rs) => [...rs, emptyRow()])}>+ 과목 추가</button>
        <button className="primary" onClick={submit}>지원 가능권 분석</button>
      </div>
    </section>
  );
}
