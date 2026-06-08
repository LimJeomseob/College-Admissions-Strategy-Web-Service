import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import type {
  AdmissionRow,
  AdmissionType,
  ConversionRow,
  DataLayer,
  SubjectCombo,
  SubjectTrackRow,
  Track,
} from '../../src/types';
import {
  ADMISSION_COLS,
  CONVERSION_COLS,
  FILES,
  SUBJECT_TRACK_COLS,
  UNIV_ALIASES,
} from './columnMap';
import { verifyJoins, writeDataLayer } from './writeOutput';

// ───────────────────────────────────────────────────────────
// Phase 0 ETL — 5종 원본 DB(data/raw)를 정규화 통합 데이터 레이어로 변환
//
// 실제 데이터 업로드 후 `npm run etl` 실행. 파일이 없으면 안내 후 종료.
// 컬럼 헤더가 실제와 다르면 scripts/etl/columnMap.ts만 수정하면 된다.
// ───────────────────────────────────────────────────────────

const RAW_DIR = resolve(process.cwd(), 'data/raw');

function readSheet(file: string): Record<string, unknown>[] {
  const path = resolve(RAW_DIR, file);
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

// ── 대학명 표준화 ────────────────────────────────────────────
const ALIAS_TO_CODE = new Map<string, string>();
for (const [code, info] of Object.entries(UNIV_ALIASES)) {
  ALIAS_TO_CODE.set(normalizeName(info.name), code);
  for (const a of info.aliases) ALIAS_TO_CODE.set(normalizeName(a), code);
}

function normalizeName(name: string): string {
  return String(name).replace(/\s|\(|\)|（|）/g, '').trim();
}

/** 표준 대학코드 부여. 미등록 대학은 정규화된 이름을 코드로 사용. */
function toUnivCode(rawName: unknown): { code: string; name: string; region: string } {
  const norm = normalizeName(String(rawName ?? ''));
  const code = ALIAS_TO_CODE.get(norm);
  if (code) {
    const info = UNIV_ALIASES[code];
    return { code, name: info.name, region: info.region };
  }
  return { code: norm, name: String(rawName ?? '').trim(), region: '' };
}

// ── 입결 정제: 9등급(1~9) 범위 이탈 이상치 제거 ──────────────
function cleanGrade(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 9) return null; // 환산점수 혼입(최대 334) 등 제거
  return Math.round(n * 100) / 100;
}

function normalizeType(v: unknown): AdmissionType {
  const s = String(v ?? '');
  if (s.includes('교과')) return '학생부교과';
  if (s.includes('종합')) return '학생부종합';
  if (s.includes('논술')) return '논술';
  return '실기실적';
}

function normalizeTrack(v: unknown): Track | null {
  const s = String(v ?? '');
  if (s.includes('자연') || s.includes('이과')) return '자연';
  if (s.includes('인문') || s.includes('문과')) return '인문';
  return null;
}

function comboFromSubjects(s: string): SubjectCombo {
  const t = s.replace(/\s/g, '');
  if (t.includes('사') && t.includes('과')) return '국수영사과';
  if (t.includes('과')) return '국수영과';
  if (t.includes('사')) return '국수영사';
  return '전과목';
}

// ── 빌더 ────────────────────────────────────────────────────
function buildConversion(): ConversionRow[] {
  return readSheet(FILES.conversion).map((r) => ({
    avg5: Number(r[CONVERSION_COLS.avg5]),
    est9: Number(r[CONVERSION_COLS.est9_5050]),
    refs: {
      busan: numOrUndef(r[CONVERSION_COLS.busan]),
      daejin: numOrUndef(r[CONVERSION_COLS.daejin]),
      gyeonggi: numOrUndef(r[CONVERSION_COLS.gyeonggi]),
    },
  }));
}

function buildAdmissions(): AdmissionRow[] {
  return readSheet(FILES.admissions)
    .map((r) => {
      const u = toUnivCode(r[ADMISSION_COLS.univName]);
      const g2025 = cleanGrade(r[ADMISSION_COLS.cutGrade2025]);
      return {
        univCode: u.code,
        univName: u.name,
        region: u.region || String(r[ADMISSION_COLS.region] ?? ''),
        track: normalizeTrack(r[ADMISSION_COLS.track]),
        admissionType: normalizeType(r[ADMISSION_COLS.admissionType]),
        admissionName: String(r[ADMISSION_COLS.admissionName] ?? ''),
        unit: String(r[ADMISSION_COLS.unit] ?? ''),
        cutGrade: g2025,
        cutBasis: String(r[ADMISSION_COLS.cutBasis] ?? ''),
        history: [
          { year: 2025, grade: g2025 },
          { year: 2024, grade: cleanGrade(r[ADMISSION_COLS.cutGrade2024]) },
          { year: 2023, grade: cleanGrade(r[ADMISSION_COLS.cutGrade2023]) },
        ],
        competitionRate: numOrUndef(r[ADMISSION_COLS.competitionRate]) ?? null,
        minCsat: (r[ADMISSION_COLS.minCsat] as string) ?? null,
      } satisfies AdmissionRow;
    })
    // MVP 범위: 교과/종합만
    .filter((r) => r.admissionType === '학생부교과' || r.admissionType === '학생부종합');
}

function buildSubjectTrack(): SubjectTrackRow[] {
  return readSheet(FILES.subjectTrack).map((r) => {
    const u = toUnivCode(r[SUBJECT_TRACK_COLS.univName]);
    const reflected = String(r[SUBJECT_TRACK_COLS.reflectedSubjects] ?? '');
    return {
      univCode: u.code,
      univName: u.name,
      admissionName: String(r[SUBJECT_TRACK_COLS.admissionName] ?? ''),
      method: String(r[SUBJECT_TRACK_COLS.method] ?? ''),
      minCsat: (r[SUBJECT_TRACK_COLS.minCsat] as string) ?? null,
      reflectedSubjects: reflected,
      combo: comboFromSubjects(reflected),
      reflectMethod: String(r[SUBJECT_TRACK_COLS.reflectMethod] ?? ''),
      indicator: String(r[SUBJECT_TRACK_COLS.indicator] ?? ''),
    } satisfies SubjectTrackRow;
  });
}

function numOrUndef(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

function main(): void {
  const missing = Object.values(FILES).filter((f) => !existsSync(resolve(RAW_DIR, f)));
  if (missing.length > 0) {
    console.error('⚠ 원본 DB가 없습니다. data/raw/ 에 다음 파일을 업로드하세요:');
    missing.forEach((f) => console.error(`   - ${f}`));
    console.error('\n임시로 목업 데이터로 앱을 구동하려면: npm run etl:mock');
    process.exitCode = 1;
    return;
  }

  const admissions = buildAdmissions();
  const universities = dedupeUnivs(admissions);
  const layer: DataLayer = {
    conversion: buildConversion(),
    admissions,
    subjectTrack: buildSubjectTrack(),
    universities,
    meta: { generatedAt: new Date().toISOString(), source: 'real' },
  };
  writeDataLayer(layer);
  verifyJoins(layer);
}

function dedupeUnivs(rows: AdmissionRow[]): DataLayer['universities'] {
  const map = new Map<string, DataLayer['universities'][number]>();
  for (const r of rows) {
    if (!map.has(r.univCode)) {
      map.set(r.univCode, { univCode: r.univCode, univName: r.univName, region: r.region });
    }
  }
  return [...map.values()];
}

main();
