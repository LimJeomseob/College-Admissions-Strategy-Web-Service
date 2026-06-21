import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import type { StepDbConfig } from '../../config/stepDbConfigs';

// 단계별 DB 관리 — 조회(검색·페이지네이션) + 행 추가/수정/삭제 + 파일 업로드 통째 교체.
// 모든 쓰기는 supabase(RLS: 관리자만)로 수행.

type Row = Record<string, unknown> & { id: number };
const INSERT_BATCH = 1000;

export function AdminDbManager({ config }: { config: StepDbConfig }) {
  const cols = config.columns;
  const selectCols = ['id', ...cols.map((c) => c.key)].join(', ');

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const from = page * config.pageSize;
    let q = supabase
      .from(config.table)
      .select(selectCols, { count: 'exact' })
      .order('id', { ascending: true })
      .range(from, from + config.pageSize - 1);
    if (search.trim()) q = q.ilike(config.searchColumn, `%${search.trim()}%`);
    const { data, count, error } = await q;
    if (error) setError(error.message);
    else {
      setRows((data as unknown as Row[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [config, page, search, selectCols]);

  useEffect(() => {
    load();
  }, [load]);

  const toPayload = (d: Record<string, string>) => {
    const out: Record<string, unknown> = {};
    for (const c of cols) {
      const raw = (d[c.key] ?? '').trim();
      out[c.key] = raw === '' ? null : c.type === 'number' ? Number(raw) : raw;
    }
    return out;
  };

  const startEdit = (r: Row) => {
    setAdding(false);
    setEditId(r.id);
    const d: Record<string, string> = {};
    for (const c of cols) d[c.key] = r[c.key] == null ? '' : String(r[c.key]);
    setDraft(d);
  };

  const saveEdit = async () => {
    if (!supabase || editId == null) return;
    setBusy(true);
    const { error } = await supabase.from(config.table).update(toPayload(draft)).eq('id', editId);
    setBusy(false);
    if (error) setError(error.message);
    else {
      setEditId(null);
      load();
    }
  };

  const addRow = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from(config.table).insert(toPayload(draft));
    setBusy(false);
    if (error) setError(error.message);
    else {
      setAdding(false);
      setDraft({});
      load();
    }
  };

  const remove = async (id: number) => {
    if (!supabase) return;
    if (!window.confirm('이 행을 삭제할까요?')) return;
    const { error } = await supabase.from(config.table).delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  };

  const onUpload = async (file: File) => {
    if (!supabase) return;
    setError(null);
    let parsed: Record<string, unknown>[];
    try {
      parsed = await config.parseUpload(file);
    } catch (e) {
      setError(`파일 파싱 실패: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    if (parsed.length === 0) {
      setError('파일에서 유효한 행을 찾지 못했습니다.');
      return;
    }
    if (!window.confirm(`기존 데이터를 모두 지우고 ${parsed.length.toLocaleString()}행으로 교체할까요?`)) return;
    setBusy(true);
    setUploadMsg('기존 데이터 삭제 중…');
    const del = await supabase.from(config.table).delete().gte('id', 0);
    if (del.error) {
      setBusy(false);
      setUploadMsg(null);
      setError(`삭제 실패: ${del.error.message}`);
      return;
    }
    for (let i = 0; i < parsed.length; i += INSERT_BATCH) {
      const chunk = parsed.slice(i, i + INSERT_BATCH);
      setUploadMsg(`적재 중… ${Math.min(i + chunk.length, parsed.length).toLocaleString()} / ${parsed.length.toLocaleString()}`);
      const { error } = await supabase.from(config.table).insert(chunk);
      if (error) {
        setBusy(false);
        setUploadMsg(null);
        setError(`적재 실패(${i}행 부근): ${error.message}`);
        load();
        return;
      }
    }
    setBusy(false);
    setUploadMsg(`완료 — ${parsed.length.toLocaleString()}행 교체됨`);
    setPage(0);
    load();
  };

  const pages = Math.max(1, Math.ceil(total / config.pageSize));
  const editingDraftRow = (
    <tr className="db-edit-row">
      {cols.map((c) => (
        <td key={c.key}>
          <input
            value={draft[c.key] ?? ''}
            type={c.type === 'number' ? 'number' : 'text'}
            onChange={(e) => setDraft((p) => ({ ...p, [c.key]: e.target.value }))}
          />
        </td>
      ))}
      <td>
        <button onClick={adding ? addRow : saveEdit} disabled={busy}>저장</button>
        <button onClick={() => { setAdding(false); setEditId(null); }}>취소</button>
      </td>
    </tr>
  );

  return (
    <section className="admin-db">
      <h3>{config.title}</h3>
      <div className="admin-db-toolbar">
        <input
          placeholder={`검색 (${cols.find((c) => c.key === config.searchColumn)?.label ?? config.searchColumn})`}
          value={search}
          onChange={(e) => { setPage(0); setSearch(e.target.value); }}
        />
        <button onClick={() => { setEditId(null); setAdding(true); setDraft({}); }}>+ 행 추가</button>
        <label className="db-upload-btn">
          파일 업로드 교체
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv,.md,.txt"
            hidden
            disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
          />
        </label>
        <span className="muted">{config.acceptHint} · 총 {total.toLocaleString()}행</span>
      </div>

      {uploadMsg && <p className="muted">{uploadMsg}</p>}
      {error && <p className="error">{error}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table className="result-table admin-db-table">
          <thead>
            <tr>
              {cols.map((c) => <th key={c.key}>{c.label}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {adding && editingDraftRow}
            {loading ? (
              <tr><td colSpan={cols.length + 1}>불러오는 중…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={cols.length + 1} className="muted">데이터가 없습니다.</td></tr>
            ) : (
              rows.map((r) =>
                editId === r.id ? (
                  <tr key={r.id} className="db-edit-row">
                    {cols.map((c) => (
                      <td key={c.key}>
                        <input
                          value={draft[c.key] ?? ''}
                          type={c.type === 'number' ? 'number' : 'text'}
                          onChange={(e) => setDraft((p) => ({ ...p, [c.key]: e.target.value }))}
                        />
                      </td>
                    ))}
                    <td>
                      <button onClick={saveEdit} disabled={busy}>저장</button>
                      <button onClick={() => setEditId(null)}>취소</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    {cols.map((c) => <td key={c.key}>{r[c.key] == null ? '—' : String(r[c.key])}</td>)}
                    <td className="db-row-actions">
                      <button onClick={() => startEdit(r)}>수정</button>
                      <button onClick={() => remove(r.id)}>삭제</button>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-db-pager">
        <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}>← 이전</button>
        <span className="muted">{page + 1} / {pages}</span>
        <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1 || loading}>다음 →</button>
      </div>
    </section>
  );
}
