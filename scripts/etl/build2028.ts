import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { convert } from '../../src/engine/convert';
import type {
  AdmissionRow,
  ConversionRow,
  DataLayer,
  Track,
} from '../../src/types';
import { writeDataLayer, verifyJoins } from './writeOutput';

// ───────────────────────────────────────────────────────────
// 2028 입결 라인표 ETL
// scripts/etl/data/*.csv (엑셀 "전체목록"·"등급 변환표"에서 추출) → public/data/dataLayer.json
//   - 계열(인문/자연)·전형(교과/종합)별 대학 합격선 라인을 입결 매칭용 admissions 로 변환
//   - 9등급 합격선은 등급변환표로 환산해 앱 환산값과 동일 척도 유지(일관성)
//   - 계열 고려: row.track 을 정확히 부여 → match() 의 track 필터가 자동 반영
// 실행: npx tsx scripts/etl/build2028.ts
// ───────────────────────────────────────────────────────────

const DATA = resolve(process.cwd(), 'scripts/etl/data');

function readCsv(name: string): Record<string, string>[] {
  const text = readFileSync(resolve(DATA, name), 'utf-8').replace(/\r\n?/g, '\n').trim();
  const [head, ...lines] = text.split('\n');
  const cols = head.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    const obj: Record<string, string> = {};
    cols.forEach((c, i) => (obj[c] = (cells[i] ?? '').trim()));
    return obj;
  });
}

// 등급변환표 → ConversionRow[] (단일 모형이므로 refs 비움 → 참고범위 미표시)
function buildConversion(): ConversionRow[] {
  return readCsv('conversion2028.csv')
    .map((r) => ({ avg5: Number(r.avg5), est9: Number(r.est9), refs: {} }))
    .filter((r) => Number.isFinite(r.avg5) && Number.isFinite(r.est9))
    .sort((a, b) => a.avg5 - b.avg5);
}

const TRACK_LABEL: Record<string, string> = { 학생부교과: '교과전형', 학생부종합: '종합전형' };
const round2 = (n: number) => Math.round(n * 100) / 100;

function buildAdmissions(conversion: ConversionRow[]): AdmissionRow[] {
  return readCsv('admissions2028.csv').map((r) => {
    const track = r.track as Track;
    const admissionType = r.admissionType as AdmissionRow['admissionType'];
    const line5 = Number(r.line5);
    const rank = r.rank ? Number(r.rank) : null;
    // 합격선 5등급 라인 → 9등급 (앱과 동일 환산표/보간)
    const cutGrade = round2(convert(conversion, line5).est9);
    const basisRank = rank != null && Number.isFinite(rank) ? ` · 전교 ~${rank}등` : '';
    return {
      univCode: r.univName, // 대학명을 조인 키로 사용
      univName: r.univName,
      region: '',
      track,
      admissionType,
      admissionName: TRACK_LABEL[admissionType] ?? admissionType,
      unit: '대학 합격선 라인',
      cutGrade,
      cutBasis: `5등급 ${line5} 라인${basisRank}`,
      history: [],
      competitionRate: null,
      minCsat: null,
    };
  });
}

const conversion = buildConversion();
const admissions = buildAdmissions(conversion);

// 중복 제거한 대학 목록
const uniMap = new Map<string, { univCode: string; univName: string; region: string }>();
for (const a of admissions) {
  if (!uniMap.has(a.univCode)) uniMap.set(a.univCode, { univCode: a.univCode, univName: a.univName, region: a.region });
}

const layer: DataLayer = {
  conversion,
  admissions,
  // 반영교과·전형방법 상세 DB는 이번 입결 자료에 포함되지 않음 → 비움(입결 라인 기반 추천)
  subjectTrack: [],
  universities: [...uniMap.values()],
  meta: { generatedAt: new Date().toISOString(), source: 'real' },
};

writeDataLayer(layer);
verifyJoins(layer);

// ── 대학별 상세 DB (univ-md/*.md → universityDetails.json) ──
// 키: 기본 대학명(파일명), 값: HTML 문자열(클릭 시 모달 렌더). 자체 신뢰 데이터지만
// 방어적으로 <script>/on*= 핸들러 제거.
function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .trim();
}

