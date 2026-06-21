import { canonUniv } from '../data/loadDeptAdmissions';

// 관리자 DB 관리(AdminDbManager) 설정 — 2/3/4단계 각 Supabase 테이블 정의.
// 업로드 파서: JSON(배열)/CSV/MD(파이프 표)를 읽어 한국어/원본 키 → 테이블 컬럼으로 매핑.

export interface DbColumn {
  key: string;
  label: string;
  type: 'text' | 'number';
  required?: boolean;
}

export interface StepDbConfig {
  id: string;
  title: string;
  table: string;
  columns: DbColumn[];
  /** 검색 대상(부분일치 ilike) 텍스트 컬럼 */
  searchColumn: string;
  pageSize: number;
  acceptHint: string;
  /** 업로드 파일 → 테이블 행 배열 */
  parseUpload: (file: File) => Promise<Record<string, unknown>[]>;
}

const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const m = String(v).replace(/[, %]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const strOrNull = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
};
const trackNorm = (v: unknown): string | null => {
  const s = String(v ?? '');
  if (s.includes('자연')) return '자연';
  if (s.includes('인문')) return '인문';
  return null;
};

// ── 파일 → 원본 객체 배열 ──
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQ = false;
  const t = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
    else field += c;
  }
  if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!head) return [];
  return body.map((cells) => {
    const o: Record<string, string> = {};
    head.forEach((h, i) => (o[h.trim()] = (cells[i] ?? '').trim()));
    return o;
  });
}

// 마크다운 파이프 표 → 객체 배열(헤더 기준).
function parseMdTable(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return [];
  const cells = (l: string) => l.split('|').slice(1, -1).map((c) => c.trim());
  const head = cells(lines[0]);
  return lines
    .slice(2) // 0=header, 1=구분선
    .map(cells)
    .filter((r) => r.length === head.length)
    .map((r) => {
      const o: Record<string, string> = {};
      head.forEach((h, i) => (o[h] = r[i]));
      return o;
    });
}

async function readRaw(file: File): Promise<Record<string, unknown>[]> {
  const text = await file.text();
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) {
    const j = JSON.parse(text);
    return Array.isArray(j) ? j : Array.isArray(j.data) ? j.data : Array.isArray(j.records) ? j.records : [];
  }
  if (name.endsWith('.md')) return parseMdTable(text);
  return parseCsv(text);
}

// 헤더 별칭 조회(공백/괄호 무시).
function pick(row: Record<string, unknown>, names: string[]): unknown {
  const norm = (s: string) => s.replace(/[\s()]/g, '');
  for (const n of names) {
    for (const k of Object.keys(row)) {
      if (norm(k) === norm(n)) return row[k];
    }
  }
  return undefined;
}

