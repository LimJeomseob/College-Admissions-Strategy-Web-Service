import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseGradeFile, ParseError } from '../src/data/parseGradeFile';

const csvFile = (content: string, name = 'grades.csv') => new File([content], name);

describe('parseGradeFile — CSV/TXT', () => {
  it('표준 헤더 CSV 를 행으로 파싱하고 교과군을 정규화한다', async () => {
    const csv = ['교과군,과목명,등급,단위수', '국어,문학,2,4', '수학,미적분,3,3'].join('\n');
    const res = await parseGradeFile(csvFile(csv));
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toEqual({ category: '국어', name: '문학', grade5: 2, credits: 4 });
    expect(res.rows[1].category).toBe('수학');
    expect(res.warnings).toHaveLength(0);
  });

  it('탭 구분 TXT 와 영문 헤더 별칭을 처리한다', async () => {
    const txt = ['category\tname\tgrade\tcredits', 'english\t영어I\t2\t4'].join('\n');
    const res = await parseGradeFile(csvFile(txt, 'grades.txt'));
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].category).toBe('영어');
    expect(res.rows[0].grade5).toBe(2);
  });

  it('계열 열이 있으면 track 을 추출한다', async () => {
    const csv = ['교과군,과목명,등급,단위수,계열', '과학,물리,1,4,자연'].join('\n');
    const res = await parseGradeFile(csvFile(csv));
    expect(res.track).toBe('자연');
    expect(res.rows[0].category).toBe('과학');
  });

  it('불량행은 제외하고 warning 을 남긴다', async () => {
    const csv = ['교과군,과목명,등급,단위수', '국어,문학,abc,4', '수학,미적분,3,4'].join('\n');
    const res = await parseGradeFile(csvFile(csv));
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].name).toBe('미적분');
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('단위수가 비면 1로 보정한다', async () => {
    const csv = ['교과군,과목명,등급,단위수', '국어,문학,2,'].join('\n');
    const res = await parseGradeFile(csvFile(csv));
    expect(res.rows[0].credits).toBe(1);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('헤더가 없으면 NO_HEADER 로 거부한다', async () => {
    const csv = ['hello world', 'foo bar baz'].join('\n');
    await expect(parseGradeFile(csvFile(csv))).rejects.toMatchObject({ code: 'NO_HEADER' });
  });

  it('빈 파일은 EMPTY 로 거부한다', async () => {
    await expect(parseGradeFile(csvFile('   \n  '))).rejects.toBeInstanceOf(ParseError);
    await expect(parseGradeFile(csvFile('   \n  '))).rejects.toMatchObject({ code: 'EMPTY' });
  });

  it('지원하지 않는 확장자는 UNSUPPORTED 로 거부한다', async () => {
    await expect(parseGradeFile(csvFile('데이터', 'grades.pdf'))).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
  });
});

describe('parseGradeFile — XLSX (동적 import 경로)', () => {
  it('엑셀 워크북을 행으로 파싱한다', async () => {
    const aoa = [
      ['교과군', '과목명', '등급', '단위수'],
      ['국어', '독서', 2, 4],
      ['과학', '화학', 3, 3],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const file = new File([buf], 'grades.xlsx');

    const res = await parseGradeFile(file);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toEqual({ category: '국어', name: '독서', grade5: 2, credits: 4 });
    expect(res.rows[1].category).toBe('과학');
  });
});
