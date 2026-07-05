import { supabase } from '../auth/supabaseClient';
import { canonUniv } from './loadDeptAdmissions';
import type { FinalReportData, JonghapAiRec } from '../types';

// AI 근거 설명(REQ-41) · 최종 보고서(REQ-50) 호출 래퍼.
// AI 호출은 Supabase Edge Function(ai-guidance)에서 수행하며, 키는 서버 secret으로 보관.
// 로그인 사용자만 사용 가능(함수 verify_jwt). 동일 입력은 세션 내 캐시로 재호출을 막는다.

interface SubjectArgs {
  univName: string;
  dept: string;
  track?: string;
  desiredMajor?: string;
}

export interface ReportPayload {
  est9: number;
  refRange?: { min: number; max: number } | null;
  averages?: Record<string, number | null>;
  desiredMajor?: string;
  track?: string;
  universities: { name: string }[];
  jonghap: { univName: string; dept: string; type?: string; subjects?: string[] }[];
  triageMessage?: string;
}

const subjectCache = new Map<string, Promise<JonghapAiRec>>();
const reportCache = new Map<string, Promise<FinalReportData>>();

async function invoke<T>(task: 'subjects' | 'report', payload: unknown): Promise<T> {
  if (!supabase) throw new Error('서버가 설정되지 않아 AI 기능을 사용할 수 없습니다.');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('AI 기능은 로그인 후 이용할 수 있습니다.');

  const { data, error } = await supabase.functions.invoke('ai-guidance', {
    body: { task, payload },
  });
  if (error) {
    // Edge Function이 4xx/5xx로 보낸 본문의 메시지를 우선 사용.
    let msg = 'AI 생성에 실패했습니다.';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body?.error) msg = String(body.error);
        if (body?.detail) msg += ` (${String(body.detail)})`;
      } catch {
        /* noop */
      }
    }
    throw new Error(msg);
  }
  return data as T;
}

/** REQ-41: 데이터 부재 학과의 선택과목을 타 대학 자료 근거로 생성. 캐시 키 = canon대학|학과. */
export function aiSubjectAdvice(args: SubjectArgs): Promise<JonghapAiRec> {
  const key = `${canonUniv(args.univName)}|${args.dept}`;
  const cached = subjectCache.get(key);
  if (cached) return cached;
  const p = invoke<JonghapAiRec>('subjects', args).catch((e) => {
    subjectCache.delete(key); // 실패는 캐시하지 않음(재시도 허용)
    throw e;
  });
  subjectCache.set(key, p);
  return p;
}

/** REQ-50: 최종 보고서 생성. 캐시 키 = 입력 요약 해시(선택 변동 시 재생성). */
export function aiFinalReport(payload: ReportPayload): Promise<FinalReportData> {
  const key = JSON.stringify({
    e: payload.est9,
    m: payload.desiredMajor,
    t: payload.track,
    u: payload.universities.map((u) => u.name).sort(),
    j: payload.jonghap.map((j) => `${j.univName}|${j.dept}`).sort(),
  });
  const cached = reportCache.get(key);
  if (cached) return cached;
  const p = invoke<FinalReportData>('report', payload).catch((e) => {
    reportCache.delete(key);
    throw e;
  });
  reportCache.set(key, p);
  return p;
}
