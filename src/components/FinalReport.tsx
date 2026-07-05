import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComboAverages, FinalReportData, JonghapPick, Track } from '../types';
import { aiFinalReport, type ReportPayload } from '../data/aiGuidance';
import { recommendFor, type JonghapMap } from '../data/loadJonghapSubjects';
import { ReportContent } from './ReportContent';
import { saveReport } from '../data/reports';
import { useAuth } from '../auth/AuthProvider';

// REQ-50 최종 보고서 — 선택 대학 + 교과/종합 구분 + 선택과목 + 조언을 AI가 자동 생성.
// 진입 시 자동 호출(세션 캐시). 인쇄(PDF 저장)·마크다운 다운로드 지원.

interface Props {
  est9: number;
  refRange: { min: number; max: number } | null;
  averages: ComboAverages;
  desiredMajor: string;
  track: Track;
  selectedUnivs: string[];
  jonghapPicks: JonghapPick[];
  jonghapMap: JonghapMap;
  triageMessage: string;
  onComplete?: () => void;
}

export function FinalReport({
  est9,
  refRange,
  averages,
  desiredMajor,
  track,
  selectedUnivs,
  jonghapPicks,
  jonghapMap,
  triageMessage,
  onComplete,
}: Props) {
  const [report, setReport] = useState<FinalReportData | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const completedRef = useRef(false);
  const { user } = useAuth();

  // 선택된 종합전형 학과의 권장과목(DB에 있으면)을 함께 전달.
  const payload = useMemo<ReportPayload>(() => {
    const jonghap = jonghapPicks.map((p) => {
      const rec = recommendFor(jonghapMap, p.univName, p.dept);
      const subjects = rec ? [...rec.핵심, ...rec.권장] : undefined;
      return { univName: p.univName, dept: p.dept, type: p.type, subjects };
    });
    return {
      est9,
      refRange,
      averages: averages as Record<string, number | null>,
      desiredMajor,
      track,
      universities: selectedUnivs.map((name) => ({ name })),
      jonghap,
      triageMessage,
    };
  }, [est9, refRange, averages, desiredMajor, track, selectedUnivs, jonghapPicks, jonghapMap, triageMessage]);

  useEffect(() => {
    if (selectedUnivs.length === 0) return;
    let active = true;
    setStatus('loading');
    setSaveState('idle');
    aiFinalReport(payload)
      .then((data) => {
        if (!active) return;
        setReport(data);
        setStatus('idle');
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      })
      .catch((e) => {
        if (!active) return;
        setErrMsg(e instanceof Error ? e.message : String(e));
        setStatus('error');
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  const saveCurrent = async () => {
    if (!report || !user) return;
    setSaveState('saving');
    try {
      await saveReport(user.id, desiredMajor ? `${desiredMajor} 대입 보고서` : '대입 전략 보고서', {
        report,
        meta: { est9, refRange, desiredMajor, track },
      });
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const downloadMd = () => {
    if (!report) return;
    const lines: string[] = ['# 대입 전략 최종 보고서', ''];
    if (desiredMajor) lines.push(`- 희망학과: ${desiredMajor}`);
    lines.push(`- 계열: ${track || '미상'}`);
    lines.push(`- 9등급 환산: 약 ${refRange ? `${refRange.min}~${refRange.max}` : est9.toFixed(2)}등급`, '');
    lines.push('## 진단 요약', '', report.summary, '');
    lines.push('## 지원 대학', '');
    for (const u of report.universities) {
      lines.push(`### ${u.name} (${u.type})`);
      if (u.note) lines.push(u.note);
      if (u.subjects.length) lines.push(`- 권장 선택과목: ${u.subjects.join(', ')}`);
      lines.push('');
    }
    lines.push('## 조언', '');
    for (const a of report.advice) lines.push(`- ${a}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '대입전략_최종보고서.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (selectedUnivs.length === 0) {
    return (
      <div className="panel">
        <h2>최종 보고서</h2>
        <p className="muted">
          ‘3단계’에서 지원할 대학을 선택하면, 진단·지원 대학·선택과목·조언을 담은 최종 보고서를 여기서 자동으로 만들어 드립니다.
        </p>
      </div>
    );
  }

  return (
    <div className="panel report-panel">
      <div className="report-actions no-print">
        <h2>최종 보고서</h2>
        <div className="report-btns">
          {user && (
            <button
              type="button"
              className="primary"
              onClick={saveCurrent}
              disabled={!report || saveState === 'saving' || saveState === 'saved'}
            >
              {saveState === 'saved' ? '✓ 저장됨' : saveState === 'saving' ? '저장 중…' : '💾 마이페이지에 저장'}
            </button>
          )}
          <button type="button" className="secondary" onClick={() => window.print()} disabled={!report}>
            🖨 인쇄·PDF 저장
          </button>
          <button type="button" className="secondary" onClick={downloadMd} disabled={!report}>
            ⬇ .md 다운로드
          </button>
        </div>
      </div>

      <p className="subtitle muted">
        {desiredMajor ? `희망학과 “${desiredMajor}” · ` : ''}계열 {track || '미상'} · 9등급 환산 약{' '}
        {refRange ? `${refRange.min}~${refRange.max}` : est9.toFixed(2)}등급
      </p>

      {status === 'loading' && <p className="muted">🤖 AI가 선택하신 대학과 성적을 바탕으로 최종 보고서를 작성하는 중…</p>}
      {status === 'error' && (
        <p className="warn">보고서를 생성하지 못했습니다: {errMsg}</p>
      )}

      {saveState === 'error' && <p className="warn no-print">보고서 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.</p>}

      {report && <ReportContent report={report} />}
    </div>
  );
}
