-- 회원가입 Google 전용 전환: 온보딩에서 수집한 이메일을 프로필에 보관(관리자 계정관리 표시용).
-- RLS/grant는 기존 self-update·admin-select 정책으로 충분.
alter table public.profiles add column if not exists email text;
