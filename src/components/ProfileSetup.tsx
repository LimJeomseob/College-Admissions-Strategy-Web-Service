import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';
import { Button } from './ui/Button';

// Google 인증 후 최초 1회 프로필 완성(온보딩) — 학원명·원장 성함·연락처 수집.
// 이메일은 Google 계정에서 자동으로 채워지며, 저장 시 profiles에 반영한다.

export function ProfileSetup() {
  const { user, refreshProfile, signOut } = useAuth();
  const [academyName, setAcademyName] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = user?.email ?? '';
  const canSave = academyName.trim() && directorName.trim() && contact.trim() && !busy;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        academy_name: academyName.trim(),
        director_name: directorName.trim(),
        contact: contact.trim(),
        email: email || null,
      },
      { onConflict: 'id' },
    );
    setBusy(false);
    if (error) setError(error.message);
    else refreshProfile();
  };

  return (
    <main className="container auth-page">
      <h1>가입 정보 입력</h1>
      <p className="subtitle muted">서비스 이용을 위해 아래 정보를 입력해 주세요. (Google 계정으로 인증되었습니다)</p>

      <form className="auth-form" onSubmit={save}>
        <label>
          이메일
          <input value={email} readOnly disabled />
        </label>
        <label>
          학원명
          <input value={academyName} onChange={(e) => setAcademyName(e.target.value)} placeholder="예: 클럽하와이" autoComplete="organization" required />
        </label>
        <label>
          원장 성함
          <input value={directorName} onChange={(e) => setDirectorName(e.target.value)} placeholder="예: 홍길동" autoComplete="name" required />
        </label>
        <label>
          연락처
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="예: 010-1234-5678" autoComplete="tel" required />
        </label>
        {error && <p className="error">{error}</p>}
        <Button type="submit" disabled={!canSave}>{busy ? '저장 중…' : '입력 완료'}</Button>
      </form>

      <p className="auth-switch">
        다른 계정으로 로그인하시겠어요?{' '}
        <button type="button" className="linklike" onClick={() => void signOut()}>로그아웃</button>
      </p>
    </main>
  );
}
