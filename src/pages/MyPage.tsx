import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';
import { lookupMajor, MAJOR_FAMILIES } from '../data/majorFamilies';
import { Button } from '../components/ui/Button';
import type { Track } from '../types';

// /mypage — 최초 개인정보·희망학과 입력/수정. 동의 없으면 저장 차단.
// 개인정보 최소수집(미성년자 다수 고려): 이름·학년·희망학과·계열 + 선택 연락처.

interface ProfileForm {
  name: string;
  grade: string;
  contact: string;
  desired_major: string;
  track: Track | '';
}

const EMPTY: ProfileForm = { name: '', grade: '고3', contact: '', desired_major: '', track: '' };
const GRADES = ['고1', '고2', '고3', 'N수'];
const MAJORS = Object.keys(MAJOR_FAMILIES);

export function MyPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [consentedAt, setConsentedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from('profiles')
      .select('name, grade, contact, desired_major, track, consent_at')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else if (data) {
          setForm({
            name: data.name ?? '',
            grade: data.grade ?? '고3',
            contact: data.contact ?? '',
            desired_major: data.desired_major ?? '',
            track: (data.track as Track) ?? '',
          });
          setConsentedAt(data.consent_at ?? null);
          setConsent(Boolean(data.consent_at));
        }
        setLoading(false);
      });
  }, [user]);

  const patch = (p: Partial<ProfileForm>) => setForm((f) => ({ ...f, ...p }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    if (!consent) {
      setError('개인정보 수집·이용에 동의해야 저장할 수 있습니다.');
      return;
    }
    if (!supabase || !user) return;
    setSaving(true);

    const lk = lookupMajor(form.desired_major);
    const track = form.track || lk.track || null;
    const consent_at = consentedAt ?? new Date().toISOString();

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: form.name || null,
      grade: form.grade || null,
      contact: form.contact || null,
      desired_major: form.desired_major || null,
      desired_families: lk.families,
      track,
      consent_at,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      setConsentedAt(consent_at);
      setSavedMsg('저장되었습니다. 희망학과는 전략 도구에 자동 반영됩니다.');
    }
  };

  if (loading) return <main className="container"><p>불러오는 중…</p></main>;

  return (
    <main className="container auth-page">
      <h1>마이페이지</h1>
      <p className="subtitle muted">{user?.email}</p>

      <form className="auth-form" onSubmit={save}>
        <label>
          이름
          <input value={form.name} onChange={(e) => patch({ name: e.target.value })} />
        </label>
        <label>
          학년
          <select value={form.grade} onChange={(e) => patch({ grade: e.target.value })}>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label>
          연락처 <small className="muted">(선택)</small>
          <input value={form.contact} onChange={(e) => patch({ contact: e.target.value })} placeholder="선택 입력" />
        </label>
        <label>
          희망학과
          <input
            list="mypage-majors"
            value={form.desired_major}
            onChange={(e) => {
              const v = e.target.value;
              const lk = lookupMajor(v);
              patch({ desired_major: v, track: form.track || (lk.track ?? '') });
            }}
            placeholder="예: 컴퓨터공학과"
          />
          <datalist id="mypage-majors">
            {MAJORS.map((m) => <option key={m} value={m} />)}
          </datalist>
        </label>
        <label>
          계열
          <select value={form.track} onChange={(e) => patch({ track: e.target.value as Track | '' })}>
            <option value="">선택 안 함</option>
            <option value="인문">인문</option>
            <option value="자연">자연</option>
          </select>
        </label>

        <div className="consent-box">
          <label className="consent-line">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>개인정보 수집·이용에 동의합니다. {consentedAt && <small className="muted">(동의일: {new Date(consentedAt).toLocaleDateString('ko-KR')})</small>}</span>
          </label>
          <details className="privacy-notice">
            <summary>개인정보 처리방침 고지</summary>
            <ul>
              <li><b>수집 항목</b>: 이름, 학년, 희망학과·계열, (선택) 연락처</li>
              <li><b>이용 목적</b>: 대입 전략 결과 개인화 및 마이페이지 제공</li>
              <li><b>보관·파기</b>: 회원 탈퇴 또는 삭제 요청 시 즉시 파기</li>
              <li><b>최소수집</b>: 미성년자 이용을 고려해 필요한 최소 정보만 수집하며, 성적은 저장하지 않고 세션에서만 사용합니다.</li>
              <li>동의는 자유이며, 미동의 시 마이페이지 저장 기능만 제한됩니다.</li>
            </ul>
          </details>
        </div>

        {error && <p className="error">{error}</p>}
        {savedMsg && <p className="upload-info">{savedMsg}</p>}
        <Button type="submit" disabled={saving}>{saving ? '저장 중…' : '저장'}</Button>
      </form>
    </main>
  );
}
