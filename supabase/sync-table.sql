-- ═══════════════════════════════════════════════
-- NEKO DESK 기기 간 동기화 테이블
--   PC ↔ 모바일에서 할 일 목록 / 다이어리를 공유한다.
--   Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요.
-- ═══════════════════════════════════════════════

create table if not exists public.nekodesk_sync (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.nekodesk_sync enable row level security;

-- 본인 행만 읽고 쓸 수 있음
drop policy if exists "own row select" on public.nekodesk_sync;
create policy "own row select" on public.nekodesk_sync
  for select using (auth.uid() = user_id);

drop policy if exists "own row insert" on public.nekodesk_sync;
create policy "own row insert" on public.nekodesk_sync
  for insert with check (auth.uid() = user_id);

drop policy if exists "own row update" on public.nekodesk_sync;
create policy "own row update" on public.nekodesk_sync
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- upsert 시 updated_at 자동 갱신
create or replace function public.nekodesk_sync_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists nekodesk_sync_touch on public.nekodesk_sync;
create trigger nekodesk_sync_touch
  before insert or update on public.nekodesk_sync
  for each row execute function public.nekodesk_sync_touch();