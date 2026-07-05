import { useState } from 'react';
import type { SubjectInput, Track } from '../types';
import { parseGradeFile, ParseError } from '../data/parseGradeFile';
import { isImageFile, ocrGradeImage } from '../data/ocrGradeImage';
import { useAuth } from '../auth/AuthProvider';

// ① 입력 계층: 성적표 양식 표 형태 입력 + 파일 업로드 프리필

// 입력 범위: 국·수·영·사/과 (기타·전과목 제외) — REQ-06
const CATEGORIES: SubjectInput['category'][] = ['국어', '수학', '영어', '사회', '과학'];

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
    { category: '국어', name: '국어', grade5: '1', credits: '4' },
    { category: '수학', name: '수학', grade5: '2', credits: '4' },
    { category: '영어', name: '영어', grade5: '2', credits: '4' },
    { category: '사회', name: '통합사회', grade5: '1', credits: '3' },
    { category: '과학', name: '통합과학', grade5: '2', credits: '3' },
  ]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);

  const { user } = useAuth();

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // 여러 파일을 한 번에 업로드 — 이미지(OCR)·csv/txt/xlsx를 각각 파싱해 과목을 모두 합산.
  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploadError(null);
    setUploadWarnings([]);
    setUploadInfo(null);
    setOcrBusy(true);

    const acc: SubjectInput[] = [];
    const warns: string[] = [];
    const errs: string[] = [];
    let detectedTrack: Track | undefined;

    for (const file of files) {
      try {
        if (isImageFile(file)) {
          if (!user) {
            errs.push(`${file.name}: 이미지 인식은 로그인 후 가능`);
            continue;
          }
          const parsed = await ocrGradeImage(file);
          acc.push(...parsed.rows);
          if (parsed.track) detectedTrack = parsed.track;
        } else {
          const parsed = await parseGradeFile(file);
          acc.push(...parsed.rows);
          warns.push(...parsed.warnings.map((w) => `${file.name} ${w}`));
          if (parsed.track) detectedTrack = parsed.track;
        }
      } catch (e) {
        const msg = e instanceof ParseError ? e.message : e instanceof Error ? e.message : '읽기 오류';
        errs.push(`${file.name}: ${msg}`);
      }
    }

    setOcrBusy(false);
    if (acc.length > 0) {
      setRows(acc.map(toRow)); // 합산 결과로 표 구성(제출 전 편집 가능)
      setUploadInfo(`${files.length}개 파일에서 ${acc.length}개 과목을 불러왔습니다. 제출 전 확인·수정해 주세요.`);
      if (detectedTrack) onTrackChange(detectedTrack);
    }
    setUploadWarnings(warns);
    if (errs.length > 0) setUploadError(errs.join(' / '));
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
      <h2>1단계 성적 입력</h2>

      <div className="upload-area">
        <label className="upload-label">
          성적표 업로드 (이미지 캡쳐·csv·txt·xlsx, 여러 개 가능)
          <input
            type="file"
            accept="image/*,.csv,.txt,.xlsx,.xls"
            multiple
            disabled={ocrBusy}
            onChange={(e) => {
              void handleFiles(Array.from(e.target.files ?? []));
              e.target.value = ''; // 같은 파일 재선택 허용
            }}
          />
        </label>
        <p className="upload-hint muted">
          여러 파일을 한 번에 올리면 과목이 모두 합쳐집니다. 캡쳐 이미지도 자동 인식{user ? '' : ' (로그인 필요)'}.
        </p>
      </div>
      {ocrBusy && <p className="upload-info">이미지를 인식하는 중입니다… 잠시만 기다려 주세요.</p>}
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
            <th>학점수</th>
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
