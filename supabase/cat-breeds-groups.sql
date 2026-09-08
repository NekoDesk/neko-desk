-- ═══════════════════════════════════════════════
-- 고양이를 "종류 × 컨셉"으로 나눈다
--
-- 예전에는 이름 하나뿐이라 "흰냥이 · 선글라스" 처럼 적어야 했고,
-- 나중에 "선글라스만 모아 보기"나 "같은 종류의 다른 컨셉" 을 만들 수 없었다.
-- 값은 그냥 글자라 새 종류·컨셉을 쓰면 관리 화면의 표에 저절로 줄·칸이 생긴다.
--
-- 실행: Supabase → SQL Editor 에 붙여넣고 Run
-- ═══════════════════════════════════════════════

alter table cat_breeds add column if not exists breed_group text;
alter table cat_breeds add column if not exists concept text;

-- 이미 있던 고양이는 기본 컨셉으로 둔다. 종류는 이름을 그대로 쓴다 —
-- 관리 화면에서 고쳐 나가면 된다.
update cat_breeds
   set breed_group = coalesce(breed_group, name),
       concept     = coalesce(concept, '기본')
 where breed_group is null or concept is null;

-- 같은 종류·컨셉이 두 번 등록되지 않게
create unique index if not exists cat_breeds_group_concept_uniq
  on cat_breeds (breed_group, concept);

-- 표를 그릴 때 줄·칸 순서가 들쭉날쭉하지 않도록
create index if not exists cat_breeds_group_idx on cat_breeds (breed_group, concept);
