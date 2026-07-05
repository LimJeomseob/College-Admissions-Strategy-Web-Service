-- REQ-60~63: 마이페이지 · 학원 식별(학원명+원장) · 계정 활성화 · 보고서 저장
-- 기존 profiles 정책(self CRUD + admin select)에 admin update(활성 토글)만 보강.

-- ── 프로필 컬럼 보강 ──
alter table public.profiles add column if not exists academy_name text;      -- 학원명(예: 클럽하와이)
alter table public.profiles add column if not exists director_name text;     -- 원장 성함
alter table public.profiles add column if not exists active boolean not null default true; -- 계정 활성 여부

-- 관리자 프로필 수정(계정 활성/비활성 토글) 허용
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ── 저장된 최종 보고서 ──
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  data jsonb not null,           -- FinalReportData + 진단 메타(성적/희망학과 등)
  created_at timestamptz not null default now()
);
create index if not exists reports_user_created_idx on public.reports (user_id, created_at desc);

alter table public.reports enable row level security;
drop policy if exists "reports_select" on public.reports;
create policy "reports_select" on public.reports
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert with check (auth.uid() = user_id);
drop policy if exists "reports_delete_own" on public.reports;
create policy "reports_delete_own" on public.reports
  for delete using (auth.uid() = user_id or public.is_admin());

grant select, insert, delete on public.reports to authenticated;