export const STEP_DB_CONFIGS: StepDbConfig[] = [
  {
    id: 'conversion',
    title: '2단계 · 5등급↔9등급 환산 DB',
    table: 'conversion_db',
    searchColumn: 'avg5',
    pageSize: 50,
    acceptHint: '.md(파이프 표) / .csv / .json',
    columns: [
      { key: 'avg5', label: '5등급평균', type: 'number', required: true },
      { key: 'busan', label: '부산', type: 'number' },
      { key: 'daejin', label: '대진대', type: 'number' },
      { key: 'integrated', label: '50:50통합', type: 'number' },
      { key: 'gg_jeon', label: '경기(전과목)', type: 'text' },
      { key: 'gg_guksuyeongsagwa', label: '경기(국수영사과)', type: 'text' },
      { key: 'gg_guksuyeonggwa', label: '경기(국수영과)', type: 'text' },
      { key: 'gg_guksuyeongsa', label: '경기(국수영사)', type: 'text' },
    ],
    parseUpload: async (file) =>
      (await readRaw(file)).map((r) => ({
        avg5: numOrNull(pick(r, ['avg5', '5등급평균', '5등급'])),
        busan: numOrNull(pick(r, ['busan', '부산'])),
        daejin: numOrNull(pick(r, ['daejin', '대진대'])),
        integrated: numOrNull(pick(r, ['integrated', '50:50통합', '통합'])),
        gg_jeon: strOrNull(pick(r, ['gg_jeon', '경기(전과목)', '경기_전과목'])),
        gg_guksuyeongsagwa: strOrNull(pick(r, ['gg_guksuyeongsagwa', '경기(국수영사과)', '경기_국수영사과'])),
        gg_guksuyeonggwa: strOrNull(pick(r, ['gg_guksuyeonggwa', '경기(국수영과)', '경기_국수영과'])),
        gg_guksuyeongsa: strOrNull(pick(r, ['gg_guksuyeongsa', '경기(국수영사)', '경기_국수영사'])),
      })).filter((r) => r.avg5 != null),
  },
  {
    id: 'strategy',
    title: '3단계 · 교과전형 준비전략 DB',
    table: 'strategy_db',
    searchColumn: 'univ_name',
    pageSize: 50,
    acceptHint: '.json / .csv',
    columns: [
      { key: 'univ_name', label: '대학명', type: 'text', required: true },
      { key: 'track', label: '계열', type: 'text' },
      { key: 'admission_type', label: '전형', type: 'text' },
      { key: 'avg5', label: '5등급', type: 'text' },
      { key: 'est9', label: '9등급', type: 'number' },
      { key: 'rank300', label: '전교등수(300)', type: 'text' },
    ],
    parseUpload: async (file) =>
      (await readRaw(file)).map((r) => {
        const univ = String(pick(r, ['univ_name', '대학명', '대학']) ?? '').trim();
        return {
          track: trackNorm(pick(r, ['track', '계열'])),
          admission_type: strOrNull(pick(r, ['admission_type', '전형'])),
          avg5: strOrNull(pick(r, ['avg5', '5등급'])),
          est9: numOrNull(pick(r, ['est9', '9등급'])),
          rank300: strOrNull(pick(r, ['rank300', '전교 등수(300)', '전교등수(300)', '전교등수'])),
          univ_name: univ,
          univ_canon: canonUniv(univ),
        };
      }).filter((r) => r.univ_name),
  },
  {
    id: 'dept',
    title: '4단계 · 대학학과입결 DB',
    table: 'dept_admissions_db',
    searchColumn: 'univ_raw',
    pageSize: 50,
    acceptHint: '.json / .csv (대용량은 시드 스크립트 권장)',
    columns: [
      { key: 'univ_raw', label: '대학', type: 'text', required: true },
      { key: 'year', label: '학년도', type: 'number' },
      { key: 'type', label: '전형', type: 'text' },
      { key: 'detail', label: '세부전형', type: 'text' },
      { key: 'dept', label: '모집단위', type: 'text' },
      { key: 'quota', label: '모집인원', type: 'number' },
      { key: 'comp', label: '실경쟁률', type: 'number' },
      { key: 'add_pass', label: '추합', type: 'number' },
      { key: 'g50', label: '등급50', type: 'number' },
      { key: 'g70', label: '등급70', type: 'number' },
    ],
    parseUpload: async (file) =>
      (await readRaw(file)).map((r) => {
        const univ = String(pick(r, ['univ_raw', '대학', '대학교']) ?? '').trim();
        return {
          univ_canon: canonUniv(univ),
          univ_raw: univ,
          year: numOrNull(pick(r, ['year', '학년도'])),
          type: strOrNull(pick(r, ['type', '전형'])),
          detail: strOrNull(pick(r, ['detail', '세부전형'])),
          dept: strOrNull(pick(r, ['dept', '모집단위'])),
          quota: numOrNull(pick(r, ['quota', '모집인원'])),
          comp: numOrNull(pick(r, ['comp', '실경쟁률'])),
          add_pass: numOrNull(pick(r, ['add_pass', '추합'])),
          g50: numOrNull(pick(r, ['g50', '등급50'])),
          g70: numOrNull(pick(r, ['g70', '등급70'])),
        };
      }).filter((r) => r.univ_canon),
  },
];
