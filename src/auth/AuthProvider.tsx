import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, redirectTo, hadOAuthRedirect } from './supabaseClient';

/** 마이페이지·식별·활성화용 프로필 요약 (REQ-60~63) */
export interface MyProfile {
  academy_name: string | null;
  director_name: string | null;
  name: string | null;
  contact: string | null;
  email: string | null;
  active: boolean;
}

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  profile: MyProfile | null;
  /** 필수 프로필(학원명·원장·연락처) 입력 완료 여부 — 미완료면 온보딩 */
  profileComplete: boolean;
  /** 로그인 사용자가 관리자에 의해 비활성화된 경우 true */
  blocked: boolean;
  refreshProfile: () => void;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [profileNonce, setProfileNonce] = useState(0);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      // OAuth/이메일 확인 복귀 후 세션이 잡히면 전략 도구로 이동(해시 없는 홈에 떨어지므로).
      if (data.session && hadOAuthRedirect) {
        window.location.hash = '#/tool';
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 로그인 사용자의 관리자 여부 확인 (RLS 안전한 SECURITY DEFINER 함수)
  useEffect(() => {
    if (!supabase || !session) {
      setIsAdmin(false);
      return;
    }
    let active = true;
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (active) setIsAdmin(!error && data === true);
    });
    return () => {
      active = false;
    };
  }, [session]);

  // 프로필 요약(활성 여부·학원명·원장) 로드 — 마이페이지/식별/차단용.
  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null);
      return;
    }
    let active = true;
    supabase
      .from('profiles')
      .select('academy_name, director_name, name, contact, email, active')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        // 프로필 행이 없으면(신규) 활성으로 간주.
        setProfile(
          data
            ? {
                academy_name: data.academy_name ?? null,
                director_name: data.director_name ?? null,
                name: data.name ?? null,
                contact: data.contact ?? null,
                email: data.email ?? null,
                active: data.active !== false,
              }
            : { academy_name: null, director_name: null, name: null, contact: null, email: null, active: true },
        );
      });
    return () => {
      active = false;
    };
  }, [session, profileNonce]);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    return {
      configured: isSupabaseConfigured,
      loading,
      session,
      user,
      isAdmin,
      profile,
      profileComplete: Boolean(
        profile && profile.academy_name && profile.director_name && profile.contact,
      ),
      blocked: Boolean(user && profile && profile.active === false),
      refreshProfile: () => setProfileNonce((n) => n + 1),
      async signInWithGoogle() {
        if (!supabase) return { error: 'Supabase 설정이 필요합니다.' };
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: redirectTo() },
        });
        return error ? { error: error.message } : {};
      },
      async signOut() {
        if (supabase) await supabase.auth.signOut();
      },
    };
  }, [session, isAdmin, loading, profile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
