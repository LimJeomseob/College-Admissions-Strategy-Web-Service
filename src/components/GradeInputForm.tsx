import { useState } from 'react';
import type { SubjectInput, Track } from '../types';
import { parseGradeFile, ParseError } from '../data/parseGradeFile';

// ① 입력 계층: 성적표 양식 표 형태 입력 + 파일 업로드 프리필

const CATEGORIES: SubjectInput['category'][] = ['국어', '수학', '영어', '사회', '과학', '기타'];

const TEMPLATE_URL = `${import.meta.env.BASE_URL}templates/grade-template.csv`;

interface Props {
  track: Track;
  onTrackChange: (t: Track) => void;
  onSubmit: (rows: SubjectInput[]) => void;
}

interface Row {
  category: SubjectInput['category'];
  name: string;
  grade5: string;
  credits: string;
}

const emptyRow = (): Row => ({ category: '국어', name: '', grade5: '', credits: '' });

const toRow = (s: SubjectInput): Row => ({
  category: s.category,
  name: s.name,
  grade5: String(s.grade5),
  credits: String(s.credits),
});

export function GradeInputForm({ track, onTrackChange, onSubmit }: Props) {
  const [rows, setRows] = useState<Row[]>([
    { category: '국어', name: '국어', grade5: '2', credits: '4' },
    { category: '수학', name: '수학', grade5: '3', credits: '4' },
    { category: '영어', name: '영어', grade5: '2', credits: '4' },
    { category: '사회', name: '통합사회', grade5: '2', credits: '3' },
    { category: '과학', name: '통합과학', grade5: '3', credits: '3' },
  ]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploadWarnings([]);
    setUploadInfo(null);
    try {
      const parsed = await parseGradeFile(file);
      setRows(parsed.rows.map(toRow)); // 제출 전 편집 가능하게 프리필
      setUploadWarnings(parsed.warnings);
      setUploadInfo(`${parsed.rows.length}개 과목을 불러왔습니다. 제출 전 확인·수정할 수 있습니다.`);
      if (parsed.track) onTrackChange(parsed.track);
    } catch (e) {
      const msg = e instanceof ParseError ? e.message : '파일을 읽는 중 오류가 발생했습니다.';
      setUploadError(msg);
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

  return (
    <section className="input-form">
      <h2>① 성적 입력</h2>

      <div className="upload-area">
        <label className="upload-label">
          성적표 파일 업로드 (csv·txt·xlsx)
          <input
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = ''; // 같은 파일 재선택 허용
            }}
          />
        </label>
        <a className="template-link" href={TEMPLATE_URL} download>
          양식 다운로드
        </a>
      </div>
      {uploadInfo && <p className="upload-info">{uploadInfo}</p>}
      {uploadError && <p className="error">{uploadError}</p>}
      {uploadWarnings.length > 0 && (
        <ul className="warn upload-warn">
          {uploadWarnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <div className="track-select">
        계열:
        {(['인문', '자연'] as Track[]).map((t) => (
          <label key={t}>
            <input type="radio" checked={track === t} onChange={() => onTrackChange(t)} /> {t}
          </label>
        ))}
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
