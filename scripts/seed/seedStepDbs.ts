import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { canonUniv } from '../../src/data/loadDeptAdmissions';

// 단계별 DB 시드 — scripts/seed/data/의 원본 3종을 Supabase 테이블에 적재(통째 교체).
//   2단계 conversion_db ← 5등급_9등급_환산_DB.md
//   3단계 strategy_db    ← 교과전형_준비전략_DB.json
//   4단계 dept_admissions_db ← 대학학과입결.json (71k, 배치 적재)
//
// 실행: SUPABASE_SERVICE_ROLE_KEY=... npm run seed:stepdbs
//   (URL은 .env의 VITE_SUPABASE_URL 사용. 서비스롤 키는 절대 커밋 금지.)

const DATA = resolve(process.cwd(), 'scripts/seed/data');
const BATCH = 1000;

function envUrl(): string {
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
  const env = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
  const m = env.match(/VITE_SUPABASE_URL=(.+)/);
  if (!m) throw new Error('VITE_SUPABASE_URL을 찾을 수 없습니다.');
  return m[1].trim();
}

const url = envUrl();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다(서비스롤 키).');
const db = createClient(url, key, { auth: { persistSession: false } });

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const m = String(v).replace(/[, %]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const str = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
};
const track = (v: unknown): string | null => {
  const s = String(v ?? '');
  return s.includes('자연') ? '자연' : s.includes('인문') ? '인문' : null;
};

function readJson(name: string): Record<string, unknown>[] {
  return JSON.parse(readFileSync(resolve(DATA, name), 'utf-8'));
}

function readMdTable(name: string): Record<string, string>[] {
  const lines = readFileSync(resolve(DATA, name), 'utf-8')
    .split('\n')
    .filter((l) => l.trim().startsWith('|'));
  const cells = (l: string) => l.split('|').slice(1, -1).map((c) => c.trim());
  const head = cells(lines[0]);
  return lines.slice(2).map(cells).filter((r) => r.length === head.length).map((r) => {
    const o: Record<string, string> = {};
    head.forEach((h, i) => (o[h] = r[i]));
    return o;
  });
}

async function replace(table: string, rows: Record<string, unknown>[]) {
  const del = await db.from(table).delete().gte('id', 0);
  if (del.error) throw new Error(`${table} 삭제 실패: ${del.error.message}`);
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await db.from(table).insert(chunk);
    if (error) throw new Error(`${table} 적재 실패(${i}): ${error.message}`);
    process.stdout.write(`\r  ${table}: ${Math.min(i + chunk.length, rows.length)} / ${rows.length}`);
  }
  process.stdout.write('\n');
}

async function main() {
  // 2단계
  const conv = readMdTable('5등급_9등급_환산_DB.md').map((r) => ({
    avg5: num(r['5등급평균']),
    busan: num(r['부산']),
    daejin: num(r['대진대']),
    integrated: num(r['50:50통합']),
    gg_jeon: str(r['경기(전과목)']),
    gg_guksuyeongsagwa: str(r['경기(국수영사과)']),
    gg_guksuyeonggwa: str(r['경기(국수영과)']),
    gg_guksuyeongsa: str(r['경기(국수영사)']),
  })).filter((r) => r.avg5 != null);
  await replace('conversion_db', conv);

  // 3단계
  const strat = readJson('교과전형_준비전략_DB.json').map((r) => {
    const univ = String(r['대학명'] ?? '').trim();
    return {
      track: track(r['계열']),
      admission_type: str(r['전형']),
      avg5: str(r['5등급']),
      est9: num(r['9등급']),
      rank300: str(r['전교 등수(300)']),
      univ_name: univ,
      univ_canon: canonUniv(univ),
    };
  }).filter((r) => r.univ_name);
  await replace('strategy_db', strat);

  // 4단계
  const dept = readJson('대학학과입결.json').map((r) => {
    const univ = String(r['대학'] ?? '').trim();
    return {
      univ_canon: canonUniv(univ),
      univ_raw: univ,
      year: num(r['학년도']),
      type: str(r['전형']),
      detail: str(r['세부전형']),
      dept: str(r['모집단위']),
      quota: num(r['모집인원']),
      comp: num(r['실경쟁률']),
      add_pass: num(r['추합']),
      g50: num(r['등급50']),
      g70: num(r['등급70']),
    };
  }).filter((r) => r.univ_canon);
  await replace('dept_admissions_db', dept);

  console.log('✓ 시드 완료 — conversion', conv.length, '/ strategy', strat.length, '/ dept', dept.length);
}

main().catch((e) => { console.error(e); process.exit(1); });
