-- ============================================================
-- Jrubiecakes — Supabase schema, RLS policies and seed data
-- Run this in Supabase SQL Editor (or supabase db push).
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- The SQL-language helper functions below reference tables that are created
-- further down the file. Postgres validates sql function bodies at creation
-- time by default, which would fail on an empty database with
-- 'relation "public.profiles" does not exist'. Disable that check for this
-- session; the bodies are valid by the time the functions are first called.
set check_function_bodies = off;

-- ---------- helper: get current user role ----------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false);
$$;

-- ---------- profiles ----------
-- Add columns from later versions of this file to databases created earlier
alter table public.profiles add column if not exists avatar_url text;

-- Widen payment status checks to include 'processing' and 'abandoned'
-- (drop-if-exists + named constraints keeps this re-runnable)
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending','processing','awaiting_payment','paid','failed','abandoned','refunded'));
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending','processing','awaiting_payment','paid','failed','abandoned','refunded'));

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  -- bootstrap admin from comma-separated custom setting app.admin_bootstrap_emails
  if exists (
    select 1 from unnest(
      string_to_array(coalesce(current_setting('app.admin_bootstrap_emails', true), ''), ',')
    ) as a(email)
    where lower(trim(a.email)) = lower(new.email) and trim(a.email) <> ''
  ) then
    update public.profiles set role = 'admin' where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- categories ----------
create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- products ----------
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(12,2) not null check (price >= 0),
  sale_price numeric(12,2) check (sale_price >= 0),
  is_available boolean not null default true,
  is_featured boolean not null default false,
  is_customizable boolean not null default false,
  stock_quantity int,
  prep_time_hours int,
  min_order_quantity int not null default 1 check (min_order_quantity >= 1),
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_featured on public.products(is_featured) where is_featured;
create index if not exists idx_products_available on public.products(is_available);
create index if not exists idx_products_name_trgm on public.products using gin (to_tsvector('english', name));

