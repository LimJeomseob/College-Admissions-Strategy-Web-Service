import { useEffect, useMemo, useState } from 'react';
import { DISCLAIMER } from '../config';
import { loadDataLayer } from '../data/loadDataLayer';
import { loadDeptAdmissions } from '../data/loadDeptAdmissions';
import {
  loadConversionRows,
  loadStrategyAdmissions,
  loadDeptAdmissionsFor,
  supabaseDataEnabled,
} from '../data/loadStepData';
import { logUsage } from '../data/usageLog';
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
import { DeptResultTable, pickKey } from '../components/DeptResultTable';
import { StrategyCards } from '../components/StrategyCards';
import { UniversityDetailModal } from '../components/UniversityDetailModal';
import { SelectedUnivsModal } from '../components/SelectedUnivsModal';
import { JonghapRecommend } from '../components/JonghapRecommend';
import { loadJonghapSubjects, type JonghapMap } from '../data/loadJonghapSubjects';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { DataLayer, DeptRow, JonghapPick, SubjectInput, Track } from '../types';

type TabId = 'input' | 'convert' | 'strategy' | 'apply' | 'jonghap';
const TABS: { id: TabId; label: string }[] = [
  { id: 'input', label: '1단계 성적 입력' },
  { id: 'convert', label: '2단계 성적 체계 환산' },
  { id: 'strategy', label: '3단계 교과 전형 지원 가능 대학' },
  { id: 'apply', label: '4단계 수시 지원 교과·종합 추천 대학' },
  { id: 'jonghap', label: '5단계 학생부종합전형 선택과목 추천' },
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
  const [showSelectedList, setShowSelectedList] = useState(false);
  const [deptMap, setDeptMap] = useState<Record<string, DeptRow[]>>({});
  const [deptLoading, setDeptLoading] = useState(false);
  const [jonghapPicks, setJonghapPicks] = useState<JonghapPick[]>([]);
  const [jonghapMap, setJonghapMap] = useState<JonghapMap>({});
  const [jonghapLoading, setJonghapLoading] = useState(false);

  const { user } = useAuth();

  // 정적 dataLayer 로드 후, Supabase 단계 DB가 있으면 2단계(환산)·3단계(합격선)를 치환.
  useEffect(() => {
    let active = true;
    loadDataLayer()
      .then(async (base) => {
        const [conv, adm] = await Promise.all([loadConversionRows(), loadStrategyAdmissions()]);
        if (!active) return;
        setData({ ...base, conversion: conv ?? base.conversion, admissions: adm ?? base.admissions });
      })
      .catch((e) => active && setError(String(e)));
    return () => {
      active = false;
    };
  }, []);

  // 탭 이동 + 사용이력(단계 진입) 로깅.
  const goTab = (id: TabId) => {
    setActiveTab(id);
    logUsage('step_enter', id, undefined, { once: true });
  };

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

  // 학과 입결 DB 로드(④ 표용). Supabase면 선택 대학별 조회, 아니면 정적 전체 1회.
  useEffect(() => {
    if (!result) return;
    if (supabaseDataEnabled()) {
      if (selectedUnivs.length === 0) return;
      setDeptLoading(true);
      loadDeptAdmissionsFor(selectedUnivs)
        .then(async (m) => {
          const hasAny = m && Object.values(m).some((arr) => arr.length > 0);
          if (hasAny) setDeptMap((prev) => ({ ...prev, ...m! }));
          else setDeptMap(await loadDeptAdmissions()); // 미시드/실패 → 정적 폴백
        })
        .finally(() => setDeptLoading(false));
    } else if (Object.keys(deptMap).length === 0) {
      setDeptLoading(true);
      loadDeptAdmissions()
        .then(setDeptMap)
        .finally(() => setDeptLoading(false));
    }
  }, [result, selectedUnivs]);

  // 5단계 선택과목 추천 DB lazy 로드(결과 생성 시 1회).
  useEffect(() => {
    if (!result || Object.keys(jonghapMap).length > 0) return;
    setJonghapLoading(true);
    loadJonghapSubjects()
      .then(setJonghapMap)
      .finally(() => setJonghapLoading(false));
  }, [result]);

  // 사용이력(단계 완료) — 분석 결과/선택이 생기는 시점에 1회씩.
  useEffect(() => {
    if (result) logUsage('step_complete', 'convert', undefined, { once: true });
  }, [result]);
  useEffect(() => {
    if (selectedUnivs.length > 0) logUsage('step_complete', 'strategy', undefined, { once: true });
  }, [selectedUnivs]);
  useEffect(() => {
    if (jonghapPicks.length > 0) logUsage('step_complete', 'jonghap', undefined, { once: true });
  }, [jonghapPicks]);

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

  const jonghapKeys = useMemo(() => new Set(jonghapPicks.map(pickKey)), [jonghapPicks]);
  const toggleJonghap = (pick: JonghapPick) =>
    setJonghapPicks((prev) =>
      prev.some((p) => pickKey(p) === pickKey(pick)) ? prev.filter((p) => pickKey(p) !== pickKey(pick)) : [...prev, pick],
    );

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
            onClick={() => goTab(t.id)}
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
              logUsage('analysis_run', 'input', { subjectCount: rows.length });
              logUsage('step_complete', 'input', undefined, { once: true });
              goTab('convert');
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
          <>
            <StrategyCards
              cards={result.strategies}
              selectedUnivs={selectedUnivs}
              onToggle={toggleUniv}
              onDetail={setDetailUniv}
            />
            <div className="step-nav">
              {selectedUnivs.length > 0 && (
                <button type="button" className="secondary" onClick={() => setShowSelectedList(true)}>
                  선택한 대학 {selectedUnivs.length}개 보기
                </button>
              )}
              <button type="button" className="primary" onClick={() => goTab('apply')}>
                다음 단계로 이동 (4단계) →
              </button>
            </div>
          </>
        ) : (
          <NeedGrades />
        ))}

      {activeTab === 'apply' &&
        (result ? (
          <>
            <DeptResultTable
              selectedUnivs={selectedUnivs}
              desiredMajor={desiredMajor}
              est9={result.conv.est9}
              deptMap={deptMap}
              conversion={data.conversion}
              loading={deptLoading}
              selectedJonghap={jonghapKeys}
              onToggleJonghap={toggleJonghap}
            />
            {jonghapPicks.length > 0 && (
              <div className="step-nav">
                <button type="button" className="primary" onClick={() => goTab('jonghap')}>
                  다음 단계로 이동 (5단계) →
                </button>
              </div>
            )}
          </>
        ) : (
          <NeedGrades />
        ))}

      {activeTab === 'jonghap' &&
        (result ? (
          <JonghapRecommend picks={jonghapPicks} map={jonghapMap} loading={jonghapLoading} />
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

      {showSelectedList && (
        <SelectedUnivsModal
          selectedUnivs={selectedUnivs}
          admissions={data.admissions}
          onClose={() => setShowSelectedList(false)}
          onDetail={setDetailUniv}
          onToggle={toggleUniv}
        />
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
