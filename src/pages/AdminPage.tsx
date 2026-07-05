import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';
import { Button } from '../components/ui/Button';
import { AdminDbManager } from '../components/admin/AdminDbManager';
import { AdminUsageHistory } from '../components/admin/AdminUsageHistory';
import { STEP_DB_CONFIGS } from '../config/stepDbConfigs';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

type AdminTab = 'admins' | 'accounts' | 'students' | 'db' | 'usage';
const ADMIN_TABS: { id: AdminTab; label: string }[] = [
  { id: 'admins', label: '관리자 관리' },
  { id: 'accounts', label: '계정 관리' },
  { id: 'students', label: '성적 입력 현황' },
  { id: 'db', label: '단계별 DB 관리' },
  { id: 'usage', label: '사용 이력' },
];

// /admin — 관리자 목록 조회·추가·삭제 (RequireAdmin 가드 + RLS 이중 보호).

interface AdminRow {
  id: string;
  email: string;
  role: string;
  user_id: string | null;
  created_at: string;
}

interface StudentRow {
  id: string;
  academy_name: string | null;
  director_name: string | null;
  name: string | null;
  grade: string | null;
  contact: string | null;
  email: string | null;
  desired_major: string | null;
  track: string | null;
  consent_at: string | null;
  active: boolean | null;
  combo_averages: Record<string, number | null> | null;
  grades_updated_at: string | null;
  created_at: string | null;
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
  const [tab, setTab] = useState<AdminTab>('admins');

  // 계정 관리 인라인 편집
  const [editAccId, setEditAccId] = useState<string | null>(null);
  const [accDraft, setAccDraft] = useState<{ academy_name: string; director_name: string; contact: string; track: string }>({
    academy_name: '',
    director_name: '',
    contact: '',
    track: '',
  });

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
      .select('id, academy_name, director_name, name, grade, contact, email, desired_major, track, consent_at, active, combo_averages, grades_updated_at, created_at')
      .order('grades_updated_at', { ascending: false, nullsFirst: false });
    if (error) setError(error.message);
    else setStudents((data as StudentRow[]) ?? []);
    setStudentsLoading(false);
  };

  // REQ-63: 계정 활성/비활성 토글. active=false 계정은 전략 도구 사용이 차단된다.
  const toggleActive = async (row: StudentRow) => {
    if (!supabase) return;
    const next = !(row.active !== false);
    const { error } = await supabase.from('profiles').update({ active: next }).eq('id', row.id);
    if (error) setError(error.message);
    else setStudents((rs) => rs.map((r) => (r.id === row.id ? { ...r, active: next } : r)));
  };

  // 계정 관리 편집 — 학원명·원장·연락처·계열 인라인 수정.
  const startEditAcc = (row: StudentRow) => {
    setEditAccId(row.id);
    setAccDraft({
      academy_name: row.academy_name ?? '',
      director_name: row.director_name ?? '',
      contact: row.contact ?? '',
      track: row.track ?? '',
    });
  };
  const saveEditAcc = async () => {
    if (!supabase || !editAccId) return;
    const patch = {
      academy_name: accDraft.academy_name.trim() || null,
      director_name: accDraft.director_name.trim() || null,
      contact: accDraft.contact.trim() || null,
      track: accDraft.track || null,
    };
    const { error } = await supabase.from('profiles').update(patch).eq('id', editAccId);
    if (error) setError(error.message);
    else {
      setStudents((rs) => rs.map((r) => (r.id === editAccId ? { ...r, ...patch } : r)));
      setEditAccId(null);
    }
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
    <main className="container">
      <h1 className="admin-page-title">관리자</h1>

      <nav className="tabbar" role="tablist">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'db' && (
        <div className="admin-section">
          {STEP_DB_CONFIGS.map((c) => (
            <AdminDbManager key={c.id} config={c} />
          ))}
        </div>
      )}

      {tab === 'usage' && (
        <div className="admin-section">
          <AdminUsageHistory />
        </div>
      )}

      {tab === 'admins' && (
        <div className="admin-section">
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
        </div>
      )}

      {tab === 'accounts' && (
        <div className="admin-section">
      <p className="subtitle muted">전체 가입 계정입니다. 상태 버튼으로 계정을 활성/비활성할 수 있습니다. <small>비활성 계정은 전략 도구를 사용할 수 없습니다.</small></p>

      {error && <p className="error">{error}</p>}
      {studentsLoading ? (
        <p>불러오는 중…</p>
      ) : students.length === 0 ? (
        <p className="muted">아직 가입한 계정이 없습니다.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="result-table">
            <thead>
              <tr>
                <th>학원</th>
                <th>원장</th>
                <th>이메일</th>
                <th>연락처</th>
                <th>계열</th>
                <th>가입일</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const isActive = s.active !== false;
                if (editAccId === s.id) {
                  return (
                    <tr key={s.id} className="db-edit-row">
                      <td><input value={accDraft.academy_name} onChange={(e) => setAccDraft((d) => ({ ...d, academy_name: e.target.value }))} /></td>
                      <td><input value={accDraft.director_name} onChange={(e) => setAccDraft((d) => ({ ...d, director_name: e.target.value }))} /></td>
                      <td>{s.email || '—'}</td>
                      <td><input value={accDraft.contact} onChange={(e) => setAccDraft((d) => ({ ...d, contact: e.target.value }))} /></td>
                      <td>
                        <select value={accDraft.track} onChange={(e) => setAccDraft((d) => ({ ...d, track: e.target.value }))}>
                          <option value="">—</option>
                          <option value="인문">인문</option>
                          <option value="자연">자연</option>
                        </select>
                      </td>
                      <td>{s.created_at ? new Date(s.created_at).toLocaleDateString('ko-KR') : '—'}</td>
                      <td>{isActive ? '활성' : '비활성'}</td>
                      <td className="db-row-actions">
                        <button onClick={saveEditAcc}>저장</button>
                        <button onClick={() => setEditAccId(null)}>취소</button>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={s.id} className={isActive ? undefined : 'row-inactive'}>
                    <td>{s.academy_name || '—'}</td>
                    <td>{s.director_name || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td>{s.contact || '—'}</td>
                    <td>{s.track || '—'}</td>
                    <td>{s.created_at ? new Date(s.created_at).toLocaleDateString('ko-KR') : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className={`account-toggle${isActive ? ' on' : ' off'}`}
                        onClick={() => toggleActive(s)}
                      >
                        {isActive ? '활성' : '비활성'}
                      </button>
                    </td>
                    <td className="db-row-actions">
                      <button onClick={() => startEditAcc(s)}>수정</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </div>
      )}

      {tab === 'students' && (
        <div className="admin-section">
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
                <th>학원</th>
                <th>이름</th>
                <th>학년</th>
                <th>희망학과</th>
                <th>계열</th>
                <th>국수영사과한</th>
                <th>국수영사</th>
                <th>국수영과</th>
                <th>동의</th>
                <th>최종 저장</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.academy_name || '—'}</td>
                  <td>{s.name || '—'}</td>
                  <td>{s.grade || '—'}</td>
                  <td>{s.desired_major || '—'}</td>
                  <td>{s.track || '—'}</td>
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
        </div>
      )}
    </main>
  );
}