-- ---------- product images ----------
create table if not exists public.product_images (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_images_product on public.product_images(product_id);

-- ---------- product options ----------
create table if not exists public.product_options (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  type text not null default 'select' check (type in ('select','text','multiline','date','file')),
  is_required boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_options_product on public.product_options(product_id);

create table if not exists public.product_option_values (
  id uuid primary key default uuid_generate_v4(),
  option_id uuid not null references public.product_options(id) on delete cascade,
  value text not null,
  price_delta numeric(12,2) not null default 0 check (price_delta >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_option_values_option on public.product_option_values(option_id);

-- ---------- orders ----------
create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  fulfillment_type text not null check (fulfillment_type in ('delivery','pickup')),
  address_line text,
  city text,
  state text,
  landmark text,
  delivery_instructions text,
  requested_date date,
  requested_time text,
  notes text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  payment_method text not null check (payment_method in ('paystack','bank_transfer','cash')),
  payment_status text not null default 'pending' check (payment_status in ('pending','processing','awaiting_payment','paid','failed','abandoned','refunded')),
  order_status text not null default 'pending' check (order_status in ('pending','awaiting_payment','paid','confirmed','preparing','ready','out_for_delivery','completed','cancelled')),
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_orders_email on public.orders(customer_email);
create index if not exists idx_orders_status on public.orders(order_status);
create index if not exists idx_orders_payment_ref on public.orders(payment_reference);
create index if not exists idx_orders_created on public.orders(created_at desc);

-- ---------- order items ----------
create table if not exists public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity int not null check (quantity >= 1),
  line_total numeric(12,2) not null check (line_total >= 0),
  customizations jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items(order_id);

create table if not exists public.order_item_options (
  id uuid primary key default uuid_generate_v4(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  option_name text not null,
  option_value text not null,
  price_delta numeric(12,2) not null default 0
);

create index if not exists idx_order_item_options_item on public.order_item_options(order_item_id);

-- ---------- payments ----------
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method text not null check (method in ('paystack','bank_transfer','cash')),
  status text not null default 'pending' check (status in ('pending','processing','awaiting_payment','paid','failed','abandoned','refunded')),
  amount numeric(12,2) not null check (amount >= 0),
  reference text unique,
  paystack_authorization_url text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_order on public.payments(order_id);
create index if not exists idx_payments_reference on public.payments(reference);

-- ---------- delivery settings ----------
create table if not exists public.delivery_settings (
  id uuid primary key default uuid_generate_v4(),
  zone_name text not null,
  states text[],
  fee numeric(12,2) not null check (fee >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- site settings (key/value) ----------
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- customer addresses ----------
create table if not exists public.customer_addresses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  address_line text not null,
  city text not null,
  state text not null,
  landmark text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_addresses_user on public.customer_addresses(user_id);

-- ---------- reviews (testimonials) ----------
create table if not exists public.reviews (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  customer_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_reviews_product on public.reviews(product_id);

-- ---------- saved carts (client-side cart sync for signed-in users) ----------
create table if not exists public.cart_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- payment events (audit timeline shown on the admin order page) ----------
create table if not exists public.payment_events (
  id uuid primary key default uuid_generate_v4(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  event text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_events_payment on public.payment_events(payment_id, created_at);

-- ---------- admin_users ----------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_options enable row level security;
alter table public.payments enable row level security;
alter table public.delivery_settings enable row level security;
alter table public.site_settings enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.reviews enable row level security;
alter table public.admin_users enable row level security;
alter table public.cart_state enable row level security;
alter table public.payment_events enable row level security;

-- create policy has no "if not exists", so drop the policies this file manages
-- before recreating them below. This makes the whole file safe to re-run.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles','categories','products','product_images','product_options',
        'product_option_values','orders','order_items','order_item_options',
        'payments','delivery_settings','site_settings','customer_addresses',
        'reviews','admin_users','cart_state','payment_events'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- profiles: users read/update own; admins read all
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid());
create policy "profiles_admin_update" on public.profiles for update using (public.is_admin());

-- categories: public read active; admin write
create policy "categories_public_read" on public.categories for select using (is_active or public.is_admin());
create policy "categories_admin_write" on public.categories for all using (public.is_admin()) with check (public.is_admin());

-- products: public read available; admin all
create policy "products_public_read" on public.products for select using (is_available or public.is_admin());
create policy "products_admin_write" on public.products for all using (public.is_admin()) with check (public.is_admin());

-- product images: public read; admin write
create policy "product_images_public_read" on public.product_images for select using (true);
create policy "product_images_admin_write" on public.product_images for all using (public.is_admin()) with check (public.is_admin());

-- product options/values: public read; admin write
create policy "product_options_public_read" on public.product_options for select using (true);
create policy "product_options_admin_write" on public.product_options for all using (public.is_admin()) with check (public.is_admin());
create policy "option_values_public_read" on public.product_option_values for select using (true);
create policy "option_values_admin_write" on public.product_option_values for all using (public.is_admin()) with check (public.is_admin());

-- orders: user sees own; guests insert is blocked at API level (checkout requires login);
-- guest checkout happens via the checkout API route using the service-role client.
create policy "orders_select_own" on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "orders_insert_authenticated" on public.orders for insert with check (auth.uid() is not null);
create policy "orders_admin_update" on public.orders for update using (public.is_admin()) with check (public.is_admin());

-- order items/options
create policy "order_items_select_own" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "order_items_insert_auth" on public.order_items for insert with check (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "order_items_admin_all" on public.order_items for all using (public.is_admin()) with check (public.is_admin());

create policy "order_item_options_select_own" on public.order_item_options for select using (
  exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_id and (o.user_id = auth.uid() or public.is_admin())
  )
);
create policy "order_item_options_insert_auth" on public.order_item_options for insert with check (
  exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_id and o.user_id = auth.uid()
  )
);
create policy "order_item_options_admin_all" on public.order_item_options for all using (public.is_admin()) with check (public.is_admin());

-- payments: user reads own; writes happen server-side (service role). Admin reads/updates.
create policy "payments_select_own" on public.payments for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "payments_insert_auth" on public.payments for insert with check (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "payments_admin_all" on public.payments for all using (public.is_admin()) with check (public.is_admin());

-- delivery settings: public read active (needed at checkout); admin write
create policy "delivery_public_read" on public.delivery_settings for select using (is_active or public.is_admin());
create policy "delivery_admin_write" on public.delivery_settings for all using (public.is_admin()) with check (public.is_admin());

-- site settings: public read (bank details, contact info); admin write
create policy "settings_public_read" on public.site_settings for select using (true);
create policy "settings_admin_write" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

-- customer addresses: owner only
create policy "addresses_own" on public.customer_addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reviews: public reads approved; users write own (admin approves)
create policy "reviews_public_read" on public.reviews for select using (is_approved or public.is_admin() or user_id = auth.uid());
create policy "reviews_insert_own" on public.reviews for insert with check (user_id = auth.uid());
create policy "reviews_admin_all" on public.reviews for all using (public.is_admin()) with check (public.is_admin());

-- admin_users: admin only
create policy "admin_users_admin_read" on public.admin_users for select using (public.is_admin());
create policy "admin_users_admin_write" on public.admin_users for all using (public.is_admin()) with check (public.is_admin());

-- cart_state: each customer reads/writes only their own row (writes go through
-- the /api/cart route with the service-role client, but direct RLS access is
-- also allowed for resilience)
create policy "cart_state_own" on public.cart_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- payment_events: admins read the timeline; writes happen server-side only
-- (service-role client from the payment routes)
create policy "payment_events_admin_read" on public.payment_events
  for select using (public.is_admin());

-- ============================================================
-- STORAGE: product-images bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read_storage" on storage.objects;
drop policy if exists "product_images_admin_write_storage" on storage.objects;

create policy "product_images_public_read_storage" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "product_images_admin_write_storage" on storage.objects
  for all using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

-- Custom cake reference images: private bucket; the app uploads via the
-- service-role API route and serves the images through signed URLs.
insert into storage.buckets (id, name, public)
values ('cake-references', 'cake-references', false)
on conflict (id) do nothing;

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','categories','products','orders','payments','delivery_settings'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================
-- Clean up duplicates that older non-idempotent versions of this
-- file may have left behind, then add unique keys so the seed data
-- below never duplicates on re-runs.
-- ============================================================
do $$
begin
  -- keep only the first row of each duplicate set (cascade deletes its values)
  delete from public.product_options po
  using public.product_options b
  where po.product_id = b.product_id and po.name = b.name and po.ctid > b.ctid;

  delete from public.product_option_values v
  using public.product_option_values b
  where v.option_id = b.option_id and v.value = b.value and v.ctid > b.ctid;

  delete from public.product_images i
  using public.product_images b
  where i.product_id = b.product_id and i.url = b.url and i.ctid > b.ctid;

  delete from public.delivery_settings d
  using public.delivery_settings b
  where d.zone_name = b.zone_name and d.ctid > b.ctid;
end $$;

create unique index if not exists idx_product_images_product_url on public.product_images(product_id, url);
create unique index if not exists idx_product_options_product_name on public.product_options(product_id, name);
create unique index if not exists idx_option_values_option_value on public.product_option_values(option_id, value);
create unique index if not exists idx_delivery_settings_zone on public.delivery_settings(zone_name);

-- ============================================================
-- SEED: categories
-- ============================================================
insert into public.categories (name, slug, description, sort_order) values
  ('Birthday Cakes', 'birthday-cakes', 'Celebration cakes for milestone birthdays', 1),
  ('Children''s Cakes', 'childrens-cakes', 'Fun themed cakes for kids'' parties', 2),
  ('Custom Cakes', 'custom-cakes', 'Fully personalised cake designs', 3),
  ('Cupcakes', 'cupcakes', 'Bitesized decorated cupcakes', 4),
  ('Cake Loaf', 'cake-loaf', 'Classic loaf cakes, wrapped and ready', 5),
  ('Uniced Cakes', 'uniced-cakes', 'Simple, delicious cakes without icing', 6),
  ('Donuts', 'donuts', 'Plain, chocolate glazed and jam filled', 7),
  ('Chin Chin', 'chin-chin', 'Crunchy Nigerian favourite', 8),
  ('Cookies', 'cookies', 'Soft-baked cookies', 9),
  ('Small Chops', 'small-chops', 'Party favourites: samosa, spring rolls, puff puff and gizdodo', 10),
  ('Sausage Rolls', 'sausage-rolls', 'Golden, flaky sausage rolls', 11),
  ('Fish Pies', 'fish-pies', 'Savoury fish pies', 12),
  ('Meat Pies', 'meat-pies', 'Classic Nigerian meat pies', 13),
  ('Other Pastries', 'other-pastries', 'Rotating seasonal bakes', 14)
on conflict (slug) do nothing;

-- ============================================================
-- SEED: site settings (edit via admin dashboard)
-- ============================================================
insert into public.site_settings (key, value) values
  ('bank_details', '{"bankName": "", "accountNumber": "", "accountName": ""}'),
  ('contact', '{"phone": "+234 800 000 0000", "whatsapp": "+234 800 000 0000", "email": "orders@jrubiecakes.com", "address": "Street No. 1, Durumi, Abuja 900103, Federal Capital Territory, Nigeria"}'),
  ('business_hours', '{"weekdays": "9:00 AM - 6:00 PM", "sunday": "Closed"}'),
  ('payment_options', '{"paystack": true, "bank_transfer": true, "cash": true}'),
  ('delivery', '{"defaultFee": 2000, "pickupEnabled": true, "leadTimeHours": 48}'),
  ('about_story', '{"heading": "Our story", "story": "Jrubiecakes began in a home kitchen in Abuja with one oven, a whisk and a simple belief: a cake should taste as joyful as the moment it celebrates. Today we bake custom birthday and children\u0027s cakes, cupcakes and Nigerian pastries for families across the capital — still small-batch, still made to order, still with real butter."}')
on conflict (key) do nothing;
on conflict (key) do nothing;

-- ============================================================
-- SEED: delivery zones (adjust fees in admin dashboard)
-- ============================================================
insert into public.delivery_settings (zone_name, states, fee) values
  ('Lagos', array['Lagos'], 3000),
  ('Default', null, 5000)
on conflict (zone_name) do nothing;

-- ============================================================
-- SEED: products from the bakery's real catalogue
-- (prices are placeholders — update in admin dashboard)
-- ============================================================
do $$
declare
  cat_birthday uuid; cat_children uuid; cat_cupcakes uuid; cat_loaf uuid;
  cat_uniced uuid; cat_donuts uuid; cat_chin uuid; cat_cookies uuid;
  cat_smallchops uuid; cat_sausage uuid; cat_fish uuid; cat_meat uuid; cat_custom uuid;
  p_birthday uuid; p_children uuid; p_number uuid; p_cupcake uuid;
  p_gift uuid; p_wedding uuid; p_loaf uuid; p_uniced uuid;
  p_donut uuid; p_meatpie uuid; p_fishpie uuid; p_chin uuid;
  p_cookie uuid; p_smallchops uuid; p_sausage uuid; p_custom uuid;
begin
  select id into cat_birthday from public.categories where slug = 'birthday-cakes';
  select id into cat_children from public.categories where slug = 'childrens-cakes';
  select id into cat_cupcakes from public.categories where slug = 'cupcakes';
  select id into cat_loaf from public.categories where slug = 'cake-loaf';
  select id into cat_uniced from public.categories where slug = 'uniced-cakes';
  select id into cat_donuts from public.categories where slug = 'donuts';
  select id into cat_chin from public.categories where slug = 'chin-chin';
  select id into cat_cookies from public.categories where slug = 'cookies';
  select id into cat_smallchops from public.categories where slug = 'small-chops';
  select id into cat_sausage from public.categories where slug = 'sausage-rolls';
  select id into cat_fish from public.categories where slug = 'fish-pies';
  select id into cat_meat from public.categories where slug = 'meat-pies';
  select id into cat_custom from public.categories where slug = 'custom-cakes';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_birthday, 'Custom Birthday Cake', 'custom-birthday-cake', 'A beautiful personalised birthday cake baked to order. Choose your size, flavour and frosting, and we will add your message on top.', 35000, true, true, null, 1, 48)
  on conflict (slug) do nothing;
  select id into p_birthday from public.products where slug = 'custom-birthday-cake';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_children, 'Children''s Themed Cake', 'childrens-themed-cake', 'A magical themed cake for your little one — princess castles, superheroes, cartoon characters and more. Tell us the theme and we will bring it to life.', 40000, true, true, null, 1, 72)
  on conflict (slug) do nothing;
  select id into p_children from public.products where slug = 'childrens-themed-cake';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_birthday, 'Number Cake', 'number-cake', 'Celebrate the big day with a cake shaped as their age — decorated in buttercream and topped with sprinkles.', 30000, false, true, null, 1, 48)
  on conflict (slug) do nothing;
  select id into p_number from public.products where slug = 'number-cake';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_cupcakes, 'Decorated Cupcakes (Box of 6)', 'decorated-cupcakes-box-6', 'Six beautifully decorated cupcakes — perfect for parties, gifts and office celebrations.', 12000, true, true, 15, 1, 24)
  on conflict (slug) do nothing;
  select id into p_cupcake from public.products where slug = 'decorated-cupcakes-box-6';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_birthday, 'Gift Cake', 'gift-cake', 'A ready-to-give celebration cake, wrapped and finished with a ribbon. A sweet surprise for someone special.', 25000, false, false, 10, 1, 24)
  on conflict (slug) do nothing;
  select id into p_gift from public.products where slug = 'gift-cake';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_birthday, 'Classic White Celebration Cake', 'classic-white-celebration-cake', 'An elegant white iced cake for weddings, anniversaries and milestones.', 60000, false, true, null, 1, 72)
  on conflict (slug) do nothing;
  select id into p_wedding from public.products where slug = 'classic-white-celebration-cake';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_loaf, 'Cake Loaf', 'cake-loaf', 'Soft, buttery loaf cake, neatly wrapped — perfect with tea or as a gift.', 5000, false, false, 15, 1, 24)
  on conflict (slug) do nothing;
  select id into p_loaf from public.products where slug = 'cake-loaf';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_uniced, 'Uniced Cake', 'uniced-cake', 'A simple, delicious cake without icing — all flavour, no fuss.', 6000, false, false, 12, 1, 24)
  on conflict (slug) do nothing;
  select id into p_uniced from public.products where slug = 'uniced-cake';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_donuts, 'Donuts (Box of 6)', 'donuts-box-6', 'Fresh, fluffy donuts — choose plain, chocolate glazed or jam filled.', 4500, true, true, 20, 1, 12)
  on conflict (slug) do nothing;
  select id into p_donut from public.products where slug = 'donuts-box-6';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_meat, 'Meat Pie', 'meat-pie', 'Golden flaky pastry filled with seasoned minced beef, potato and carrot.', 800, false, false, 48, 4, 12)
  on conflict (slug) do nothing;
  select id into p_meatpie from public.products where slug = 'meat-pie';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_fish, 'Fish Pie', 'fish-pie', 'Flaky pastry packed with creamy fish filling.', 1000, false, false, 48, 4, 12)
  on conflict (slug) do nothing;
  select id into p_fishpie from public.products where slug = 'fish-pie';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_chin, 'Chin Chin (Jar)', 'chin-chin-jar', 'Crunchy, sweet and perfectly fried — a Nigerian party classic.', 3000, false, false, 30, 1, 24)
  on conflict (slug) do nothing;
  select id into p_chin from public.products where slug = 'chin-chin-jar';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_cookies, 'Cookies (Pack of 8)', 'cookies-pack-8', 'Soft-baked cookies with chocolate chips — irresistible with milk.', 3500, false, false, 25, 1, 24)
  on conflict (slug) do nothing;
  select id into p_cookie from public.products where slug = 'cookies-pack-8';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_smallchops, 'Small Chops Platter', 'small-chops-platter', 'A generous party platter: samosa, spring rolls, puff puff and gizdodo with pepper sauce.', 15000, true, true, 10, 1, 24)
  on conflict (slug) do nothing;
  select id into p_smallchops from public.products where slug = 'small-chops-platter';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_sausage, 'Sausage Rolls (Pack of 6)', 'sausage-rolls-pack-6', 'Golden, flaky pastry wrapped around juicy sausage.', 4000, false, false, 24, 1, 12)
  on conflict (slug) do nothing;
  select id into p_sausage from public.products where slug = 'sausage-rolls-pack-6';

  insert into public.products (category_id, name, slug, description, price, is_featured, is_customizable, stock_quantity, min_order_quantity, prep_time_hours)
  values (cat_custom, 'Fully Custom Cake', 'fully-custom-cake', 'Your cake, completely your way. Share the occasion, colours and inspiration, and our bakers will design and bake a one-of-a-kind cake for your celebration.', 25000, false, true, null, 1, 72)
  on conflict (slug) do nothing;
  select id into p_custom from public.products where slug = 'fully-custom-cake';

  -- backfill stock for products created by earlier runs of this file
  -- (on conflict do nothing above never updates existing rows)
  update public.products set stock_quantity = 15 where slug = 'decorated-cupcakes-box-6' and stock_quantity is null;
  update public.products set stock_quantity = 10 where slug = 'gift-cake' and stock_quantity is null;
  update public.products set stock_quantity = 15 where slug = 'cake-loaf' and stock_quantity is null;
  update public.products set stock_quantity = 12 where slug = 'uniced-cake' and stock_quantity is null;
  update public.products set stock_quantity = 20 where slug = 'donuts-box-6' and stock_quantity is null;
  update public.products set stock_quantity = 48 where slug = 'meat-pie' and stock_quantity is null;
  update public.products set stock_quantity = 48 where slug = 'fish-pie' and stock_quantity is null;
  update public.products set stock_quantity = 30 where slug = 'chin-chin-jar' and stock_quantity is null;
  update public.products set stock_quantity = 25 where slug = 'cookies-pack-8' and stock_quantity is null;
  update public.products set stock_quantity = 10 where slug = 'small-chops-platter' and stock_quantity is null;
  update public.products set stock_quantity = 24 where slug = 'sausage-rolls-pack-6' and stock_quantity is null;

  -- ---------- product images (local paths; replace with Supabase Storage URLs via admin or seed script) ----------
  insert into public.product_images (product_id, url, alt_text, sort_order) values
    (p_birthday,  '/products/birthday-cake.png',  'Custom birthday cake with pink buttercream', 0),
    (p_children,  '/products/childrens-cake.png', 'Children''s princess themed birthday cake', 0),
    (p_number,    '/products/number-cake.png',    'Number six birthday cake', 0),
    (p_cupcake,   '/products/cupcakes.png',       'Decorated cupcakes in a box', 0),
    (p_gift,      '/products/gift-cake.png',      'Gift wrapped celebration cake', 0),
    (p_wedding,   '/products/wedding-cake.png',   'Classic white celebration cake', 0),
    (p_loaf,      '/products/cake-loaf.png',      'Wrapped cake loaf', 0),
    (p_uniced,    '/products/uniced-cake.png',    'Uniced cake', 0),
    (p_donut,     '/products/donuts.png',         'Tray of fresh donuts', 0),
    (p_meatpie,   '/products/meat-pies.png',      'Tray of Nigerian meat pies', 0),
    (p_fishpie,   '/products/fish-pies.png',      'Box of fish pies', 0),
    (p_chin,      '/products/chin-chin.png',      'Bag of chin chin', 0),
    (p_cookie,    '/products/cookies.png',        'Plate of cookies', 0),
    (p_smallchops,'/products/small-chops.png',    'Small chops platter with puff puff and gizdodo', 0),
    (p_sausage,   '/products/sausage-rolls.png',  'Sausage rolls on a tray', 0),
    (p_custom,    '/products/birthday-cake.png',  'Fully custom celebration cake design', 0),
    (p_children,  '/products/childrens-cake-2.png', 'Children''s themed cake — another design', 1),
    (p_chin,      '/products/chin-chin-2.png',    'Chin chin — close-up', 1),
    (p_meatpie,   '/products/meat-pies-2.png',    'Freshly baked meat pies', 1),
    (p_sausage,   '/products/sausage-rolls-2.png','Golden sausage rolls — another batch', 1),
    (p_smallchops,'/products/puff-puff.png',      'Puff puff from the small chops platter', 1)
  on conflict (product_id, url) do nothing;

  -- ---------- product options: birthday cake ----------
  insert into public.product_options (product_id, name, type, is_required, sort_order) values
    (p_birthday, 'Cake size', 'select', true, 0),
    (p_birthday, 'Flavour', 'select', true, 1),
    (p_birthday, 'Frosting', 'select', true, 2),
    (p_birthday, 'Message on cake', 'text', false, 3),
    (p_birthday, 'Special instructions', 'multiline', false, 4)
  on conflict (product_id, name) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_birthday and name = 'Cake size') o
  cross join (values ('6 inch', 0, 0), ('8 inch', 8000, 1), ('10 inch', 15000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_birthday and name = 'Flavour') o
  cross join (values ('Vanilla', 0, 0), ('Chocolate', 0, 1), ('Red velvet', 2000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_birthday and name = 'Frosting') o
  cross join (values ('Buttercream', 0, 0), ('Fondant', 3000, 1)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  -- ---------- product options: children's cake ----------
  insert into public.product_options (product_id, name, type, is_required, sort_order) values
    (p_children, 'Theme', 'text', true, 0),
    (p_children, 'Cake size', 'select', true, 1),
    (p_children, 'Flavour', 'select', true, 2),
    (p_children, 'Colour', 'text', false, 3),
    (p_children, 'Message on cake', 'text', false, 4),
    (p_children, 'Reference image link', 'text', false, 5)
  on conflict (product_id, name) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_children and name = 'Cake size') o
  cross join (values ('6 inch', 0, 0), ('8 inch', 8000, 1), ('10 inch', 15000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_children and name = 'Flavour') o
  cross join (values ('Vanilla', 0, 0), ('Chocolate', 0, 1), ('Red velvet', 2000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  -- ---------- product options: number cake ----------
  insert into public.product_options (product_id, name, type, is_required, sort_order) values
    (p_number, 'Number', 'text', true, 0),
    (p_number, 'Flavour', 'select', true, 1),
    (p_number, 'Message on cake', 'text', false, 2)
  on conflict (product_id, name) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_number and name = 'Flavour') o
  cross join (values ('Vanilla', 0, 0), ('Chocolate', 0, 1), ('Red velvet', 2000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  -- ---------- product options: cupcakes ----------
  insert into public.product_options (product_id, name, type, is_required, sort_order) values
    (p_cupcake, 'Flavour', 'select', true, 0),
    (p_cupcake, 'Decoration theme', 'text', false, 1),
    (p_cupcake, 'Message on box', 'text', false, 2)
  on conflict (product_id, name) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_cupcake and name = 'Flavour') o
  cross join (values ('Vanilla', 0, 0), ('Chocolate', 0, 1), ('Red velvet', 1000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  -- ---------- product options: donuts ----------
  insert into public.product_options (product_id, name, type, is_required, sort_order) values
    (p_donut, 'Type', 'select', true, 0)
  on conflict (product_id, name) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_donut and name = 'Type') o
  cross join (values ('Plain', 0, 0), ('Chocolate glazed', 500, 1), ('Jam filled', 800, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  -- ---------- product options: small chops ----------
  insert into public.product_options (product_id, name, type, is_required, sort_order) values
    (p_smallchops, 'Platter size', 'select', true, 0),
    (p_smallchops, 'Spice level', 'select', false, 1),
    (p_smallchops, 'Special instructions', 'multiline', false, 2)
  on conflict (product_id, name) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_smallchops and name = 'Platter size') o
  cross join (values ('Standard (10-15 pieces)', 0, 0), ('Large (25-30 pieces)', 8000, 1)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_smallchops and name = 'Spice level') o
  cross join (values ('Mild', 0, 0), ('Hot', 0, 1)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  -- ---------- product options: white celebration cake ----------
  insert into public.product_options (product_id, name, type, is_required, sort_order) values
    (p_wedding, 'Cake size', 'select', true, 0),
    (p_wedding, 'Number of layers', 'select', true, 1),
    (p_wedding, 'Flavour', 'select', true, 2),
    (p_wedding, 'Message on cake', 'text', false, 3),
    (p_wedding, 'Special instructions', 'multiline', false, 4)
  on conflict (product_id, name) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_wedding and name = 'Cake size') o
  cross join (values ('8 inch', 0, 0), ('10 inch', 12000, 1), ('12 inch', 25000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_wedding and name = 'Number of layers') o
  cross join (values ('Single tier', 0, 0), ('Two tiers', 20000, 1), ('Three tiers', 45000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_wedding and name = 'Flavour') o
  cross join (values ('Vanilla', 0, 0), ('Chocolate', 0, 1), ('Red velvet', 3000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  -- ---------- additional customisation options: birthday cake ----------
  insert into public.product_options (product_id, name, type, is_required, sort_order) values
    (p_birthday, 'Filling', 'select', false, 5),
    (p_birthday, 'Cake colour', 'text', false, 6),
    (p_birthday, 'Cake topper', 'select', false, 7),
    (p_birthday, 'Reference image link', 'text', false, 8),
    (p_birthday, 'Requested date', 'date', false, 9)
  on conflict (product_id, name) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_birthday and name = 'Filling') o
  cross join (values ('No filling', 0, 0), ('Vanilla custard', 1500, 1), ('Chocolate ganache', 1500, 2), ('Strawberry jam', 1000, 3)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_birthday and name = 'Cake topper') o
  cross join (values ('No topper', 0, 0), ('Printed topper', 2500, 1), ('Custom figurine', 5000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  -- ---------- additional customisation options: children's cake ----------
  insert into public.product_options (product_id, name, type, is_required, sort_order) values
    (p_children, 'Filling', 'select', false, 6),
    (p_children, 'Frosting', 'select', false, 7),
    (p_children, 'Cake topper', 'select', false, 8),
    (p_children, 'Special instructions', 'multiline', false, 9),
    (p_children, 'Requested date', 'date', false, 10)
  on conflict (product_id, name) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_children and name = 'Filling') o
  cross join (values ('No filling', 0, 0), ('Vanilla custard', 1500, 1), ('Chocolate ganache', 1500, 2), ('Strawberry jam', 1000, 3)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_children and name = 'Frosting') o
  cross join (values ('Buttercream', 0, 0), ('Fondant', 3000, 1)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_children and name = 'Cake topper') o
  cross join (values ('No topper', 0, 0), ('Printed topper', 2500, 1), ('Custom figurine', 5000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  -- ---------- product options: fully custom cake (complete custom set) ----------
  insert into public.product_options (product_id, name, type, is_required, sort_order) values
    (p_custom, 'Cake type', 'select', true, 0),
    (p_custom, 'Cake size', 'select', true, 1),
    (p_custom, 'Flavour', 'select', true, 2),
    (p_custom, 'Filling', 'select', false, 3),
    (p_custom, 'Frosting', 'select', true, 4),
    (p_custom, 'Theme', 'text', false, 5),
    (p_custom, 'Theme description', 'multiline', false, 6),
    (p_custom, 'Cake colour', 'text', false, 7),
    (p_custom, 'Message on cake', 'text', false, 8),
    (p_custom, 'Cake topper', 'select', false, 9),
    (p_custom, 'Reference image link', 'text', false, 10),
    (p_custom, 'Special instructions', 'multiline', false, 11),
    (p_custom, 'Requested date', 'date', false, 12)
  on conflict (product_id, name) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_custom and name = 'Cake type') o
  cross join (values ('Birthday cake', 0, 0), ('Children''s cake', 0, 1), ('Celebration cake', 0, 2), ('Other', 0, 3)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_custom and name = 'Cake size') o
  cross join (values ('6 inch', 0, 0), ('8 inch', 8000, 1), ('10 inch', 15000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_custom and name = 'Flavour') o
  cross join (values ('Vanilla', 0, 0), ('Chocolate', 0, 1), ('Red velvet', 2000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_custom and name = 'Filling') o
  cross join (values ('No filling', 0, 0), ('Vanilla custard', 1500, 1), ('Chocolate ganache', 1500, 2), ('Strawberry jam', 1000, 3)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_custom and name = 'Frosting') o
  cross join (values ('Buttercream', 0, 0), ('Fondant', 3000, 1)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;

  insert into public.product_option_values (option_id, value, price_delta, sort_order)
  select o.id, v.val, v.delta, v.ord
  from (select id from public.product_options where product_id = p_custom and name = 'Cake topper') o
  cross join (values ('No topper', 0, 0), ('Printed topper', 2500, 1), ('Custom figurine', 5000, 2)) as v(val, delta, ord)
  on conflict (option_id, value) do nothing;
end $$;
