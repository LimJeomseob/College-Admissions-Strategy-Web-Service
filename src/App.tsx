import { useEffect, useMemo, useState } from 'react';
import { DISCLAIMER } from './config';
import { loadDataLayer } from './data/loadDataLayer';
import {
  buildSubjectStrategies,
  computeComboAverages,
  convert,
  match,
  triage,
} from './engine';
import { GradeInputForm } from './components/GradeInputForm';
import { ConversionPanel } from './components/ConversionPanel';
import { ResultList } from './components/ResultList';
import { StrategyCards } from './components/StrategyCards';
import type { DataLayer, SubjectInput, Track } from './types';

export default function App() {
  const [data, setData] = useState<DataLayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectInput[]>([]);
  const [track, setTrack] = useState<Track>('인문');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadDataLayer().then(setData).catch((e) => setError(String(e)));
  }, []);

  const result = useMemo(() => {
    if (!data || !submitted) return null;
    const averages = computeComboAverages(subjects);
    const refAvg = averages['전과목'] ?? averages['국수영사과'];
    if (refAvg == null) return null;

    const conv = convert(data.conversion, refAvg);
    const triageResult = triage(conv.est9);
    const matchOutput = match(data.admissions, data.conversion, averages, { track });
    const strategies = buildSubjectStrategies(
      matchOutput.matched,
      data.subjectTrack,
      averages,
    );
    return { averages, conv, triageResult, matchOutput, strategies };
  }, [data, submitted, subjects, track]);

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

      {result && (
        <section className="results">
          <ConversionPanel averages={result.averages} conv={result.conv} triage={result.triageResult} />
          <StrategyCards cards={result.strategies} subjectOnly={result.triageResult.subjectOnly} />
          <ResultList output={result.matchOutput} subjectOnly={result.triageResult.subjectOnly} />
          <p className="disclaimer">{DISCLAIMER}</p>
        </section>
      )}
    </main>
  );
}
