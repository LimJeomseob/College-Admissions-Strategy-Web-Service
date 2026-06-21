import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonUniv } from '../../src/data/loadDeptAdmissions';

// 2028 학생부종합전형 선택과목(권장과목) DB 변환
//   scripts/etl/data/jonghapSubjects.json (롱포맷: {대학,모집단위,구분,과목})
//   → public/jonghapSubjects.json : Record<univCanon, Record<dept, {핵심,권장,선택}>>
// 실행: npx tsx scripts/etl/buildJonghapSubjects.ts

type Kind = '핵심' | '권장' | '선택';
type DeptRec = Record<Kind, string[]>;
type Out = Record<string, Record<string, DeptRec>>;

const SRC = resolve(process.cwd(), 'scripts/etl/data/jonghapSubjects.json');
const OUT = resolve(process.cwd(), 'public/jonghapSubjects.json');
const KINDS: Kind[] = ['핵심', '권장', '선택'];

interface Row { 대학: string; 모집단위: string; 구분: string; 과목: string }

const rows = JSON.parse(readFileSync(SRC, 'utf-8')) as Row[];
const out: Out = {};
let n = 0;
for (const r of rows) {
  const canon = canonUniv(String(r.대학 ?? ''));
  const dept = String(r.모집단위 ?? '').trim();
  const kind = String(r.구분 ?? '').trim() as Kind;
  const subj = String(r.과목 ?? '').trim();
  if (!canon || !dept || !KINDS.includes(kind) || !subj) continue;
  const u = (out[canon] ??= {});
  const d = (u[dept] ??= { 핵심: [], 권장: [], 선택: [] });
  if (!d[kind].includes(subj)) {
    d[kind].push(subj);
    n++;
  }
}

mkdirSync(resolve(process.cwd(), 'public'), { recursive: true });
writeFileSync(OUT, JSON.stringify(out), 'utf-8');
console.log(`✓ jonghapSubjects.json — 대학 ${Object.keys(out).length}개 / 과목매핑 ${n}`);
