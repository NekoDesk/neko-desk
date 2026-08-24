-- 동기화 행 삭제 권한 — Supabase SQL Editor에서 실행
--
-- 앱의 '데이터 초기화'는 클라우드에 저장된 본인 기록도 함께 지우려 하는데,
-- authenticated 역할에 DELETE 권한이 없어 403(42501)로 막히고 있었다.
-- RLS 정책과 GRANT는 별개라 둘 다 있어야 한다.
--
-- 안전: 본인 행(auth.uid() = user_id)만 지울 수 있다. 남의 행은 정책이 막는다.

grant delete on public.nekodesk_sync to authenticated;

drop policy if exists "own row delete" on public.nekodesk_sync;
create policy "own row delete" on public.nekodesk_sync
  for delete using (auth.uid() = user_id);

-- 확인용: 정책 4종(select/insert/update/delete)이 모두 있어야 한다
select cmd, policyname from pg_policies
where schemaname = 'public' and tablename = 'nekodesk_sync'
order by cmd;
