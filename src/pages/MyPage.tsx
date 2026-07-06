import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';
import { Button } from '../components/ui/Button';
import { ReportContent } from '../components/ReportContent';
import { listReports, deleteReport, downloadReportMd, type SavedReport } from '../data/reports';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { Track } from '../types';

// /mypage — 내 정보(학원명·원장·희망학과·계열)·개인정보 동의·성적 이력·저장 보고서 (REQ-60~62).

interface ProfileForm {
  academy_name: string;
  director_name: string;
  name: string;
  grade: string;
  contact: string;
  desired_major: string;
  track: Track | '';
  consent: boolean;
}

const EMPTY: ProfileForm = {
  academy_name: '',
  director_name: '',
  name: '',
  grade: '',
  contact: '',
  desired_major: '',
  track: '',
  consent: false,
};

const fmtAvg = (v: number | null | undefined) => (typeof v === 'number' ? v.toFixed(2) : '—');
const COMBO_KEYS = ['국수영사과', '국수영사', '국수영과'] as const;

export function MyPage() {
  useDocumentTitle('마이페이지');
  const { user, refreshProfile } = useAuth();
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [averages, setAverages] = useState<Record<string, number | null> | null>(null);
  const [gradesAt, setGradesAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reports, setReports] = useState<SavedReport[]>([]);
  const [openReport, setOpenReport] = useState<number | null>(null);

  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;
    (async () => {
      const { data } = await supabase!
        .from('profiles')
        .select('academy_name, director_name, name, grade, contact, desired_major, track, consent_at, combo_averages, grades_updated_at')
        .eq('id', user.id)
        .maybeSingle();
      if (!active) return;
      if (data) {
        setForm({
          academy_name: data.academy_name ?? '',
          director_name: data.director_name ?? '',
          name: data.name ?? '',
          grade: data.grade ?? '',
          contact: data.contact ?? '',
          desired_major: data.desired_major ?? '',
          track: data.track === '인문' || data.track === '자연' ? data.track : '',
          consent: Boolean(data.consent_at),
        });
        setAverages(data.combo_averages ?? null);
        setGradesAt(data.grades_updated_at ?? null);
      }
      setLoading(false);
      try {
        setReports(await listReports());
      } catch {
        /* noop */
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const set = (patch: Partial<ProfileForm>) => setForm((f) => ({ ...f, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: user.email ?? null,
        academy_name: form.academy_name.trim() || null,
        director_name: form.director_name.trim() || null,
        name: form.name.trim() || null,
        grade: form.grade.trim() || null,
        contact: form.contact.trim() || null,
        desired_major: form.desired_major.trim() || null,
        track: form.track || null,
        consent_at: form.consent ? new Date().toISOString() : null,
      },
      { onConflict: 'id' },
    );
    setSaving(false);
    if (error) setError(error.message);
    else {
      setMsg('저장되었습니다.');
      refreshProfile();
    }
  };

  const removeReport = async (id: number) => {
    if (!window.confirm('이 보고서를 삭제할까요?')) return;
    try {
      await deleteReport(id);
      setReports((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!user) return null;

  return (
    <main className="container">
      <h1>마이페이지</h1>

      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <>
          <form className="panel mypage-form" onSubmit={save}>
            <h2>내 정보</h2>
            <p className="subtitle muted">학원명·원장 성함으로 계정을 식별합니다. 희망학과·계열은 전략 도구에 반영됩니다.</p>

            <div className="mypage-grid">
              <label>
                이메일
                <input value={user.email ?? ''} readOnly disabled />
              </label>
              <label>
                학원명
                <input value={form.academy_name} onChange={(e) => set({ academy_name: e.target.value })} placeholder="예: 클럽하와이" />
              </label>
              <label>
                원장 성함
                <input value={form.director_name} onChange={(e) => set({ director_name: e.target.value })} placeholder="예: 홍길동" />
              </label>
              <label>
                이름(학생)
                <input value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label>
                학년
                <input value={form.grade} onChange={(e) => set({ grade: e.target.value })} placeholder="예: 고2" />
              </label>
              <label>
                희망학과
                <input value={form.desired_major} onChange={(e) => set({ desired_major: e.target.value })} />
              </label>
              <label>
                연락처
                <input value={form.contact} onChange={(e) => set({ contact: e.target.value })} />
              </label>
            </div>

            <div className="track-select">
              계열:
              {(['인문', '자연'] as Track[]).map((t) => (
                <label key={t}>
                  <input type="radio" checked={form.track === t} onChange={() => set({ track: t })} /> {t}
                </label>
              ))}
            </div>

            <label className="consent-line">
              <input type="checkbox" checked={form.consent} onChange={(e) => set({ consent: e.target.checked })} />{' '}
              개인정보 수집·이용에 동의합니다. (성적 평균이 상담용으로 저장됩니다)
            </label>

            {error && <p className="error">{error}</p>}
            {msg && <p className="upload-info">{msg}</p>}
            <div className="form-actions">
              <Button type="submit" disabled={saving}>{saving ? '저장 중…' : '저장'}</Button>
            </div>
          </form>

          <div className="panel">
            <h2>성적 이력</h2>
            {averages && Object.keys(averages).length > 0 ? (
              <>
                <p className="subtitle muted">
                  최근 저장: {gradesAt ? new Date(gradesAt).toLocaleString('ko-KR') : '—'} · 5등급 조합 평균
                </p>
                <div className="avg-grid">
                  {COMBO_KEYS.map((k) => (
                    <div key={k} className="avg-cell">
                      <span className="avg-label">{k}</span>
                      <span className="avg-value">{fmtAvg(averages[k])}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">전략 도구에서 성적을 분석하면 여기에 이력이 저장됩니다.</p>
            )}
          </div>

          <div className="panel">
            <h2>저장된 보고서</h2>
            <p className="subtitle muted">
              ‘내 정보’에 학생 정보를 입력·저장한 뒤 6단계에서 보고서를 저장하면 학생별로 보관됩니다.
            </p>
            {reports.length === 0 ? (
              <p className="muted">6단계 최종 보고서에서 ‘마이페이지에 저장’을 누르면 여기에 보관됩니다.</p>
            ) : (
              <ul className="report-list">
                {reports.map((r) => {
                  const st = r.data?.student;
                  return (
                  <li key={r.id} className="report-list-item">
                    <div className="report-list-head">
                      <button type="button" className="linklike" onClick={() => setOpenReport(openReport === r.id ? null : r.id)}>
                        {openReport === r.id ? '▾' : '▸'} {r.title || '대입 전략 보고서'}
                      </button>
                      <span className="muted">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                      <button type="button" className="secondary sm" onClick={() => downloadReportMd(r.data)}>⬇ 다운로드</button>
                      <button type="button" className="secondary sm" onClick={() => removeReport(r.id)}>삭제</button>
                    </div>
                    {st && (st.name || st.grade || st.desiredMajor || st.contact) && (
                      <p className="report-list-student muted">
                        👤 {st.name || '—'}{st.grade ? ` · ${st.grade}` : ''}{st.desiredMajor ? ` · ${st.desiredMajor}` : ''}{st.contact ? ` · ${st.contact}` : ''}
                      </p>
                    )}
                    {openReport === r.id && r.data?.report && <ReportContent report={r.data.report} gyo={r.data.gyo} />}
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </main>
  );
}
