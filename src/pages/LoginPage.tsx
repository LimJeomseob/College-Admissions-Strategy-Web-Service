import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// /login — Google 계정 전용 로그인·가입. 최초 가입 후 학원명·원장·연락처는 온보딩에서 수집.
export function LoginPage() {
  const { user, configured, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle('로그인');

  if (user) return <Navigate to="/tool" replace />;

  if (!configured) {
    return (
      <main className="container">
        <h1>로그인</h1>
        <p className="warn">인증 설정(Supabase)이 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.</p>
      </main>
    );
  }

  return (
    <main className="container auth-page">
      <h1>로그인 · 회원가입</h1>
      <p className="subtitle muted">Google 계정으로 로그인하거나 가입합니다. 최초 가입 시 학원명·원장 성함·연락처를 입력합니다.</p>

      <Button
        variant="secondary"
        className="google-btn"
        onClick={async () => {
          setError(null);
          const res = await signInWithGoogle();
          if (res.error) setError(res.error);
        }}
      >
        <span aria-hidden>🔵</span> Google 계정으로 계속하기
      </Button>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
