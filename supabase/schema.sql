create table if not exists public.products (
  id bigint primary key,
  name text not null,
  description text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  category text not null,
  affiliate_url text not null,
  emoji text not null default '🛍️',
  image_url text not null default '',
  image_urls text[] not null default '{}',
  sizes text[] not null default '{}',
  available boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
revoke all on table public.products from anon, authenticated;
grant select, insert, update, delete on table public.products to service_role;

create or replace function public.replace_4kings_products(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if jsonb_typeof(payload) is distinct from 'array' then
    raise exception 'Invalid product payload';
  end if;
  if jsonb_array_length(payload) > 500 then
    raise exception 'Invalid product payload';
  end if;

  delete from public.products as stored
  where not exists (
    select 1
    from jsonb_array_elements(payload) as incoming(item)
    where (item->>'id')::bigint = stored.id
  );

  insert into public.products (
    id, name, description, price, category, affiliate_url, emoji,
    image_url, image_urls, sizes, available, updated_at
  )
  select
    (item->>'id')::bigint,
    item->>'name',
    coalesce(item->>'description', ''),
    (item->>'price')::numeric(12, 2),
    item->>'category',
    item->>'affiliate_url',
    coalesce(item->>'emoji', '🛍️'),
    coalesce(item->>'image_url', ''),
    array(select jsonb_array_elements_text(coalesce(item->'image_urls', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(item->'sizes', '[]'::jsonb))),
    coalesce((item->>'available')::boolean, true),
    now()
  from jsonb_array_elements(payload) as incoming(item)
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    category = excluded.category,
    affiliate_url = excluded.affiliate_url,
    emoji = excluded.emoji,
    image_url = excluded.image_url,
    image_urls = excluded.image_urls,
    sizes = excluded.sizes,
    available = excluded.available,
    updated_at = now();
end;
$$;

revoke all on function public.replace_4kings_products(jsonb) from public, anon, authenticated;
grant execute on function public.replace_4kings_products(jsonb) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  2097152,
  array['image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
