import { useEffect, useMemo, useState } from 'react';
import { DISCLAIMER } from '../config';
import { loadDataLayer } from '../data/loadDataLayer';
import { loadDeptAdmissions } from '../data/loadDeptAdmissions';
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
import { DeptResultTable } from '../components/DeptResultTable';
import { StrategyCards } from '../components/StrategyCards';
import { UniversityDetailModal } from '../components/UniversityDetailModal';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { DataLayer, DeptRow, SubjectInput, Track } from '../types';

type TabId = 'input' | 'convert' | 'strategy' | 'apply';
const TABS: { id: TabId; label: string }[] = [
  { id: 'input', label: '① 성적 입력' },
  { id: 'convert', label: '② 성적 체계 환산' },
  { id: 'strategy', label: '③ 교과전형 준비전략' },
  { id: 'apply', label: '④ 지원 가능 대학·학과' },
];

// 전략 도구 — 단계별 탭 구성. ③에서 대학을 선택하면 ④ 표가 만들어진다.
export function ToolPage() {
  useDocumentTitle('전략 도구');
  const [data, setData] = useState<DataLayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectInput[]>([]);
  const [track, setTrack] = useState<Track>('인문');
  const [desiredMajor, setDesiredMajor] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [consented, setConsented] = useState<boolean | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('input');
  const [selectedUnivs, setSelectedUnivs] = useState<string[]>([]);
  const [detailUniv, setDetailUniv] = useState<string | null>(null);
  const [deptMap, setDeptMap] = useState<Record<string, DeptRow[]>>({});
  const [deptLoading, setDeptLoading] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    loadDataLayer().then(setData).catch((e) => setError(String(e)));
  }, []);

  // 로그인 사용자: 저장된 희망학과/계열/동의 연동.
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
    const matchOutput = annotateByMajor(rawMatch, lookupMajor(desiredMajor));
    const strategies = buildSubjectStrategies(matchOutput.matched, data.subjectTrack, averages);
    return { averages, conv, triageResult, matchOutput, strategies };
  }, [data, submitted, subjects, track, desiredMajor]);

  // 결과가 생기면 학과 입결 DB를 lazy 로드(④ 표용).
  useEffect(() => {
    if (!result || deptLoading || Object.keys(deptMap).length > 0) return;
    setDeptLoading(true);
    loadDeptAdmissions()
      .then(setDeptMap)
      .finally(() => setDeptLoading(false));
  }, [result]);

  // 로그인+동의 사용자의 조합 평균 저장(관리자 상담/현황용).
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

  const toggleUniv = (univ: string) =>
    setSelectedUnivs((prev) => (prev.includes(univ) ? prev.filter((u) => u !== univ) : [...prev, univ]));

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

      <nav className="tabbar" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            className={`tab${activeTab === t.id ? ' active' : ''}`}
            disabled={t.id !== 'input' && !result}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === 'input' && (
        <section>
          <GradeInputForm
            track={track}
            onTrackChange={setTrack}
            onSubmit={(rows) => {
              setSubjects(rows);
              setSubmitted(true);
              setActiveTab('convert');
            }}
          />
          <DesiredMajorInput value={desiredMajor} onChange={handleMajorChange} />
        </section>
      )}

      {activeTab === 'convert' &&
        (result ? (
          <ConversionPanel averages={result.averages} conv={result.conv} triage={result.triageResult} />
        ) : (
          <NeedGrades />
        ))}

      {activeTab === 'strategy' &&
        (result ? (
          <StrategyCards
            cards={result.strategies}
            selectedUnivs={selectedUnivs}
            onToggle={toggleUniv}
            onDetail={setDetailUniv}
          />
        ) : (
          <NeedGrades />
        ))}

      {activeTab === 'apply' &&
        (result ? (
          <DeptResultTable
            selectedUnivs={selectedUnivs}
            desiredMajor={desiredMajor}
            est9={result.conv.est9}
            deptMap={deptMap}
            loading={deptLoading}
          />
        ) : (
          <NeedGrades />
        ))}

      {result && (
        <>
          {user && consented === false && (
            <p className="upload-info">
              마이페이지에서 개인정보 수집·이용에 동의하면, 입력한 성적 평균이 상담용으로 저장됩니다.
            </p>
          )}
          <p className="disclaimer">{DISCLAIMER}</p>
        </>
      )}

      {detailUniv && (
        <UniversityDetailModal
          univName={detailUniv}
          admissions={data.admissions}
          onClose={() => setDetailUniv(null)}
        />
      )}
    </main>
  );
}

function NeedGrades() {
  return (
    <div className="panel">
      <p className="muted">먼저 ‘① 성적 입력’ 탭에서 성적을 입력하고 분석해 주세요.</p>
    </div>
  );
}
