import { describe, it, expect } from 'vitest';
import { parseGradeFile, ParseError } from '../src/data/parseGradeFile';

const csv = (content: string, name = 'grades.csv') => new File([content], name, { type: 'text/csv' });

describe('parseGradeFile — csv/txt', () => {
  it('표준 헤더 + 행 파싱', async () => {
    const r = await parseGradeFile(csv('과목구분,과목명,등급,단위수\n국어,문학,2,4\n수학,미적분,3,4\n'));
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ category: '국어', name: '문학', grade5: 2, credits: 4 });
    expect(r.warnings).toHaveLength(0);
  });

  it('영문/별칭 헤더 + 탭 구분(txt)', async () => {
    const txt = 'category\tname\tgrade\tcredits\n사회,\t통합사회\t2\t3\n';
    const r = await parseGradeFile(new File([txt.replace('사회,', '사회')], 'g.txt', { type: 'text/plain' }));
    expect(r.rows[0].category).toBe('사회');
    expect(r.rows[0].credits).toBe(3);
  });

  it('불량 행(등급 비숫자)은 건너뛰고 warning 기록', async () => {
    const r = await parseGradeFile(csv('과목구분,과목명,등급,단위수\n국어,문학,abc,4\n수학,미적분,3,4\n'));
    expect(r.rows).toHaveLength(1);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('과목구분 컬럼이 없으면 과목명 키워드로 교과군 추론', async () => {
    const r = await parseGradeFile(csv('과목명,등급,단위수\n물리학I,2,3\n'));
    expect(r.rows[0].category).toBe('과학');
  });

  it('계열 컬럼이 있으면 track 추출', async () => {
    const r = await parseGradeFile(csv('계열,과목명,등급,단위수\n자연,수학,2,4\n'));
    expect(r.track).toBe('자연');
  });

  it('헤더 미검출 → NO_HEADER', async () => {
    await expect(parseGradeFile(csv('foo,bar\n1,2\n'))).rejects.toMatchObject({ code: 'NO_HEADER' });
  });

  it('빈 파일 → EMPTY', async () => {
    await expect(parseGradeFile(csv(''))).rejects.toBeInstanceOf(ParseError);
    await expect(parseGradeFile(csv(''))).rejects.toMatchObject({ code: 'EMPTY' });
  });

  it('미지원 확장자 → UNSUPPORTED', async () => {
    await expect(parseGradeFile(new File(['x'], 'g.pdf'))).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  });
});
