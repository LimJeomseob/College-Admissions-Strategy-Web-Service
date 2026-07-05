import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import type { UsageEvent } from '../../types';

// 계정별 사용이력 — 프로필 선택 시 단계 진입·완료/분석 실행 횟수 요약 + 시간순 타임라인.

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
const EVENT_ORDER = ['analysis_run', 'step_enter', 'step_complete'];
const STEP_LABEL: Record<string, string> = {
  input: '1단계 성적 입력',
  convert: '2단계 성적 환산',
  strategy: '3단계 교과전형 전략',
  apply: '4단계 지원 가능 대학·학과',
  jonghap: '5단계 학생부종합전형 선택과목 추천',
  report: '6단계 최종 보고서',
};
const STEP_ORDER = ['input', 'convert', 'strategy', 'apply', 'jonghap', 'report'];

export function AdminUsageHistory() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [countByUser, setCountByUser] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [evLoading, setEvLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    // 프로필 목록 + 전체 사용 횟수(계정별) 집계 — usage_events.user_id 단일 컬럼만 조회.
    supabase
      .from('profiles')
      .select('id, name, grade, contact')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setAccounts((data as Account[]) ?? []);
        setLoading(false);
      });
    supabase
      .from('usage_events')
      .select('user_id')
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
      .select('event_type, step, meta, created_at')
      .eq('user_id', selected)
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setEvents((data as UsageEvent[]) ?? []);
        setEvLoading(false);
      });
  }, [selected]);

  // 선택 계정의 이벤트별·단계별 횟수 집계.
  const stats = useMemo(() => {
    const byEvent: Record<string, number> = {};
    const byStep: Record<string, number> = {};
    for (const e of events) {
      byEvent[e.event_type] = (byEvent[e.event_type] ?? 0) + 1;
      if (e.step) byStep[e.step] = (byStep[e.step] ?? 0) + 1;
    }
    return { total: events.length, byEvent, byStep };
  }, [events]);

  if (loading) return <p>불러오는 중…</p>;

  return (
    <section className="admin-usage">
      <h3>계정별 사용 이력</h3>
      <p className="subtitle muted">계정을 선택하면 단계 진입·완료와 분석 실행 <b>횟수</b>와 시간순 내역을 보여줍니다.</p>
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
                  <span>{a.name || '(이름 없음)'}{a.grade ? ` · ${a.grade}` : ''}</span>
                  <span className="usage-count-badge">{countByUser[a.id] ?? 0}</span>
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
            <>
              <div className="usage-summary">
                <div className="usage-summary-row">
                  <span className="usage-stat usage-stat-total">총 <b>{stats.total}</b>회</span>
                  {EVENT_ORDER.filter((k) => stats.byEvent[k]).map((k) => (
                    <span key={k} className="usage-stat">{EVENT_LABEL[k]} <b>{stats.byEvent[k]}</b></span>
                  ))}
                </div>
                <div className="usage-summary-row">
                  {STEP_ORDER.filter((s) => stats.byStep[s]).map((s) => (
                    <span key={s} className="usage-stat usage-stat-step">
                      {STEP_LABEL[s].replace(/ .*/, '')} <b>{stats.byStep[s]}</b>
                    </span>
                  ))}
                </div>
              </div>

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
            </>
          )}
        </div>
      </div>
    </section>
  );
}
