import { describe, expect, it } from 'vitest';
import { lookupMajor } from '../src/data/majorFamilies';
import { annotateByMajor } from '../src/engine';
import type { MatchOutput } from '../src/engine';
import type { AdmissionRow, MatchResult } from '../src/types';

describe('lookupMajor', () => {
  it('정확매칭: 표준 학과명을 그대로 매핑한다', () => {
    const lk = lookupMajor('교육학과');
    expect(lk.major).toBe('교육학과');
    expect(lk.track).toBe('인문');
    expect(lk.families).toContain('사범대학');
  });

  it('키워드/부분일치: "컴퓨터" → 컴퓨터공학과(자연)', () => {
    const lk = lookupMajor('컴퓨터');
    expect(lk.major).toBe('컴퓨터공학과');
    expect(lk.track).toBe('자연');
    expect(lk.keywords).toContain('컴퓨터');
  });

  it('폴백: 매핑 불가 입력은 track null·families 빈 배열', () => {
    const lk = lookupMajor('ㅁㄴㅇㄹ');
    expect(lk.major).toBe('ㅁㄴㅇㄹ');
    expect(lk.track).toBeNull();
    expect(lk.families).toEqual([]);
  });

  it('빈 입력은 폴백 처리한다', () => {
    const lk = lookupMajor('');
    expect(lk.track).toBeNull();
    expect(lk.keywords).toEqual([]);
  });
});

describe('annotateByMajor', () => {
  const mk = (univ: string, unit: string): MatchResult => ({
    row: {
      univCode: univ, univName: univ, region: '서울', track: '자연',
      admissionType: '학생부교과', admissionName: '교과', unit,
      cutGrade: 3, cutBasis: '70%컷', history: [], competitionRate: null, minCsat: null,
    } as AdmissionRow,
    appliedEst9: 3, appliedCombo: '국수영과', band: '적정', gap: 0,
  });

  const output: MatchOutput = {
    matched: [mk('A대', '경영학과'), mk('B대', '컴퓨터공학과'), mk('C대', '기계공학과')],
    undisclosed: [],
  };

  it('희망학과 일치 항목을 위로 올리고 majorMatch 플래그를 부여한다', () => {
    const out = annotateByMajor(output, lookupMajor('컴퓨터'));
    expect(out.matched[0].row.unit).toBe('컴퓨터공학과');
    expect(out.matched[0].majorMatch).toBe(true);
    expect(out.matched.find((m) => m.row.unit === '경영학과')?.majorMatch).toBe(false);
  });

  it('행을 제거하지 않는다(개수 보존)', () => {
    const out = annotateByMajor(output, lookupMajor('컴퓨터'));
    expect(out.matched).toHaveLength(3);
  });

  it('입력이 없으면 원본을 그대로 반환한다', () => {
    const out = annotateByMajor(output, lookupMajor(''));
    expect(out).toBe(output);
  });
});
