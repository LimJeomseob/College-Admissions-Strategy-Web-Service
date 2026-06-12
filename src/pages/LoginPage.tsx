import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui/Button';

// /login — 구글 로그인 + 이메일 회원가입/로그인.
export function LoginPage() {
  const { user, configured, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/mypage" replace />;

  if (!configured) {
    return (
      <main className="container">
        <h1>로그인</h1>
        <p className="warn">인증 설정(Supabase)이 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.</p>
      </main>
    );
  }

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const res: { error?: string; info?: string } =
      mode === 'login'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);
    setBusy(false);
    if (res.error) setError(res.error);
    else if (res.info) setInfo(res.info);
  };

  return (
    <main className="container auth-page">
      <h1>{mode === 'login' ? '로그인' : '회원가입'}</h1>

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

      <div className="auth-divider">또는 이메일</div>

      <form className="auth-form" onSubmit={submitEmail}>
        <label>
          이메일
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {error && <p className="error">{error}</p>}
        {info && <p className="upload-info">{info}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? '처리 중…' : mode === 'login' ? '로그인' : '가입하기'}
        </Button>
      </form>

      <p className="auth-switch">
        {mode === 'login' ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
        <button
          type="button"
          className="linklike"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
            setInfo(null);
          }}
        >
          {mode === 'login' ? '회원가입' : '로그인'}
        </button>
      </p>
    </main>
  );
}
