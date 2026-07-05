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

// 비활성화된 계정 차단(REQ-63). 게스트(비로그인)는 통과, 관리자에 의해 active=false로
// 전환된 로그인 사용자만 안내 화면을 보여준다.
export function RequireActive({ children }: { children: ReactNode }) {
  const { loading, blocked } = useAuth();
  if (loading) return <main className="container"><p>확인 중…</p></main>;
  if (blocked) return <AccountBlocked />;
  return <>{children}</>;
}

function AccountBlocked() {
  const { signOut } = useAuth();
  return (
    <main className="container">
      <div className="panel">
        <h2>이용이 일시 중지된 계정입니다</h2>
        <p className="muted">
          이 계정은 현재 비활성화되어 전략 도구를 이용할 수 없습니다. 학원 관리자에게 문의해 주세요.
        </p>
        <button type="button" className="secondary" onClick={() => void signOut()}>로그아웃</button>
      </div>
    </main>
  );
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
