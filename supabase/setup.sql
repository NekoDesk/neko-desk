-- ═══════════════════════════════════════════════
-- NEKO DESK — Supabase 초기 설정 SQL
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- ═══════════════════════════════════════════════

-- 상품 테이블
create table if not exists products (
  id bigint generated always as identity primary key,
  name text not null,
  price integer not null,
  img_url text,             -- Storage 공개 URL
  link text,                -- (선택) 외부 구매 링크
  cat text default 'office', -- 카테고리
  active boolean default true,
  created_at timestamptz default now()
);

-- 주문 테이블
create table if not exists orders (
  id bigint generated always as identity primary key,
  order_id text unique not null,        -- 토스 orderId
  payment_key text,                     -- 토스 paymentKey
  product_id bigint references products(id),
  product_name text not null,
  amount integer not null,
  status text default 'PAID',           -- PAID / SHIPPED / CANCELED
  buyer_email text,
  ship_name text not null,
  ship_phone text not null,
  ship_postal text,
  ship_addr1 text not null,
  ship_addr2 text,
  created_at timestamptz default now()
);

-- RLS (Row Level Security)
alter table products enable row level security;
alter table orders enable row level security;

-- 상품: 누구나 읽기 가능 (anon key로 조회)
create policy "products_public_read"
  on products for select
  to anon
  using (active = true);

-- 상품 쓰기/주문 접근: anon 불가 (Edge Function의 service role만 가능)
-- service role은 RLS를 우회하므로 별도 정책 불필요

-- Storage: 대시보드에서 'product-images' 버킷을 Public으로 생성하세요
-- (Storage → New bucket → name: product-images → Public bucket 체크)

-- ═══════════════════════════════════════════════
-- 고양이 종류 테이블 (관리자 등록용)
-- ═══════════════════════════════════════════════
create table if not exists cat_breeds (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  image_url text,
  created_at timestamptz default now()
);

alter table cat_breeds enable row level security;

-- 누구나 읽기 가능 (anon key로 조회)
create policy "cat_breeds_public_read"
  on cat_breeds for select
  to anon
  using (true);

-- Storage: 'cat-images' 버킷도 Public으로 생성하세요
-- (Storage → New bucket → name: cat-images → Public bucket 체크)
