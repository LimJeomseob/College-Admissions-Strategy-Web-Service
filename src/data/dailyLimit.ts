import { supabase } from '../auth/supabaseClient';
import { DAILY_ANALYSIS_LIMIT } from '../config';

// REQ-70: 일일 분석 실행 제한. 별도 자정 리셋 잡 없이, 'KST 자정 이후 analysis_run 수'를
// 세어 제한한다(자정이 지나면 카운트가 0부터 다시 시작 → 자연스러운 리셋).
// 클라이언트 게이트(UX 차단)이며, usage_events(RLS 본인 select) 조회로 카운트한다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 오늘(Asia/Seoul) 자정을 UTC ISO 문자열로. */
export function kstMidnightUtcISO(now = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const midnightUtcMs = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS;
  return new Date(midnightUtcMs).toISOString();
}

/** 오늘 사용한 분석 실행 횟수. 서버 조회 실패 시 0(제한 미적용). */
export async function countTodayAnalysis(userId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', 'analysis_run')
    .gte('created_at', kstMidnightUtcISO());
  if (error) return 0;
  return count ?? 0;
}

export const dailyLimitEnabled = () => DAILY_ANALYSIS_LIMIT > 0;