function buildUniversityDetails(): Record<string, string> {
  const dir = resolve(DATA, 'univ-md');
  const details: Record<string, string> = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const name = file.replace(/\.md$/, '').trim();
    details[name] = sanitize(readFileSync(resolve(dir, file), 'utf-8'));
  }
  return details;
}

const details = buildUniversityDetails();
const detailsPath = resolve(process.cwd(), 'public/data/universityDetails.json');
mkdirSync(resolve(process.cwd(), 'public/data'), { recursive: true });
writeFileSync(detailsPath, JSON.stringify(details), 'utf-8');
console.log(`✓ universityDetails.json 생성 — 대학 ${Object.keys(details).length}개`);

// ── ④ 카드용 2줄 요약 (univSummaries.json) ──
// 각 대학 상세의 첫 표에서 전형방법·수능최저·반영교과 + 말미 '지원 가능 성적' 성적대 추출.
function cleanText(s: string): string {
  return s
    .replace(/<\/p>\s*<p[^>]*>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/\\([~*_|–-])/g, '$1') // 마크다운 이스케이프(\~ 등) 해제
    .replace(/\s+/g, ' ')
    .replace(/^[·:\s]+/, '')
    .replace(/[,·\s]+$/, '')
    .trim();
}
function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function cellValue(md: string, labels: string[]): string {
  for (const label of labels) {
    const re = new RegExp(
      `<td>(?:(?!</td>)[\\s\\S])*?${label}(?:(?!</td>)[\\s\\S])*?</td>\\s*<td>([\\s\\S]*?)</td>`,
    );
    const m = md.match(re);
    if (m) return cleanText(m[1]);
  }
  return '';
}
function scoreLine(md: string): string {
  const idx = ['지원 가능 성적', '지원가능 성적', '지원 가능'].map((k) => md.indexOf(k)).find((i) => i >= 0);
  if (idx == null) return '';
  const tail = md.slice(idx);
  const cands = [
    ...[...tail.matchAll(/\*\*([^*]+)\*\*/g)].map((x) => x[1]),
    ...[...tail.matchAll(/<strong>([^<]+)<\/strong>/g)].map((x) => x[1]),
  ]
    .map((c) => cleanText(c))
    .filter((c) => /등급|점|만점/.test(c))
    .filter((c) => !/^\(|기준\)$|성적대$/.test(c)); // "(5등급기준)"·"…성적대" 라벨 제외
  // 범위(1.0등급 ~ 1.05등급) 또는 '만점' 우선, 없으면 숫자 2개 이상
  const val =
    cands.find((c) => /등급.*[~∼〜–-].*등급|만점/.test(c)) ??
    cands.find((c) => (c.match(/\d/g) ?? []).length >= 2) ??
    cands[0] ??
    '';
  return val;
}
function buildUnivSummaries(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, html] of Object.entries(details)) {
    const method = trunc(cellValue(html, ['전형 방법', '전형방법']), 30);
    const minCsat = trunc(cellValue(html, ['수능 최저', '수능최저']), 44);
    const subjects = trunc(cellValue(html, ['기본 반영교과', '반영교과', '반영 교과']), 30);
    const score = trunc(scoreLine(html), 24);
    const line1 = [method && `전형 ${method}`, minCsat && `최저 ${minCsat}`].filter(Boolean).join(' · ');
    const line2 = [subjects && `반영 ${subjects}`, score && `지원가능 ${score}`].filter(Boolean).join(' · ');
    const summary = [line1, line2].filter(Boolean).join('\n');
    if (summary) out[name] = summary;
  }
  return out;
}
const summaries = buildUnivSummaries();
writeFileSync(
  resolve(process.cwd(), 'public/data/univSummaries.json'),
  JSON.stringify(summaries),
  'utf-8',
);
console.log(`✓ univSummaries.json 생성 — 요약 ${Object.keys(summaries).length}개`);
console.log(`  계열별 입결: ${admissions.filter((a) => a.track === '인문').length} 인문 / ${admissions.filter((a) => a.track === '자연').length} 자연`);
console.log(`  대학 수: ${uniMap.size}`);
