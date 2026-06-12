import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase 클라이언트 — 공개 값(URL/anon)을 .env(VITE_*)에서 주입.
// 값이 없으면 인증 기능을 비활성(null)으로 두어, 설정 전에도 앱이 깨지지 않게 한다.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// OAuth 등 리디렉션 복귀 주소 — GitHub Pages 서브경로 + HashRouter 고려.
export function redirectTo(path = '/'): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base}#${path}`;
}
