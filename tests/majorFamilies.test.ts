import { describe, it, expect } from 'vitest';
import { lookupMajor } from '../src/data/majorFamilies';
import { annotateByMajor } from '../src/engine/majorMatch';
import type { MatchOutput } from '../src/engine';
import type { AdmissionRow, MatchResult, RiskBand } from '../src/types';

describe('lookupMajor', () => {
  it('정확 매칭', () => {
    const r = lookupMajor('교육학과');
    expect(r.major).toBe('교육학과');
    expect(r.families).toContain('사범대');
    expect(r.track).toBe('인문');
  });

  it('공백 무시 정확 매칭', () => {
    expect(lookupMajor('  경영 학과 ').major).toBe('경영학과');
  });

  it('키워드/부분일치', () => {
    const r = lookupMajor('컴퓨터');
    expect(r.major).toBe('컴퓨터공학과');
    expect(r.track).toBe('자연');
  });

  it('미일치 → 폴백(families 비고, 입력어를 키워드로)', () => {
    const r = lookupMajor('xyz가상학과');
    expect(r.families).toEqual([]);
    expect(r.track).toBeNull();
    expect(r.keywords).toContain('xyz가상학과');
  });
});

function mkResult(unit: string, band: RiskBand): MatchResult {
  const row: AdmissionRow = {
    univCode: 'U', univName: '대학', region: '서울', track: null,
    admissionType: '학생부교과', admissionName: '교과', unit,
    cutGrade: 3, cutBasis: '평균', history: [], competitionRate: null, minCsat: null,
  };
  return { row, appliedEst9: 3, appliedCombo: '전과목', band, gap: 0 };
}

describe('annotateByMajor', () => {
  it('부합 항목에 플래그 + 같은 구간 내 우선 정렬', () => {
    const output: MatchOutput = {
      matched: [mkResult('경영학과', '적정'), mkResult('컴퓨터공학과', '적정')],
      undisclosed: [],
    };
    const out = annotateByMajor(output, lookupMajor('컴퓨터'));
    expect(out.matched[0].row.unit).toBe('컴퓨터공학과');
    expect(out.matched[0].majorMatch).toBe(true);
    expect(out.matched[1].majorMatch).toBe(false);
  });

  it('band 순서는 보존(부합이어도 구간이 우선)', () => {
    const output: MatchOutput = {
      matched: [mkResult('국어국문학과', '안정'), mkResult('컴퓨터공학과', '소신')],
      undisclosed: [],
    };
    const out = annotateByMajor(output, lookupMajor('컴퓨터'));
    expect(out.matched[0].band).toBe('안정');
    expect(out.matched[1].row.unit).toBe('컴퓨터공학과');
  });

  it('행을 제거하지 않음', () => {
    const output: MatchOutput = { matched: [mkResult('경영학과', '적정')], undisclosed: [] };
    expect(annotateByMajor(output, lookupMajor('컴퓨터')).matched).toHaveLength(1);
  });

  it('빈 입력은 원본 그대로 반환', () => {
    const output: MatchOutput = { matched: [mkResult('경영학과', '적정')], undisclosed: [] };
    expect(annotateByMajor(output, lookupMajor(''))).toBe(output);
  });
});
