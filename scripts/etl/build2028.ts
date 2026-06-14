import { readFileSync } from 'node:fs';
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
console.log(`  계열별 입결: ${admissions.filter((a) => a.track === '인문').length} 인문 / ${admissions.filter((a) => a.track === '자연').length} 자연`);
console.log(`  대학 수: ${uniMap.size}`);
