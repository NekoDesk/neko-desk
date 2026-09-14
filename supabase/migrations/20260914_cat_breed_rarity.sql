-- 고양이 등급 (레어냥 · 슈퍼레어냥 · 레전드냥)
--
-- 이미 있던 고양이는 전부 'normal' 이 된다 — 값도 자물쇠도 없이 예전처럼 쓸 수 있다.
-- 앱은 모르는 값을 만나면 'normal' 로 보므로, 이 열이 없는 동안에도 앱은 멀쩡히 돈다.
--
-- 돌리는 법: Supabase 대시보드 > SQL Editor 에 붙여넣고 Run.

alter table public.cat_breeds
  add column if not exists rarity text not null default 'normal';

-- 오타 한 번이면 앱에서 영영 안 열리는 고양이가 생긴다. 값을 넷으로 못박는다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cat_breeds_rarity_check'
  ) then
    alter table public.cat_breeds
      add constraint cat_breeds_rarity_check
      check (rarity in ('normal', 'rare', 'super', 'legend'));
  end if;
end $$;

-- 앱은 등급으로 걸러 읽지 않지만(한 번에 다 받아 간다), 관리 화면에서 등급별로
-- 모아 보는 일이 잦아진다.
create index if not exists cat_breeds_rarity_idx on public.cat_breeds (rarity);
