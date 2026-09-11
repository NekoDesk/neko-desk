-- ═══════════════════════════════════════════════
-- 고양이 소리를 서버에 둔다
--
-- 소리도 고양이 이미지처럼 관리 화면에서 올리고 지우고 순서를 바꾼다.
-- 앱은 켤 때 목록을 받아 기기에 내려받아 두고 거기서 낸다. 서버에 아무것도
-- 없거나 못 받으면 앱에 들어 있는 소리를 그대로 쓴다.
--
-- role  = 어디에 쓰는 소리인가
--   touch  쓰다듬기(먹이·놀기) — 여러 개, ord 차례로 돌아가며 낸다
--   call1  부르기 1            — 하나
--   call2  부르기 2            — 하나
--   water  물·비타민           — 하나
--   fruit  열매                — 하나
--
-- 실행: Supabase → SQL Editor 에 붙여넣고 Run
-- 버킷 'cat-sounds' 는 관리자 함수가 처음 쓸 때 스스로 만든다 (공개 읽기).
-- ═══════════════════════════════════════════════

create table if not exists public.cat_sounds (
  id         bigserial primary key,
  role       text not null check (role in ('touch','call1','call2','water','fruit')),
  ord        int  not null default 0,
  name       text,
  file_url   text not null,
  created_at timestamptz not null default now()
);

alter table public.cat_sounds enable row level security;

-- 앱은 누구나(익명 키) 읽는다. 쓰기는 서비스 역할(관리자 함수)만.
drop policy if exists "cat_sounds_public_read" on public.cat_sounds;
create policy "cat_sounds_public_read"
  on public.cat_sounds for select
  using (true);

create index if not exists cat_sounds_role_ord on public.cat_sounds (role, ord);

-- 대시보드 SQL 편집기와 달리 CLI 로 만들면 익명 역할에 읽기 권한이 자동으로 붙지 않는다
grant select on public.cat_sounds to anon, authenticated;
grant usage on sequence public.cat_sounds_id_seq to service_role;
grant all on public.cat_sounds to service_role;
