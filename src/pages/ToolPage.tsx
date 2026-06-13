import { useEffect, useMemo, useState } from 'react';
import { DISCLAIMER } from '../config';
import { loadDataLayer } from '../data/loadDataLayer';
import {
  annotateByMajor,
  buildSubjectStrategies,
  computeComboAverages,
  convert,
  match,
  triage,
} from '../engine';
import { lookupMajor } from '../data/majorFamilies';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';
import { GradeInputForm } from '../components/GradeInputForm';
import { DesiredMajorInput } from '../components/DesiredMajorInput';
import { ConversionPanel } from '../components/ConversionPanel';
import { ResultList } from '../components/ResultList';
import { StrategyCards } from '../components/StrategyCards';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { DataLayer, SubjectInput, Track } from '../types';

// 전략 도구 페이지 — 기존 App 본문을 라우팅 도입에 맞춰 분리.
// 입력→환산→매칭→전략 파이프라인은 그대로 유지(엔진 비변경).
export function ToolPage() {
  useDocumentTitle('전략 도구');
  const [data, setData] = useState<DataLayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectInput[]>([]);
  const [track, setTrack] = useState<Track>('인문');
  const [desiredMajor, setDesiredMajor] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // 로그인+동의 사용자만 성적 평균을 관리자 상담용으로 저장(동의 없으면 안내만).
  const [consented, setConsented] = useState<boolean | null>(null);

  const { user } = useAuth();

  useEffect(() => {
    loadDataLayer().then(setData).catch((e) => setError(String(e)));
  }, []);

  // 로그인 사용자는 저장된 프로필의 희망학과를 도구에 자동 연동(Phase B).
  useEffect(() => {
    if (!supabase || !user) {
      setConsented(null);
      return;
    }
    let active = true;
    supabase
      .from('profiles')
      .select('desired_major, track, consent_at')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (!data) {
          setConsented(false);
          return;
        }
        if (data.desired_major) setDesiredMajor(data.desired_major);
        if (data.track === '인문' || data.track === '자연') setTrack(data.track);
        setConsented(Boolean(data.consent_at));
      });
    return () => {
      active = false;
    };
  }, [user]);

  // 희망학과 변경 시, 매핑된 계열을 계열 라디오 기본값으로 동기화(사용자 재선택 가능).
  const handleMajorChange = (v: string) => {
    setDesiredMajor(v);
    const lk = lookupMajor(v);
    if (lk.track) setTrack(lk.track);
  };

  const result = useMemo(() => {
    if (!data || !submitted) return null;
    const averages = computeComboAverages(subjects);
    const refAvg = averages['전과목'] ?? averages['국수영사과'];
    if (refAvg == null) return null;

    const conv = convert(data.conversion, refAvg);
    const triageResult = triage(conv.est9);
    const rawMatch = match(data.admissions, data.conversion, averages, { track });
    // 희망학과 기반 우선정렬·배지 (행 제거 없음, 세션 한정·미저장)
    const matchOutput = annotateByMajor(rawMatch, lookupMajor(desiredMajor));
    const strategies = buildSubjectStrategies(
      matchOutput.matched,
      data.subjectTrack,
      averages,
    );
    return { averages, conv, triageResult, matchOutput, strategies };
  }, [data, submitted, subjects, track, desiredMajor]);

  // 로그인+동의 사용자의 조합 평균을 본인 프로필에 저장(관리자 상담/현황용).
  // 원점수는 저장하지 않고 4개 조합 평균만 저장. 미동의 시 저장 생략.
  useEffect(() => {
    if (!supabase || !user || !consented || !result) return;
    const lk = lookupMajor(desiredMajor);
    supabase
      .from('profiles')
      .update({
        combo_averages: result.averages,
        grades_updated_at: new Date().toISOString(),
        desired_major: desiredMajor || null,
        desired_families: lk.families,
        track,
      })
      .eq('id', user.id)
      .then(() => undefined);
  }, [result, user, consented, desiredMajor, track]);

  if (error) return <main className="container"><p className="error">로드 오류: {error}</p></main>;
  if (!data) return <main className="container"><p>데이터 로딩 중…</p></main>;

  return (
    <main className="container">
      <header>
        <h1>5등급제 → 9등급 입결 기반 대입 전략</h1>
        <p className="subtitle">
          성적 입력 한 번으로 지원 가능 대학·학과와 교과전형 준비전략을 안내합니다.
          {data.meta.source === 'mock' && <span className="badge">샘플 데이터</span>}
        </p>
      </header>

      <GradeInputForm
        track={track}
        onTrackChange={setTrack}
        onSubmit={(rows) => {
          setSubjects(rows);
          setSubmitted(true);
        }}
      />

      <DesiredMajorInput value={desiredMajor} onChange={handleMajorChange} />

      {result && (
        <section className="results">
          <ConversionPanel averages={result.averages} conv={result.conv} triage={result.triageResult} />
          <StrategyCards cards={result.strategies} subjectOnly={result.triageResult.subjectOnly} />
          <ResultList output={result.matchOutput} subjectOnly={result.triageResult.subjectOnly} />
          {user && consented === false && (
            <p className="upload-info">
              마이페이지에서 개인정보 수집·이용에 동의하면, 입력한 성적 평균이 상담용으로 저장됩니다.
            </p>
          )}
          <p className="disclaimer">{DISCLAIMER}</p>
        </section>
      )}
    </main>
  );
}
