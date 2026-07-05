-- 관리자 페이지 사용 이력 편집: 관리자가 usage_events를 삭제(초기화)할 수 있도록 허용.
drop policy if exists "usage delete admin" on public.usage_events;
create policy "usage delete admin" on public.usage_events for delete using (public.is_admin());
grant delete on public.usage_events to authenticated;
