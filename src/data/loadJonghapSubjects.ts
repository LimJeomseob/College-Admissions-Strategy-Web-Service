import { canonUniv, deptMatches } from './loadDeptAdmissions';

// 5단계 학생부종합전형 선택과목 추천 DB(public/jonghapSubjects.json) 접근.
// 구조: Record<univCanon, Record<dept, {핵심,권장,선택}>>

export interface JonghapRec {
  핵심: string[];
  권장: string[];
  선택: string[];
}
export type JonghapMap = Record<string, Record<string, JonghapRec>>;

let cache: JonghapMap | null = null;
let inflight: Promise<JonghapMap> | null = null;

export { canonUniv };

export function loadJonghapSubjects(): Promise<JonghapMap> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    const url = `${import.meta.env.BASE_URL}jonghapSubjects.json`;
    inflight = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<JonghapMap>) : ({} as JonghapMap)))
      .then((d) => (cache = d))
      .catch(() => (cache = {}));
  }
  return inflight;
}

const norm = (s: string) => String(s ?? '').replace(/\s/g, '').replace(/(학과|학부|전공|계열|과)$/, '');

/** 선택 대학·모집단위에 대한 추천 과목. 정확일치 → 정규화 동일 → 80% 유사 순. 없으면 null. */
export function recommendFor(map: JonghapMap, univName: string, dept: string): JonghapRec | null {
  const byDept = map[canonUniv(univName)];
  if (!byDept) return null;
  if (byDept[dept]) return byDept[dept];
  const keys = Object.keys(byDept);
  const target = norm(dept);
  const exactNorm = keys.find((k) => norm(k) === target);
  if (exactNorm) return byDept[exactNorm];
  const fuzzy = keys.find((k) => deptMatches(k, dept));
  return fuzzy ? byDept[fuzzy] : null;
}
