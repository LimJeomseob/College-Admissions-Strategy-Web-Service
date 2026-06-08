import type { SubjectInput, Track } from '../types';

// ───────────────────────────────────────────────────────────
// 성적 파일 파서 (.txt / .csv / .xlsx / .xls)
// xlsx 는 동적 import → 업로드 시에만 로드(번들 분리). csv/txt 는 내부 파서.
// ───────────────────────────────────────────────────────────

export interface ParsedGradeFile {
  rows: SubjectInput[];
  track?: Track;
  /** 건너뛰거나 보정한 행에 대한 안내 */
  warnings: string[];
}

export class ParseError extends Error {
  code: 'EMPTY' | 'NO_HEADER' | 'UNSUPPORTED' | 'PARSE_FAIL';
  constructor(code: ParseError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'ParseError';
  }
}

type Field = 'category' | 'name' | 'grade5' | 'credits' | 'track';

const HEADER_ALIASES: Record<Field, string[]> = {
  category: ['과목구분', '교과군', '교과', 'category', '구분'],
  name: ['과목명', '과목', 'name', '교과목', '교과목명'],
  grade5: ['등급', '5등급', '석차등급', 'grade', 'grade5'],
  credits: ['단위수', '이수단위', '단위', 'credits', '학점'],
  track: ['계열', 'track'],
};

const CATEGORY_KEYWORDS: { cat: SubjectInput['category']; kw: string[] }[] = [
  { cat: '국어', kw: ['국어', '문학', '독서', '화법', '언어', '작문'] },
  { cat: '수학', kw: ['수학', '미적', '확통', '기하', '대수'] },
  { cat: '영어', kw: ['영어', 'english'] },
  { cat: '사회', kw: ['사회', '역사', '지리', '윤리', '정치', '경제', '세계사', '한국사', '통합사회'] },
  { cat: '과학', kw: ['과학', '물리', '화학', '생명', '지구', '통합과학'] },
];

function norm(s: string): string {
  return String(s ?? '').replace(/\s+/g, '').toLowerCase();
}

/** 헤더 셀 → 내부 필드 키 */
function matchHeader(cell: string): Field | null {
  const c = norm(cell);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Field, string[]][]) {
    if (aliases.some((a) => norm(a) === c || c.includes(norm(a)))) return field;
  }
  return null;
}

function coerceCategory(raw: string): SubjectInput['category'] {
  const r = norm(raw);
  const direct: SubjectInput['category'][] = ['국어', '수학', '영어', '사회', '과학', '기타'];
  for (const d of direct) if (norm(d) === r) return d;
  for (const { cat, kw } of CATEGORY_KEYWORDS) {
    if (kw.some((k) => r.includes(norm(k)))) return cat;
  }
  return '기타';
}

function coerceTrack(raw: string | undefined): Track | undefined {
  if (!raw) return undefined;
  const r = norm(raw);
  if (r.includes('인문') || r.includes('문과')) return '인문';
  if (r.includes('자연') || r.includes('이과')) return '자연';
  return undefined;
}

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  return ',';
}

/** 한 줄을 구분자로 분해 (간단한 CSV — 따옴표 감싼 필드 지원) */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** 헤더 행 인덱스 찾기 (인식 가능한 헤더 토큰 2개 이상) */
function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const recognized = rows[i].filter((c) => matchHeader(c)).length;
    if (recognized >= 2) return i;
  }
  return -1;
}

/** 2D 셀 배열 → ParsedGradeFile */
function rowsToParsed(grid: string[][]): ParsedGradeFile {
  const nonEmpty = grid.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (nonEmpty.length === 0) throw new ParseError('EMPTY', '파일이 비어 있습니다.');

  const headerIdx = findHeaderRow(nonEmpty);
  if (headerIdx === -1) {
    throw new ParseError(
      'NO_HEADER',
      '헤더(과목구분/과목명/등급/단위수)를 찾지 못했습니다. 양식 템플릿을 사용해 주세요.',
    );
  }

  const header = nonEmpty[headerIdx].map(matchHeader);
  const rows: SubjectInput[] = [];
  const warnings: string[] = [];
  let track: Track | undefined;

  for (let i = headerIdx + 1; i < nonEmpty.length; i++) {
    const cells = nonEmpty[i];
    const rec: Partial<Record<Field, string>> = {};
    header.forEach((f, idx) => {
      if (f) rec[f] = cells[idx];
    });

    if (rec.track && !track) track = coerceTrack(rec.track);

    const name = (rec.name ?? '').trim();
    const grade5 = parseFloat(rec.grade5 ?? '');
    const credits = parseFloat(rec.credits ?? '');

    if (!name && !Number.isFinite(grade5)) continue; // 완전 빈 행
    if (!Number.isFinite(grade5) || !Number.isFinite(credits)) {
      warnings.push(`${i + 1}행: 등급/단위수가 올바르지 않아 건너뜀 (${name || '이름없음'})`);
      continue;
    }
    rows.push({
      category: coerceCategory(rec.category ?? name),
      name: name || coerceCategory(rec.category ?? ''),
      grade5,
      credits,
    });
  }

  if (rows.length === 0) {
    throw new ParseError('PARSE_FAIL', '유효한 성적 행을 찾지 못했습니다. 양식을 확인해 주세요.');
  }
  return { rows, track, warnings };
}

async function parseSpreadsheet(file: File): Promise<ParsedGradeFile> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
  return rowsToParsed(grid.map((r) => (r as unknown[]).map((c) => String(c ?? ''))));
}

function parseDelimited(text: string): ParsedGradeFile {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) throw new ParseError('EMPTY', '파일이 비어 있습니다.');
  const delim = detectDelimiter(lines[0]);
  const grid = lines.map((l) => splitLine(l, delim));
  return rowsToParsed(grid);
}

export async function parseGradeFile(file: File): Promise<ParsedGradeFile> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  try {
    if (ext === 'xlsx' || ext === 'xls') return await parseSpreadsheet(file);
    if (ext === 'csv' || ext === 'txt') return parseDelimited(await file.text());
    throw new ParseError('UNSUPPORTED', `지원하지 않는 형식입니다(.${ext}). csv·txt·xlsx 만 가능합니다.`);
  } catch (e) {
    if (e instanceof ParseError) throw e;
    throw new ParseError('PARSE_FAIL', `파일을 읽지 못했습니다: ${(e as Error).message}`);
  }
}
