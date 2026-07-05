-- 계정 관리: 관리자가 계정(프로필) 행을 삭제할 수 있도록 허용.
drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles for delete using (public.is_admin());
grant delete on public.profiles to authenticated;
