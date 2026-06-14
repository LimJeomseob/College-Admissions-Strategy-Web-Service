import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// /admin — 관리자 목록 조회·추가·삭제 (RequireAdmin 가드 + RLS 이중 보호).

interface AdminRow {
  id: string;
  email: string;
  role: string;
  user_id: string | null;
  created_at: string;
}

interface StudentRow {
  name: string | null;
  grade: string | null;
  contact: string | null;
  desired_major: string | null;
  track: string | null;
  consent_at: string | null;
  combo_averages: Record<string, number | null> | null;
  grades_updated_at: string | null;
}

// 평균 표시: 소수 둘째 자리, 값 없으면 '—'.
const fmtAvg = (v: number | null | undefined) =>
  typeof v === 'number' ? v.toFixed(2) : '—';

export function AdminPage() {
  useDocumentTitle('관리자 관리');
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);

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

  // 성적 입력 현황 — 관리자 SELECT 정책(RLS)으로 전체 프로필 조회.
  const loadStudents = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('name, grade, contact, desired_major, track, consent_at, combo_averages, grades_updated_at')
      .order('grades_updated_at', { ascending: false, nullsFirst: false });
    if (error) setError(error.message);
    else setStudents((data as StudentRow[]) ?? []);
    setStudentsLoading(false);
  };

  useEffect(() => {
    load();
    loadStudents();
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

      <h2 style={{ marginTop: '2.5rem' }}>성적 입력 현황</h2>
      <p className="subtitle muted">
        동의한 로그인 학생이 전략 도구에서 산출한 과목 평균 등급입니다. <small>※ 한국사는 사회 교과에 포함됩니다.</small>
      </p>

      {studentsLoading ? (
        <p>불러오는 중…</p>
      ) : students.length === 0 ? (
        <p className="muted">아직 저장된 학생 성적이 없습니다.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="result-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>학년</th>
                <th>희망학과</th>
                <th>계열</th>
                <th>연락처</th>
                <th>전과목</th>
                <th>국수영사과한</th>
                <th>국수영사</th>
                <th>국수영과</th>
                <th>동의</th>
                <th>최종 저장</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={i}>
                  <td>{s.name || '—'}</td>
                  <td>{s.grade || '—'}</td>
                  <td>{s.desired_major || '—'}</td>
                  <td>{s.track || '—'}</td>
                  <td>{s.contact || '—'}</td>
                  <td>{fmtAvg(s.combo_averages?.['전과목'])}</td>
                  <td>{fmtAvg(s.combo_averages?.['국수영사과'])}</td>
                  <td>{fmtAvg(s.combo_averages?.['국수영사'])}</td>
                  <td>{fmtAvg(s.combo_averages?.['국수영과'])}</td>
                  <td>{s.consent_at ? '✓' : '—'}</td>
                  <td>{s.grades_updated_at ? new Date(s.grades_updated_at).toLocaleDateString('ko-KR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
