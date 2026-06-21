import type { AdmissionRow, ConversionRow, DeptRow } from '../types';
import { supabase } from '../auth/supabaseClient';
import { USE_SUPABASE_DATA } from '../config';
import { canonUniv } from './loadDeptAdmissions';

// 단계별 DB를 Supabase에서 로드해 앱 타입으로 매핑.
// Supabase 미설정/비활성/빈 테이블이면 null을 반환해 호출측이 정적 폴백하도록 한다.

const enabled = () => USE_SUPABASE_DATA && !!supabase;

/** 범위 문자열("1.00-1.63")의 하한값을 숫자로. 단일값도 처리. */
function lowBound(s: string | null | undefined): number | undefined {
  if (!s) return undefined;
  const m = String(s).match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

// ── 2단계: 환산 DB → ConversionRow[] ──
export async function loadConversionRows(): Promise<ConversionRow[] | null> {
  if (!enabled()) return null;
  const { data, error } = await supabase!
    .from('conversion_db')
    .select('avg5, busan, daejin, integrated, gg_jeon')
    .order('avg5', { ascending: true });
  if (error || !data || data.length === 0) return null;
  return data
    .map((r) => {
      const avg5 = Number(r.avg5);
      // 기본 est9: 50:50 통합 → 없으면 부산/대진 평균 → 없으면 경기 전과목 하한.
      const integrated = r.integrated != null ? Number(r.integrated) : undefined;
      const busan = r.busan != null ? Number(r.busan) : undefined;
      const daejin = r.daejin != null ? Number(r.daejin) : undefined;
      const est9 =
        integrated ??
        (busan != null && daejin != null ? (busan + daejin) / 2 : (busan ?? daejin ?? lowBound(r.gg_jeon)));
      return {
        avg5,
        est9: est9 as number,
        refs: { busan, daejin, gyeonggi: lowBound(r.gg_jeon) },
      };
    })
    .filter((r) => Number.isFinite(r.avg5) && Number.isFinite(r.est9));
}

// ── 3단계: 전략 DB → AdmissionRow[] (합격선 라인) ──
const ADMISSION_TYPE: Record<string, AdmissionRow['admissionType']> = {
  교과전형: '학생부교과',
  종합전형: '학생부종합',
};

export async function loadStrategyAdmissions(): Promise<AdmissionRow[] | null> {
  if (!enabled()) return null;
  const { data, error } = await supabase!
    .from('strategy_db')
    .select('track, admission_type, avg5, est9, rank300, univ_name, univ_canon');
  if (error || !data || data.length === 0) return null;
  return data.map((r) => {
    const track = r.track === '인문' || r.track === '자연' ? (r.track as AdmissionRow['track']) : null;
    const admissionType = ADMISSION_TYPE[String(r.admission_type)] ?? '학생부교과';
    const rankPart = r.rank300 ? ` · 전교 ~${r.rank300}등` : '';
    return {
      univCode: r.univ_name,
      univName: r.univ_name,
      region: '',
      track,
      admissionType,
      admissionName: String(r.admission_type ?? ''),
      unit: '대학 합격선 라인',
      cutGrade: r.est9 != null ? Number(r.est9) : null,
      cutBasis: `5등급 ${r.avg5 ?? '—'} 라인${rankPart}`,
      history: [],
      competitionRate: null,
      minCsat: null,
    } satisfies AdmissionRow;
  });
}

// ── 4단계: 대학학과입결 DB → 선택 대학(canon)별 DeptRow[] ──
const deptCache = new Map<string, DeptRow[]>();

/** 선택 대학명을 canon으로 변환해 누락분만 Supabase 조회. 정적 폴백은 호출측에서 처리. */
export async function loadDeptAdmissionsFor(univNames: string[]): Promise<Record<string, DeptRow[]> | null> {
  if (!enabled()) return null;
  const canons = [...new Set(univNames.map(canonUniv))].filter(Boolean);
  const missing = canons.filter((c) => !deptCache.has(c));
  if (missing.length > 0) {
    const { data, error } = await supabase!
      .from('dept_admissions_db')
      .select('univ_canon, year, type, detail, dept, quota, comp, add_pass, g50, g70')
      .in('univ_canon', missing);
    if (error) return null;
    for (const c of missing) deptCache.set(c, []); // 빈 결과도 캐시(재조회 방지)
    for (const r of data ?? []) {
      const row: DeptRow = {
        year: Number(r.year),
        type: String(r.type ?? ''),
        detail: String(r.detail ?? ''),
        dept: String(r.dept ?? ''),
        quota: r.quota != null ? Number(r.quota) : null,
        comp: r.comp != null ? Number(r.comp) : null,
        addPass: r.add_pass != null ? Number(r.add_pass) : null,
        g50: r.g50 != null ? Number(r.g50) : null,
        g70: r.g70 != null ? Number(r.g70) : null,
      };
      deptCache.get(r.univ_canon)?.push(row);
    }
  }
  const out: Record<string, DeptRow[]> = {};
  for (const c of canons) out[c] = deptCache.get(c) ?? [];
  return out;
}

/** 4단계 Supabase 사용 가능 여부(정적 폴백 분기용) */
export const supabaseDataEnabled = enabled;
