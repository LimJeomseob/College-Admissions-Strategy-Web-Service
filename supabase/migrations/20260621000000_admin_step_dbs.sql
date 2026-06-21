-- 관리자 단계별 DB(2/3/4단계) + 계정별 사용이력
-- 쓰기 정책은 기존 public.is_admin() (SECURITY DEFINER) 재사용.
-- 3개 단계 DB는 공개 읽기(anon 포함), 쓰기는 관리자만. usage_events는 본인 insert / 관리자·본인 select.

-- ── 2단계: 5등급↔9등급 환산 DB ──
create table if not exists public.conversion_db (
  id bigint generated always as identity primary key,
  avg5 numeric not null,
  busan numeric,
  daejin numeric,
  integrated numeric,            -- 50:50 통합 (앱 기본 est9)
  gg_jeon text,                  -- 경기_전과목 (범위 문자열)
  gg_guksuyeongsagwa text,       -- 경기_국수영사과
  gg_guksuyeonggwa text,         -- 경기_국수영과
  gg_guksuyeongsa text,          -- 경기_국수영사
  updated_at timestamptz not null default now()
);
create index if not exists conversion_db_avg5_idx on public.conversion_db (avg5);

-- ── 3단계: 교과전형 준비전략 DB ──
create table if not exists public.strategy_db (
  id bigint generated always as identity primary key,
  track text,                    -- 인문 / 자연
  admission_type text,           -- 교과전형 / 종합전형
  avg5 text,                     -- 5등급 (범위 "2.9~3.0" 허용 → text)
  est9 numeric,                  -- 9등급 (범위면 null)
  rank300 text,                  -- 전교 등수(300)
  univ_name text not null,
  univ_canon text not null,
  updated_at timestamptz not null default now()
);
create index if not exists strategy_db_canon_idx on public.strategy_db (univ_canon);

-- ── 4단계: 대학학과입결 DB ──
create table if not exists public.dept_admissions_db (
  id bigint generated always as identity primary key,
  univ_canon text not null,
  univ_raw text,
  year int,
  type text,
  detail text,
  dept text,
  quota numeric,
  comp numeric,
  add_pass numeric,
  g50 numeric,
  g70 numeric,
  updated_at timestamptz not null default now()
);
create index if not exists dept_admissions_db_canon_idx on public.dept_admissions_db (univ_canon);
create index if not exists dept_admissions_db_canon_year_idx on public.dept_admissions_db (univ_canon, year);

-- ── 사용이력 ──
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,      -- step_enter | step_complete | analysis_run
  step text,                     -- input | convert | strategy | apply
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_created_idx on public.usage_events (user_id, created_at desc);

-- ── RLS ──
alter table public.conversion_db enable row level security;
alter table public.strategy_db enable row level security;
alter table public.dept_admissions_db enable row level security;
alter table public.usage_events enable row level security;

-- 공개 읽기 + 관리자 전용 쓰기 (3개 DB 공통)
do $$
declare t text;
begin
  foreach t in array array['conversion_db','strategy_db','dept_admissions_db']
  loop
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('create policy "%s read" on public.%I for select using (true)', t, t);
    execute format('drop policy if exists "%s admin write" on public.%I', t, t);
    execute format('create policy "%s admin write" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- 사용이력: 본인 insert / 관리자·본인 select
drop policy if exists "usage insert self" on public.usage_events;
create policy "usage insert self" on public.usage_events
  for insert with check (auth.uid() = user_id);
drop policy if exists "usage select admin or self" on public.usage_events;
create policy "usage select admin or self" on public.usage_events
  for select using (public.is_admin() or auth.uid() = user_id);
