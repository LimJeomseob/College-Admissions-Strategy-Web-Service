import { describe, expect, it } from 'vitest';
import {
  buildSubjectStrategies,
  computeComboAverages,
  convert,
  match,
  triage,
} from '../src/engine';
import { SUBJECT_ONLY_THRESHOLD } from '../src/config';
import type { AdmissionRow, ConversionRow, SubjectInput, SubjectTrackRow } from '../src/types';

// 환산표: 1.00→1.45, 3.50→5.86 선형 (목업과 동일 모델)
const conversion: ConversionRow[] = Array.from({ length: 51 }, (_, i) => {
  const avg5 = Math.round((1.0 + i * 0.05) * 100) / 100;
  const est9 = Math.round((1.45 + ((5.86 - 1.45) / 2.5) * (avg5 - 1.0)) * 100) / 100;
  return { avg5, est9, refs: { busan: est9 - 0.1, daejin: est9 + 0.1 } };
});

describe('[1단계] 가중평균', () => {
  const subjects: SubjectInput[] = [
    { category: '국어', name: '국어', grade5: 2, credits: 4 },
    { category: '수학', name: '수학', grade5: 4, credits: 4 },
    { category: '영어', name: '영어', grade5: 2, credits: 2 },
    { category: '사회', name: '사회', grade5: 3, credits: 2 },
    { category: '과학', name: '과학', grade5: 1, credits: 2 },
  ];

  it('전과목 가중평균을 계산한다', () => {
    const avg = computeComboAverages(subjects);
    // (2*4+4*4+2*2+3*2+1*2)/14 = 36/14 = 2.57
    expect(avg['전과목']).toBeCloseTo(2.57, 2);
  });

  it('국수영사와 국수영과를 구분해 산출한다', () => {
    const avg = computeComboAverages(subjects);
    // 국수영사: (2*4+4*4+2*2+3*2)/12 = 34/12 = 2.83
    expect(avg['국수영사']).toBeCloseTo(2.83, 2);
    // 국수영과: (2*4+4*4+2*2+1*2)/12 = 30/12 = 2.50
    expect(avg['국수영과']).toBeCloseTo(2.5, 2);
  });

  it('미입력(0/NaN) 과목은 제외한다', () => {
    const avg = computeComboAverages([
      { category: '국어', name: '국어', grade5: 2, credits: 4 },
      { category: '수학', name: '수학', grade5: 0, credits: 4 },
    ]);
    expect(avg['국수영사']).toBe(2);
  });
});

describe('[2단계] 환산 + 보간 + 외삽', () => {
  it('경계값을 정확히 환산한다', () => {
    expect(convert(conversion, 1.0).est9).toBeCloseTo(1.45, 2);
    expect(convert(conversion, 3.5).est9).toBeCloseTo(5.86, 2);
  });

  it('표에 없는 값을 선형 보간한다', () => {
    const r = convert(conversion, 1.03); // 1.00~1.05 사이
    expect(r.est9).toBeGreaterThan(1.45);
    expect(r.est9).toBeLessThan(convert(conversion, 1.05).est9 + 0.01);
  });

  it('커버리지(3.50) 초과 시 외삽 경고', () => {
    expect(convert(conversion, 3.8).extrapolated).toBe(true);
    expect(convert(conversion, 2.0).extrapolated).toBe(false);
  });

  it('참고 범위를 함께 제공한다', () => {
    expect(convert(conversion, 2.0).refRange).not.toBeNull();
  });
});

describe('분기(triage) 규칙 — 3.5 임계값', () => {
  it('추정 9등급 >= 3.5면 교과전형 집중', () => {
    expect(triage(SUBJECT_ONLY_THRESHOLD).subjectOnly).toBe(true);
    expect(triage(4.2).subjectOnly).toBe(true);
  });
  it('3.5 미만이면 양 전형 검토', () => {
    expect(triage(2.5).subjectOnly).toBe(false);
  });
});

describe('[3단계] 매칭', () => {
  const admissions: AdmissionRow[] = [
    mkAdm('A', '안정대', '인문', '학생부교과', 4.0),
    mkAdm('B', '적정대', '인문', '학생부교과', 3.0),
    mkAdm('C', '소신대', '인문', '학생부교과', 2.0),
    { ...mkAdm('D', '미공개대', '인문', '학생부교과', 3.0), cutGrade: null },
  ];
  // 전과목 평균 2.5 → est9 ≈ 1.45 + 1.764*1.5 ≈ 4.10
  const averages = computeComboAverages([
    { category: '국어', name: '국', grade5: 2.5, credits: 1 },
    { category: '수학', name: '수', grade5: 2.5, credits: 1 },
    { category: '영어', name: '영', grade5: 2.5, credits: 1 },
    { category: '사회', name: '사', grade5: 2.5, credits: 1 },
  ]);

  it('입결 미공개는 별도 분리(임의추정 금지)', () => {
    const out = match(admissions, conversion, averages, { track: '인문' });
    expect(out.undisclosed.map((u) => u.univName)).toContain('미공개대');
  });

  it('지원가능권을 안정/적정/소신으로 분류한다', () => {
    const out = match(admissions, conversion, averages, { track: '인문' });
    expect(out.matched.length).toBeGreaterThan(0);
    const bands = new Set(out.matched.map((m) => m.band));
    expect(bands.size).toBeGreaterThanOrEqual(1);
  });
});

describe('[4단계] 교과전략', () => {
  it('교과전형 항목만 카드로 만들고 반영방법을 진단한다', () => {
    const averages = computeComboAverages([
      { category: '국어', name: '국', grade5: 2, credits: 1 },
      { category: '수학', name: '수', grade5: 2, credits: 1 },
      { category: '영어', name: '영', grade5: 2, credits: 1 },
      { category: '사회', name: '사', grade5: 1, credits: 1 },
      { category: '과학', name: '과', grade5: 4, credits: 1 },
    ]);
    const admissions = [mkAdm('SEOULTECH', '서울과기대', '인문', '학생부교과', 4.0)];
    const out = match(admissions, conversion, averages, { track: '인문' });
    const track: SubjectTrackRow[] = [
      {
        univCode: 'SEOULTECH', univName: '서울과기대', admissionName: '교과우수자',
        method: '교과100%', minCsat: null, reflectedSubjects: '국수영사',
        combo: '국수영사', reflectMethod: '상위10과목', indicator: '등급',
      },
    ];
    const cards = buildSubjectStrategies(out.matched, track, averages);
    expect(cards.length).toBe(1);
    expect(cards[0].detail?.combo).toBe('국수영사');
    // 국수영사(과학 제외)가 전과목보다 유리해야 함
    expect(cards[0].advantage).toMatch(/유리|반영/);
  });
});

function mkAdm(
  code: string, name: string, track: '인문' | '자연',
  type: AdmissionRow['admissionType'], cut: number,
): AdmissionRow {
  return {
    univCode: code, univName: name, region: '서울', track, admissionType: type,
    admissionName: '교과우수자', unit: '경영학과', cutGrade: cut, cutBasis: '70%컷',
    history: [{ year: 2025, grade: cut }, { year: 2024, grade: cut }, { year: 2023, grade: cut }],
    competitionRate: 10, minCsat: null,
  };
}
