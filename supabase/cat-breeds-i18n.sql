-- 고양이 품종 다국어 —  Supabase SQL Editor에서 그대로 실행
--
-- 앱 코드는 이미 name_en / name_ja / desc_en / desc_ja 를 읽도록 되어 있는데
-- (renderer/index.html 의 renderCatPage), 테이블에 그 열이 없어서 항상 한국어로
-- 폴백하고 있었다. 열을 추가하고 값을 채운다.
--
-- 안전: ADD COLUMN IF NOT EXISTS + id 지정 UPDATE 라 기존 데이터는 그대로다.

alter table public.cat_breeds add column if not exists name_en text;
alter table public.cat_breeds add column if not exists name_ja text;
alter table public.cat_breeds add column if not exists desc_en text;
alter table public.cat_breeds add column if not exists desc_ja text;

update public.cat_breeds set
  name_en = 'Snowy',   name_ja = 'しろにゃん',
  desc_en = 'Elegant and aloof', desc_ja = '優雅でツンとした'
where id = 12;   -- 흰냥이 / 우아하고 도도한

update public.cat_breeds set
  name_en = 'Mackerel', name_ja = 'サバにゃん',
  desc_en = 'Lively and curious', desc_ja = '元気で好奇心いっぱい'
where id = 13;   -- 고등어 / 활발하고 호기심 많은

update public.cat_breeds set
  name_en = 'Shadow',  name_ja = 'くろにゃん',
  desc_en = 'Mysterious and charming', desc_ja = '神秘的で魅力的な'
where id = 14;   -- 까망이 / 신비롭고 매력적인

update public.cat_breeds set
  name_en = 'Blossom', name_ja = 'ももにゃん',
  desc_en = 'Lovely and sweet', desc_ja = '愛らしくて甘い'
where id = 15;   -- 분홍이 / 사랑스럽고 달콤한

-- 확인용
select id, name, name_en, name_ja, description, desc_en, desc_ja
from public.cat_breeds order by id;
