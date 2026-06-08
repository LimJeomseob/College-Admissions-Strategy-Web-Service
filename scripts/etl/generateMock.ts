import type {
  AdmissionRow,
  ConversionRow,
  DataLayer,
  SubjectTrackRow,
  Track,
} from '../../src/types';
import { verifyJoins, writeDataLayer } from './writeOutput';

// ───────────────────────────────────────────────────────────
// 목업 데이터 생성기
// 실제 5종 DB 업로드 전, 앱을 엔드투엔드로 구동하기 위한 샘플.
// 보고서의 스키마/수치 범위(환산 1.00~3.50, 9등급 1.45~5.86 등)를 따른다.
// 실제 데이터가 오면 `npm run etl`(index.ts)이 동일 구조의 산출물을 덮어쓴다.
// ───────────────────────────────────────────────────────────

/** 환산표: 1.00~3.50, 0.05 간격. 9등급은 보고서 범위(약 1.45~5.86)에 맞춰 선형 모델 */
function buildConversion(): ConversionRow[] {
  const rows: ConversionRow[] = [];
  for (let avg5 = 1.0; avg5 <= 3.5001; avg5 += 0.05) {
    const a = Math.round(avg5 * 100) / 100;
    // 1.00→1.45, 3.50→5.86 선형
    const est9 = round2(1.45 + ((5.86 - 1.45) / (3.5 - 1.0)) * (a - 1.0));
    rows.push({
      avg5: a,
      est9,
      refs: {
        busan: round2(est9 - 0.12),
        daejin: round2(est9 + 0.12),
        gyeonggi: round2(est9 + 0.05),
      },
    });
  }
  return rows;
}

const SAMPLE_UNIVS = [
  { univCode: 'SEOULTECH', univName: '서울과학기술대학교', region: '서울' },
  { univCode: 'HYU_ERICA', univName: '한양대학교(ERICA)', region: '경기' },
  { univCode: 'GACHON', univName: '가천대학교', region: '경기' },
  { univCode: 'KONKUK', univName: '건국대학교', region: '서울' },
  { univCode: 'INHA', univName: '인하대학교', region: '인천' },
];

const UNITS_BY_TRACK: Record<Track, string[]> = {
  인문: ['경영학과', '국어국문학과', '행정학과'],
  자연: ['기계공학과', '컴퓨터공학과', '화학공학과'],
};

function buildAdmissions(): AdmissionRow[] {
  const rows: AdmissionRow[] = [];
  for (const u of SAMPLE_UNIVS) {
    (['인문', '자연'] as Track[]).forEach((track) => {
      UNITS_BY_TRACK[track].forEach((unit, i) => {
        // 학생부교과 + 학생부종합 각각 생성
        (['학생부교과', '학생부종합'] as const).forEach((admissionType) => {
          const base = 2.2 + i * 0.4 + (admissionType === '학생부종합' ? 0.3 : 0);
          const cut = round2(base + (u.univCode === 'KONKUK' ? -0.2 : 0));
          // 일부 행은 입결 미공개(null)로 — 결측 분리 동작 확인용
          const disclosed = !(admissionType === '학생부종합' && i === 2);
          rows.push({
            univCode: u.univCode,
            univName: u.univName,
            region: u.region,
            track,
            admissionType,
            admissionName: admissionType === '학생부교과' ? '교과우수자' : '종합전형',
            unit,
            cutGrade: disclosed ? cut : null,
            cutBasis: '70%컷',
            history: [
              { year: 2025, grade: disclosed ? cut : null },
              { year: 2024, grade: disclosed ? round2(cut + 0.1) : null },
              { year: 2023, grade: disclosed ? round2(cut + 0.2) : null },
            ],
            competitionRate: round2(8 + i * 1.5),
            minCsat: admissionType === '학생부교과' ? '국수영탐 2합 6' : null,
          });
        });
      });
    });
  }
  return rows;
}

function buildSubjectTrack(): SubjectTrackRow[] {
  return SAMPLE_UNIVS.map((u, i) => ({
    univCode: u.univCode,
    univName: u.univName,
    admissionName: '교과우수자',
    method: i % 2 === 0 ? '교과100%' : '교과80%+면접20%',
    minCsat: '국수영탐 2합 6',
    reflectedSubjects: i % 2 === 0 ? '국수영사' : '국수영과',
    combo: i % 2 === 0 ? '국수영사' : '국수영과',
    reflectMethod: i % 2 === 0 ? '상위 10과목' : '전과목',
    indicator: '등급',
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const layer: DataLayer = {
  conversion: buildConversion(),
  admissions: buildAdmissions(),
  subjectTrack: buildSubjectTrack(),
  universities: SAMPLE_UNIVS,
  meta: { generatedAt: new Date().toISOString(), source: 'mock' },
};

writeDataLayer(layer);
verifyJoins(layer);
