import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { canonUniv } from '../../src/data/loadDeptAdmissions';

// ───────────────────────────────────────────────────────────
// 대학학과입결 엑셀 → scripts/etl/data/deptAdmissions.csv 변환
//   - 사용자가 제공하는 "대학학과입결" 엑셀(.xlsx/.csv)을 deptAdmissions 스키마로 변환.
//   - 스키마: univCanon,univRaw,year,type,detail,dept,quota,comp,addPass,g50,g70
//   - 대학명 정규화는 런타임과 동일한 canonUniv() 재사용(조회 일관성).
//   - 병합 규칙: 기존 deptAdmissions.csv 의 2026 행은 보존하고, 엑셀에서 온 데이터와 합친다.
//
// 실행:  npx tsx scripts/etl/convertDeptExcel.ts [입력파일경로]
//   인자를 생략하면 scripts/etl/data/ 에서 *대학학과입결* 또는 *입결* 이름의
//   .xlsx/.csv 파일을 자동으로 찾는다.
//
// 변환 후:  npm run etl:2028  →  public/data/deptAdmissions.json 재생성.
//
// 주의: 엑셀 실제 헤더에 맞춰 아래 COLUMN ALIASES / 연도 인식 정규식을 조정해야 한다.
//   현재 기본값은 저장소 루트 ipgyeol.csv.csv 의 "와이드(연도 가로)" 헤더 기준이다.
// ───────────────────────────────────────────────────────────

const DATA_DIR = resolve(process.cwd(), 'scripts/etl/data');
const OUT_CSV = resolve(DATA_DIR, 'deptAdmissions.csv');
const KEEP_YEAR = 2026; // 기존 DB에서 보존할 연도

type Rec = Record<string, string>;
interface DeptCsvRow {
  univCanon: string;
  univRaw: string;
  year: number;
  type: string;
  detail: string;
  dept: string;
  quota: string;
  comp: string;
  addPass: string;
  g50: string;
  g70: string;
}
const HEADER = 'univCanon,univRaw,year,type,detail,dept,quota,comp,addPass,g50,g70';

// 전형유형 정규화(기존 DB 라벨과 정렬): 학생부교과→교과전형 등.
const TYPE_MAP: Record<string, string> = {
  학생부교과: '교과전형',
  교과: '교과전형',
  학생부종합: '종합전형',
  종합: '종합전형',
  논술: '논술전형',
  논술위주: '논술전형',
  실기: '실기전형',
  실기실적: '실기전형',
};
const normType = (t: string) => TYPE_MAP[t?.replace(/\s+/g, '')] ?? (t || '');

// 컬럼 별칭 — 실제 엑셀 헤더에 맞게 보강.
const ALIASES = {
  univ: ['대학교', '대학명', '대학'],
  dept: ['모집단위명', '모집단위', '학과', '모집단위(학과)'],
  type: ['전형유형', '전형구분', '전형'],
  detail: ['전형명', '세부전형', '세부전형명'],
  quota: ['모집인원', '모집정원', '정원'],
  year: ['연도', '학년도', '년도'],
  comp: ['경쟁률', '실경쟁률'],
  addPass: ['충원', '추합', '추가합격', '충원인원'],
  g50: ['50%컷', '50%', '입결50', '등급50', '입결_등급', '입결등급', '등급'],
  g70: ['70%컷', '70%', '입결70', '등급70'],
} as const;

