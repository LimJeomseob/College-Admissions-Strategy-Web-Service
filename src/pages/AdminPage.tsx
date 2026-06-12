import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';
import { Button } from '../components/ui/Button';

// /admin — 관리자 목록 조회·추가·삭제 (RequireAdmin 가드 + RLS 이중 보호).

interface AdminRow {
  id: string;
  email: string;
  role: string;
  user_id: string | null;
  created_at: string;
}

export function AdminPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('admins')
      .select('id, email, role, user_id, created_at')
      .order('created_at', { ascending: true });
    if (error) setError(error.message);
    else setAdmins((data as AdminRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supabase) return;
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    const { error } = await supabase.from('admins').insert({ email, role: 'admin' });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setNewEmail('');
      await load();
    }
  };

  const remove = async (row: AdminRow) => {
    setError(null);
    if (!supabase) return;
    if (row.role === 'owner') {
      setError('최초 관리자(owner)는 삭제할 수 없습니다.');
      return;
    }
    if (!window.confirm(`${row.email} 관리자를 삭제할까요?`)) return;
    const { error } = await supabase.from('admins').delete().eq('id', row.id);
    if (error) setError(error.message);
    else await load();
  };

  return (
    <main className="container auth-page">
      <h1>관리자 관리</h1>
      <p className="subtitle muted">관리자 계정을 추가·삭제합니다. 등록된 이메일로 로그인하면 관리자 권한이 부여됩니다.</p>

      <form className="admin-add" onSubmit={add}>
        <input
          type="email"
          placeholder="추가할 관리자 이메일"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
        />
        <Button type="submit" disabled={busy}>{busy ? '추가 중…' : '관리자 추가'}</Button>
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>불러오는 중…</p>
      ) : (
        <table className="result-table">
          <thead>
            <tr><th>이메일</th><th>역할</th><th>연결됨</th><th></th></tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.email}{a.user_id === user?.id && <small className="muted"> (나)</small>}</td>
                <td>{a.role}</td>
                <td>{a.user_id ? '✓' : '미가입'}</td>
                <td>
                  {a.role !== 'owner' && (
                    <button onClick={() => remove(a)}>삭제</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
