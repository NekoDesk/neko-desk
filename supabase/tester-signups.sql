-- ═══════════════════════════════════════════════
-- 안드로이드 비공개 테스트 신청 메일
--
-- PC 앱의 '모바일 앱 설치하러 가기'에서 안드로이드를 고르면 메일을 받는다.
-- 앱은 넣기만 할 수 있고 읽지는 못한다 — 남의 메일 주소가 보이면 안 되니까.
-- 모아 둔 목록은 Supabase 대시보드나 서비스 역할 열쇠로만 본다.
--
-- 실행: Supabase → SQL Editor 에 붙여넣고 Run
-- ═══════════════════════════════════════════════

create table if not exists public.tester_signups (
  id         bigserial primary key,
  email      text not null,
  platform   text not null default 'android',
  created_at timestamptz not null default now()
);

-- 같은 사람이 두 번 눌러도 한 줄만 남는다 (앱은 409 를 '이미 남김'으로 읽는다)
create unique index if not exists tester_signups_email_uniq
  on public.tester_signups (lower(email), platform);

alter table public.tester_signups enable row level security;

-- 넣기만 허용. select 정책이 없으므로 익명 키로는 아무도 읽을 수 없다.
drop policy if exists "tester_signups_anon_insert" on public.tester_signups;
create policy "tester_signups_anon_insert"
  on public.tester_signups for insert
  to anon, authenticated
  with check (
    email like '%@gmail.com'
    and length(email) between 6 and 254
    and platform in ('android', 'ios')
  );

grant insert on public.tester_signups to anon, authenticated;
grant usage on sequence public.tester_signups_id_seq to anon, authenticated;
grant all on public.tester_signups to service_role;