const numCell = (s: string | undefined): string => {
  if (s == null) return '';
  const m = String(s).replace(/[,%]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? m[0] : '';
};
const csvEscape = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

function pick(row: Rec, names: readonly string[]): string {
  for (const n of names) {
    for (const key of Object.keys(row)) {
      if (key.replace(/\s+/g, '') === n.replace(/\s+/g, '')) {
        const v = row[key];
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
    }
  }
  return '';
}

// 입력 파일 자동 탐색.
function findInput(argPath?: string): string {
  if (argPath) {
    const p = resolve(process.cwd(), argPath);
    if (!existsSync(p)) throw new Error(`입력 파일을 찾을 수 없습니다: ${p}`);
    return p;
  }
  const cand = readdirSync(DATA_DIR)
    .filter((f) => /(대학학과입결|입결).*\.(xlsx|xls|csv)$/i.test(f))
    .filter((f) => f !== 'deptAdmissions.csv')
    .map((f) => resolve(DATA_DIR, f));
  if (cand.length === 0) {
    throw new Error(
      `입력 파일을 찾을 수 없습니다. 엑셀을 ${DATA_DIR} 에 두거나 경로를 인자로 전달하세요.\n` +
        `예) npx tsx scripts/etl/convertDeptExcel.ts scripts/etl/data/대학학과입결.xlsx`,
    );
  }
  return cand[0];
}

// 엑셀/CSV → 행 객체 배열(헤더 기준). XLSX가 .csv 도 처리.
// ESM 빌드는 readFile(fs 의존)을 노출하지 않으므로 버퍼를 직접 읽어 XLSX.read 사용.
function readRows(path: string): Rec[] {
  const buf = readFileSync(path);
  const wb = XLSX.read(buf, { type: 'buffer', raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Rec>(sheet, { defval: '', raw: false });
}

// 연도 가로(와이드) 헤더 감지: "2025입결_등급" "2025경쟁률" 등.
function detectWideYears(cols: string[]): number[] {
  const set = new Set<number>();
  for (const c of cols) {
    const m = c.match(/(20\d{2})\s*(입결|경쟁률|충원|컷|등급)/);
    if (m) set.add(Number(m[1]));
  }
  return [...set].sort((a, b) => a - b);
}
function wideCell(row: Rec, year: number, suffixes: string[]): string {
  for (const suf of suffixes) {
    for (const key of Object.keys(row)) {
      const k = key.replace(/\s+/g, '');
      if (k.startsWith(String(year)) && k.includes(suf.replace(/\s+/g, ''))) {
        const v = row[key];
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
    }
  }
  return '';
}

function build(rows: Rec[]): DeptCsvRow[] {
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0]);
  const wideYears = detectWideYears(cols);
  const out: DeptCsvRow[] = [];

  const base = (row: Rec) => {
    const univRaw = pick(row, ALIASES.univ);
    return {
      univRaw,
      univCanon: canonUniv(univRaw),
      type: normType(pick(row, ALIASES.type)),
      detail: pick(row, ALIASES.detail),
      dept: pick(row, ALIASES.dept),
      quota: numCell(pick(row, ALIASES.quota)),
    };
  };

  if (wideYears.length > 0) {
    // 와이드 레이아웃: 한 행에 여러 연도가 가로로. 연도별로 펼친다.
    for (const row of rows) {
      const b = base(row);
      if (!b.univCanon || !b.dept) continue;
      for (const year of wideYears) {
        const g50 = numCell(wideCell(row, year, ['50%컷', '50%', '입결_등급', '입결등급', '등급']));
        const g70 = numCell(wideCell(row, year, ['70%컷', '70%', '등급70']));
        const comp = numCell(wideCell(row, year, ['경쟁률']));
        const addPass = numCell(wideCell(row, year, ['충원', '추합']));
        if (!g50 && !g70 && !comp && !addPass) continue; // 해당 연도 데이터 없음
        out.push({ ...b, year, comp, addPass, g50, g70 });
      }
    }
  } else {
    // 롱 레이아웃: 행마다 연도 컬럼이 따로.
    for (const row of rows) {
      const b = base(row);
      const year = Number(numCell(pick(row, ALIASES.year)));
      if (!b.univCanon || !b.dept || !Number.isFinite(year) || year === 0) continue;
      out.push({
        ...b,
        year,
        comp: numCell(pick(row, ALIASES.comp)),
        addPass: numCell(pick(row, ALIASES.addPass)),
        g50: numCell(pick(row, ALIASES.g50)),
        g70: numCell(pick(row, ALIASES.g70)),
      });
    }
  }
  return out;
}

// 기존 deptAdmissions.csv 에서 보존할 연도(KEEP_YEAR) 행만 읽는다(단순 CSV).
function keepExistingYear(): DeptCsvRow[] {
  if (!existsSync(OUT_CSV)) return [];
  const text = readFileSync(OUT_CSV, 'utf-8').replace(/\r\n?/g, '\n').trim();
  const [head, ...lines] = text.split('\n');
  const cols = head.split(',');
  const kept: DeptCsvRow[] = [];
  for (const line of lines) {
    const cells = line.split(',');
    const obj: Rec = {};
    cols.forEach((c, i) => (obj[c] = (cells[i] ?? '').trim()));
    if (Number(obj.year) !== KEEP_YEAR) continue;
    kept.push({ ...(obj as unknown as DeptCsvRow), year: Number(obj.year) });
  }
  return kept;
}

function toCsv(rows: DeptCsvRow[]): string {
  const body = rows.map((r) =>
    [r.univCanon, r.univRaw, r.year, r.type, r.detail, r.dept, r.quota, r.comp, r.addPass, r.g50, r.g70]
      .map((v) => csvEscape(String(v ?? '')))
      .join(','),
  );
  return [HEADER, ...body].join('\n') + '\n';
}

function main() {
  const input = findInput(process.argv[2]);
  console.log(`· 입력: ${input}`);
  const rows = readRows(input);
  console.log(`· 원본 ${rows.length}행, 헤더: ${Object.keys(rows[0] ?? {}).join(' | ')}`);

  const converted = build(rows);
  const kept = keepExistingYear();
  // 엑셀에 KEEP_YEAR 데이터가 이미 있으면 그대로 두고, 없을 때만 기존 보존분을 추가.
  const hasKeepYear = converted.some((r) => r.year === KEEP_YEAR);
  const merged = hasKeepYear ? converted : [...converted, ...kept];

  writeFileSync(OUT_CSV, toCsv(merged), 'utf-8');

  const years = [...new Set(merged.map((r) => r.year))].sort((a, b) => b - a);
  const univs = new Set(merged.map((r) => r.univCanon)).size;
  console.log(`✓ deptAdmissions.csv 생성 — 대학 ${univs}개 / 학과행 ${merged.length}`);
  console.log(`  연도: ${years.join(', ')}${hasKeepYear ? '' : ` (기존 ${KEEP_YEAR} ${kept.length}행 병합 보존)`}`);
  console.log('  다음 단계: npm run etl:2028  →  public/data/deptAdmissions.json 재생성');
}

main();
