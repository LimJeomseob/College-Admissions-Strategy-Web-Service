import { useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import type { UsageEvent } from '../../types';

// 계정별 사용이력 — 프로필 선택 시 해당 계정의 단계 진입·완료/분석 실행 타임라인.

interface Account {
  id: string;
  name: string | null;
  grade: string | null;
  contact: string | null;
}

const EVENT_LABEL: Record<string, string> = {
  step_enter: '단계 진입',
  step_complete: '단계 완료',
  analysis_run: '분석 실행',
};
const STEP_LABEL: Record<string, string> = {
  input: '1단계 성적 입력',
  convert: '2단계 성적 환산',
  strategy: '3단계 교과전형 전략',
  apply: '4단계 지원 가능 대학·학과',
};

export function AdminUsageHistory() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [evLoading, setEvLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('profiles')
      .select('id, name, grade, contact')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setAccounts((data as Account[]) ?? []);
        setLoading(false);
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
      .select('event_type, step, meta, created_at')
      .eq('user_id', selected)
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setEvents((data as UsageEvent[]) ?? []);
        setEvLoading(false);
      });
  }, [selected]);

  if (loading) return <p>불러오는 중…</p>;

  return (
    <section className="admin-usage">
      <h3>계정별 사용 이력</h3>
      <p className="subtitle muted">계정을 선택하면 단계 진입·완료와 분석 실행 내역을 시간순으로 보여줍니다.</p>
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
                  onClick={() => setSelected(a.id)}
                >
                  {a.name || '(이름 없음)'}{a.grade ? ` · ${a.grade}` : ''}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="usage-timeline">
          {!selected ? (
            <p className="muted">왼쪽에서 계정을 선택하세요.</p>
          ) : evLoading ? (
            <p>불러오는 중…</p>
          ) : events.length === 0 ? (
            <p className="muted">기록된 사용 이력이 없습니다.</p>
          ) : (
            <table className="result-table">
              <thead>
                <tr><th>일시</th><th>이벤트</th><th>단계</th></tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i}>
                    <td>{new Date(e.created_at).toLocaleString('ko-KR')}</td>
                    <td>{EVENT_LABEL[e.event_type] ?? e.event_type}</td>
                    <td>{e.step ? STEP_LABEL[e.step] ?? e.step : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
