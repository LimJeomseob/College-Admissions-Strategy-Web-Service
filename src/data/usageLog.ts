import { supabase } from '../auth/supabaseClient';
import type { UsageEventType } from '../types';

// 사용이력 로깅 — 로그인 사용자의 단계 진입·완료/분석 실행을 usage_events에 기록.
// fire-and-forget(실패 무시). 세션 내 중복 방지(같은 event_type|step 1회).

const sent = new Set<string>();

export function logUsage(
  eventType: UsageEventType,
  step?: string,
  meta?: Record<string, unknown>,
  opts?: { once?: boolean },
): void {
  if (!supabase) return;
  const key = `${eventType}|${step ?? ''}`;
  if (opts?.once) {
    if (sent.has(key)) return;
    sent.add(key);
  }
  supabase.auth.getUser().then(({ data }) => {
    const uid = data.user?.id;
    if (!uid) return;
    supabase!
      .from('usage_events')
      .insert({ user_id: uid, event_type: eventType, step: step ?? null, meta: meta ?? null })
      .then(() => undefined);
  });
}

/** 로그아웃/계정 전환 시 중복방지 캐시 초기화 */
export function resetUsageDedupe(): void {
  sent.clear();
}
