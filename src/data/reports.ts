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
export interface SavedReportPayload {
  report: FinalReportData;
  meta: SavedReportMeta;
  gyo?: GyoBandRow[];
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
