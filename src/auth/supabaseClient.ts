import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase 클라이언트 — 공개 값(URL/anon)을 .env(VITE_*)에서 주입.
// 값이 없으면 인증 기능을 비활성(null)으로 두어, 설정 전에도 앱이 깨지지 않게 한다.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// OAuth(PKCE) 복귀 직후인지 — 모듈 로드 시점(supabase가 URL을 정리하기 전)에 포착.
// HashRouter 환경에서 ?code= 는 실제 쿼리스트링에 담겨 와야 supabase-js가 세션 교환 가능.
export const hadOAuthRedirect =
  typeof window !== 'undefined' && /[?&]code=/.test(window.location.search);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// OAuth/이메일 확인 복귀 주소.
// 해시(#/...)를 붙이면 PKCE 의 ?code= 가 해시 안에 갇혀 세션 교환이 실패하므로
// 해시 없는 베이스 경로로 복귀시킨다(코드가 실제 search 에 담김). 로그인 후
// AuthProvider 가 /mypage 로 이동시킨다.
export function redirectTo(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base}`;
}
