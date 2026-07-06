import { supabase } from '../auth/supabaseClient';
import type { FinalReportData } from '../types';
import type { GyoBandRow } from './loadDeptAdmissions';

// REQ-60: 최종 보고서 저장·조회 (public.reports, RLS: 본인·관리자).

export interface SavedReportMeta {
  est9: number;
  refRange: { min: number; max: number } | null;
  desiredMajor: string;
  track: string;
}
/** 보고서 저장 시점의 학생 정보 스냅샷 — 보고서와 1:1 */
export interface ReportStudent {
  name: string;
  grade: string;
  desiredMajor: string;
  contact: string;
}
export interface SavedReportPayload {
  report: FinalReportData;
  meta: SavedReportMeta;
  gyo?: GyoBandRow[];
  student?: ReportStudent;
}
export interface SavedReport {
  id: number;
  title: string | null;
  data: SavedReportPayload;
  created_at: string;
}

/** 보고서 저장. 로그인 필요. 저장된 행을 반환. */
export async function saveReport(userId: string, title: string, payload: SavedReportPayload): Promise<SavedReport> {
  if (!supabase) throw new Error('서버가 설정되지 않았습니다.');
  const { data, error } = await supabase
    .from('reports')
    .insert({ user_id: userId, title, data: payload })
    .select('id, title, data, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data as SavedReport;
}

/** 본인 저장 보고서 목록(최근순). */
export async function listReports(): Promise<SavedReport[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reports')
    .select('id, title, data, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SavedReport[]) ?? [];
}

export async function deleteReport(id: number): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** 저장 payload → 마크다운 문서 (6단계 다운로드·마이페이지 다운로드 공용). */
export function reportToMarkdown(p: SavedReportPayload): string {
  const { report, meta, gyo, student } = p;
  const lines: string[] = ['# 대입 전략 최종 보고서', ''];
  if (student && (student.name || student.grade || student.contact)) {
    lines.push(`- 학생: ${student.name || '—'}${student.grade ? ` (${student.grade})` : ''}${student.contact ? ` · ${student.contact}` : ''}`);
  }
  const major = student?.desiredMajor || meta.desiredMajor;
  if (major) lines.push(`- 희망학과: ${major}`);
  lines.push(`- 계열: ${meta.track || '미상'}`);
  lines.push(`- 9등급 환산: 약 ${meta.refRange ? `${meta.refRange.min}~${meta.refRange.max}` : meta.est9.toFixed(2)}등급`, '');
  lines.push('## 진단 요약', '', report.summary, '');
  if (gyo && gyo.length > 0) {
    lines.push('## 교과전형 지원 가능 대학 (안정/적정/소신)', '', '| 구분 | 대학 | 모집단위 |', '| --- | --- | --- |');
    for (const g of gyo) lines.push(`| ${g.band} | ${g.univName} | ${g.dept} |`);
    lines.push('');
  }
  lines.push('## 지원 대학', '');
  for (const u of report.universities) {
    lines.push(`### ${u.name} (${u.type})`);
    if (u.note) lines.push(u.note);
    if (u.subjects.length) lines.push(`- 권장 선택과목: ${u.subjects.join(', ')}`);
    lines.push('');
  }
  lines.push('## 조언', '');
  for (const a of report.advice) lines.push(`- ${a}`);
  return lines.join('\n');
}

/** 보고서 .md 파일 다운로드. 파일명에 학생명 포함. */
export function downloadReportMd(p: SavedReportPayload): void {
  const blob = new Blob([reportToMarkdown(p)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = p.student?.name ? `대입전략보고서_${p.student.name}.md` : '대입전략_최종보고서.md';
  a.click();
  URL.revokeObjectURL(url);
}
