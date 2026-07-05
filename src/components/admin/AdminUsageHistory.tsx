import { useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import type { UsageEvent } from '../../types';

// 계정별 사용이력 — 분석 실행(성적 제출 → 2단계 진행) 1회를 사용 1회로 집계.
// 상세는 분석일시·관리(삭제) 표.

interface Account {
  id: string;
  academy_name: string | null;
  director_name: string | null;
  contact: string | null;
}

export function AdminUsageHistory() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [countByUser, setCountByUser] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [evLoading, setEvLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accEdit, setAccEdit] = useState(false);
  const [accDraft, setAccDraft] = useState({ academy_name: '', director_name: '', contact: '' });

  useEffect(() => {
    if (!supabase) return;
    // 프로필 목록 + 계정별 분석 횟수(analysis_run = 2단계 진행 1회) 집계.
    supabase
      .from('profiles')
      .select('id, academy_name, director_name, contact')
      .order('academy_name', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setAccounts((data as Account[]) ?? []);
        setLoading(false);
      });
    supabase
      .from('usage_events')
      .select('user_id')
      .eq('event_type', 'analysis_run')
      .then(({ data }) => {
        const c: Record<string, number> = {};
        for (const r of (data as { user_id: string }[]) ?? []) c[r.user_id] = (c[r.user_id] ?? 0) + 1;
        setCountByUser(c);
      });
  }, []);

  useEffect(() => {
    if (!supabase || !selected) {
      setEvents([]);
      return;
    }
    setEvLoading(true);
    supabase
      .from('usage_events')
      .select('id, event_type, step, meta, created_at')
      .eq('user_id', selected)
      .eq('event_type', 'analysis_run')
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setEvents((data as UsageEvent[]) ?? []);
        setEvLoading(false);
      });
  }, [selected]);

  // 개별 사용 이력 삭제 (관리자 delete 정책).
  const deleteEvent = async (id?: number) => {
    if (!supabase || id == null) return;
    const { error } = await supabase.from('usage_events').delete().eq('id', id);
    if (error) return setError(error.message);
    setEvents((es) => es.filter((e) => e.id !== id));
    if (selected) setCountByUser((c) => ({ ...c, [selected]: Math.max(0, (c[selected] ?? 1) - 1) }));
  };

  // 선택 계정 정보(학원명·원장·연락처) 편집 시작·저장.
  const startAccEdit = (a: Account) => {
    setAccDraft({
      academy_name: a.academy_name ?? '',
      director_name: a.director_name ?? '',
      contact: a.contact ?? '',
    });
    setAccEdit(true);
  };
  const saveAccEdit = async () => {
    if (!supabase || !selected) return;
    const patch = {
      academy_name: accDraft.academy_name.trim() || null,
      director_name: accDraft.director_name.trim() || null,
      contact: accDraft.contact.trim() || null,
    };
    const { error } = await supabase.from('profiles').update(patch).eq('id', selected);
    if (error) return setError(error.message);
    setAccounts((as) => as.map((a) => (a.id === selected ? { ...a, ...patch } : a)));
    setAccEdit(false);
  };

  // 선택 계정의 사용 이력 전체 삭제(초기화).
  const clearAll = async () => {
    if (!supabase || !selected) return;
    if (!window.confirm('이 계정의 사용 이력을 모두 삭제할까요? 되돌릴 수 없습니다.')) return;
    const { error } = await supabase.from('usage_events').delete().eq('user_id', selected);
    if (error) return setError(error.message);
    setEvents([]);
    setCountByUser((c) => ({ ...c, [selected]: 0 }));
  };

  if (loading) return <p>불러오는 중…</p>;

  const selectedAccount = accounts.find((a) => a.id === selected) ?? null;

  return (
    <section className="admin-usage">
      <h3>계정별 사용 이력</h3>
      <p className="subtitle muted">사용 횟수는 <b>분석 실행(2단계 진행)</b> 기준 1회로 집계합니다. 계정을 선택하면 분석일시 내역을 보여줍니다.</p>
      {error && <p className="error">{error}</p>}

      <div className="usage-layout">
        <ul className="usage-accounts">
          {accounts.length === 0 ? (
            <li className="muted">가입 계정이 없습니다.</li>
          ) : (
            accounts.map((a) => (
              <li key={a.id}>
                <button
                  className={`usage-account${selected === a.id ? ' active' : ''}`}
                  onClick={() => { setSelected(a.id); setAccEdit(false); }}
                >
                  <span>{a.academy_name || '(학원 미입력)'}{a.director_name ? ` · ${a.director_name} 원장` : ''}</span>
                  <span className="usage-count-badge">{countByUser[a.id] ?? 0}</span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="usage-timeline">
          {!selected ? (
            <p className="muted">왼쪽에서 계정을 선택하세요.</p>
          ) : (
            <>
              {selectedAccount && (
                <div className="usage-acc-panel">
                  {accEdit ? (
                    <div className="usage-acc-form">
                      <input placeholder="학원명" value={accDraft.academy_name} onChange={(e) => setAccDraft((d) => ({ ...d, academy_name: e.target.value }))} />
                      <input placeholder="원장 성함" value={accDraft.director_name} onChange={(e) => setAccDraft((d) => ({ ...d, director_name: e.target.value }))} />
                      <input placeholder="연락처" value={accDraft.contact} onChange={(e) => setAccDraft((d) => ({ ...d, contact: e.target.value }))} />
                      <button onClick={saveAccEdit}>저장</button>
                      <button onClick={() => setAccEdit(false)}>취소</button>
                    </div>
                  ) : (
                    <div className="usage-acc-view">
                      <b>{selectedAccount.academy_name || '(학원 미입력)'}</b>
                      {selectedAccount.director_name ? ` · ${selectedAccount.director_name} 원장` : ''}
                      {selectedAccount.contact ? ` · ${selectedAccount.contact}` : ''}
                      <button type="button" className="usage-acc-editbtn" onClick={() => startAccEdit(selectedAccount)}>계정 정보 수정</button>
                    </div>
                  )}
                </div>
              )}

              {evLoading ? (
                <p>불러오는 중…</p>
              ) : events.length === 0 ? (
                <p className="muted">분석 실행 내역이 없습니다.</p>
              ) : (
                <>
              <div className="usage-summary">
                <div className="usage-summary-row">
                  <span className="usage-stat usage-stat-total">분석 <b>{events.length}</b>회</span>
                  <button type="button" className="usage-clear-btn" onClick={clearAll}>전체 삭제</button>
                </div>
              </div>

              <table className="result-table">
                <thead>
                  <tr><th>분석일시</th><th>관리</th></tr>
                </thead>
                <tbody>
                  {events.map((e, i) => (
                    <tr key={e.id ?? i}>
                      <td>{new Date(e.created_at).toLocaleString('ko-KR')}</td>
                      <td className="db-row-actions"><button className="btn-danger" onClick={() => deleteEvent(e.id)}>삭제</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
