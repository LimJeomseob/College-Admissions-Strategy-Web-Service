import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

// 라우트 가드 — 인증/관리자 권한이 없으면 적절한 경로로 보낸다.
// (RLS가 1차 방어선이고, 가드는 UX/오접근 차단용 2차선)

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <main className="container"><p>확인 중…</p></main>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, user, isAdmin } = useAuth();
  if (loading) return <main className="container"><p>확인 중…</p></main>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <main className="container">
        <p className="error">관리자만 접근할 수 있는 페이지입니다.</p>
      </main>
    );
  }
  return <>{children}</>;
}
