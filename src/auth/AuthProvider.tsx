import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, redirectTo, hadOAuthRedirect } from './supabaseClient';

/** 마이페이지·식별·활성화용 프로필 요약 (REQ-60~63) */
export interface MyProfile {
  academy_name: string | null;
  director_name: string | null;
  name: string | null;
  active: boolean;
}

interface SignUpMeta {
  academyName?: string;
  directorName?: string;
}

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  profile: MyProfile | null;
  /** 로그인 사용자가 관리자에 의해 비활성화된 경우 true */
  blocked: boolean;
  refreshProfile: () => void;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    meta?: SignUpMeta,
  ) => Promise<{ error?: string; info?: string }>;
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
      .select('academy_name, director_name, name, active')
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
                active: data.active !== false,
              }
            : { academy_name: null, director_name: null, name: null, active: true },
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
      async signInWithEmail(email, password) {
        if (!supabase) return { error: 'Supabase 설정이 필요합니다.' };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? { error: error.message } : {};
      },
      async signUpWithEmail(email, password, meta) {
        if (!supabase) return { error: 'Supabase 설정이 필요합니다.' };
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo(),
            // 가입 시 학원명·원장 성함을 메타에 담아두고, 세션이 잡히면 프로필에 반영.
            data: { academy_name: meta?.academyName ?? null, director_name: meta?.directorName ?? null },
          },
        });
        if (error) return { error: error.message };
        // 즉시 세션이 있으면(이메일 확인 불필요 설정) 프로필에 학원 정보 upsert.
        if (data.session && (meta?.academyName || meta?.directorName)) {
          await supabase.from('profiles').upsert(
            {
              id: data.session.user.id,
              academy_name: meta?.academyName ?? null,
              director_name: meta?.directorName ?? null,
            },
            { onConflict: 'id' },
          );
        }
        if (!data.session) return { info: '확인 메일을 보냈습니다. 메일의 링크로 가입을 완료해 주세요.' };
        return {};
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
