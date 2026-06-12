import type { SubjectInput, Track } from '../types';

// ───────────────────────────────────────────────────────────
// 성적표 파일 파서 (txt / csv / xlsx / xls)
// - .xlsx/.xls 는 업로드 시에만 동적 import('xlsx') 로 로드(번들 비대 방지).
// - .csv/.txt 는 내부 경량 구분자 파서로 처리(xlsx 미로드).
// - 헤더는 한/영 별칭·대소문/공백 무시로 유연 매핑.
// - 불량행은 skip + warnings(기존 submit 필터 의미와 일치).
// ───────────────────────────────────────────────────────────

export interface ParsedGradeFile {
  rows: SubjectInput[];
  track?: Track;
  warnings: string[];
}

export type ParseErrorCode = 'EMPTY' | 'NO_HEADER' | 'UNSUPPORTED' | 'PARSE_FAIL';

export class ParseError extends Error {
  code: ParseErrorCode;
  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.name = 'ParseError';
    this.code = code;
  }
}

type CanonField = 'category' | 'name' | 'grade5' | 'credits' | 'track';
type ColMap = Partial<Record<CanonField, number>>;

/** 헤더 셀 → 표준 필드 매핑 (대소문/공백 무시, 한/영 별칭) */
function canonField(header: string): CanonField | null {
  const k = header.trim().toLowerCase().replace(/\s+/g, '');
  if (['과목구분', '교과군', '구분', 'category'].includes(k)) return 'category';
  if (['과목명', '과목', 'name', 'subject'].includes(k)) return 'name';
  if (['등급', '5등급', 'grade', 'grade5'].includes(k)) return 'grade5';
  if (['단위수', '이수단위', '단위', 'credits', 'credit', 'unit'].includes(k)) return 'credits';
  if (['계열', 'track'].includes(k)) return 'track';
  return null;
}

/** 교과군 정규화 — 미상은 '기타' */
function normCategory(value: string): SubjectInput['category'] {
  const s = (value || '').trim();
  if (s.includes('국어') || /korean/i.test(s)) return '국어';
  if (s.includes('수학') || /math/i.test(s)) return '수학';
  if (s.includes('영어') || /english/i.test(s)) return '영어';
  if (s.includes('사회') || /social/i.test(s)) return '사회';
  if (s.includes('과학') || /science/i.test(s)) return '과학';
  return '기타';
}

function mapHeader(row: string[]): ColMap {
  const m: ColMap = {};
  row.forEach((cell, idx) => {
    const f = canonField(cell);
    if (f && m[f] == null) m[f] = idx;
  });
  return m;
}

// ── 구분자(csv/txt) 파싱 ──────────────────────────────────
function detectDelimiter(sample: string): string {
  let best = ',';
  let bestCount = -1;
  for (const d of [',', '\t', ';']) {
    const count = sample.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

function parseLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function readDelimited(text: string): string[][] {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const delim = detectDelimiter(lines[0]);
  return lines.map((l) => parseLine(l, delim));
}

// ── 엑셀(xlsx/xls) 파싱 — 동적 import ─────────────────────
async function readSpreadsheet(file: File): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) return [];
  const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });
  return json.map((row) => row.map((c) => (c == null ? '' : String(c).trim())));
}

function buildResult(matrix: string[][]): ParsedGradeFile {
  const rows = matrix.filter((r) => r.some((c) => c.trim() !== ''));
  if (rows.length === 0) {
    throw new ParseError('EMPTY', '파일에 데이터가 없습니다.');
  }

  let headerIdx = -1;
  let cols: ColMap | null = null;
  for (let i = 0; i < rows.length; i++) {
    const map = mapHeader(rows[i]);
    if (map.grade5 != null && (map.name != null || map.category != null)) {
      headerIdx = i;
      cols = map;
      break;
    }
  }
  if (headerIdx === -1 || !cols) {
    throw new ParseError(
      'NO_HEADER',
      '성적표 헤더(과목명·등급 등)를 찾지 못했습니다. 양식을 내려받아 사용해 주세요.',
    );
  }

  const warnings: string[] = [];
  const out: SubjectInput[] = [];
  let track: Track | undefined;
  const num = (v: string | undefined) => parseFloat((v ?? '').replace(/[^0-9.]/g, ''));

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const gradeRaw = cols.grade5 != null ? r[cols.grade5] : '';
    const nameRaw = (cols.name != null ? r[cols.name] : '') ?? '';
    const catRaw = (cols.category != null ? r[cols.category] : '') ?? '';

    if ((gradeRaw ?? '').trim() === '' && nameRaw.trim() === '' && catRaw.trim() === '') {
      continue; // 완전 빈 행은 조용히 skip
    }

    const grade5 = num(gradeRaw);
    if (!Number.isFinite(grade5)) {
      warnings.push(`${i + 1}행: 등급 값을 읽을 수 없어 제외했습니다.`);
      continue;
    }

    let credits = cols.credits != null ? num(r[cols.credits]) : NaN;
    if (!Number.isFinite(credits)) {
      credits = 1;
      if (cols.credits != null) {
        warnings.push(`${i + 1}행: 단위수 값을 읽을 수 없어 1로 보정했습니다.`);
      }
    }

    const name = nameRaw.trim() || catRaw.trim() || '과목';
    const category = normCategory(catRaw.trim() || name);
    out.push({ category, name, grade5, credits });

    if (track == null && cols.track != null) {
      const t = r[cols.track] ?? '';
      if (t.includes('인문')) track = '인문';
      else if (t.includes('자연')) track = '자연';
    }
  }

  if (out.length === 0) {
    throw new ParseError('PARSE_FAIL', '유효한 성적 행을 찾지 못했습니다. 양식을 확인해 주세요.');
  }
  return { rows: out, track, warnings };
}

export async function parseGradeFile(file: File): Promise<ParsedGradeFile> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  let matrix: string[][];
  if (ext === 'xlsx' || ext === 'xls') {
    matrix = await readSpreadsheet(file);
  } else if (ext === 'csv' || ext === 'txt') {
    matrix = readDelimited(await file.text());
  } else {
    throw new ParseError(
      'UNSUPPORTED',
      `지원하지 않는 형식입니다(.${ext}). csv·txt·xlsx·xls 파일을 올려주세요.`,
    );
  }
  return buildResult(matrix);
}
