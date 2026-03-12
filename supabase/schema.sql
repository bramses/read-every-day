create extension if not exists pgcrypto;

create table if not exists public.red_books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  image_url text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.red_progress_entries (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.red_books(id) on delete cascade,
  entry_date date not null,
  eod_percentage integer not null check (eod_percentage >= 0 and eod_percentage <= 100),
  thoughts text[] not null default '{}',
  flashcards_count integer not null default 0 check (flashcards_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (book_id, entry_date)
);

create index if not exists red_progress_entries_entry_date_idx
  on public.red_progress_entries (entry_date);

create index if not exists red_progress_entries_book_id_idx
  on public.red_progress_entries (book_id);

alter table public.red_books enable row level security;
alter table public.red_progress_entries enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'red_books'
      and policyname = 'red_books_select_all'
  ) then
    create policy "red_books_select_all"
      on public.red_books
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'red_books'
      and policyname = 'red_books_insert_all'
  ) then
    create policy "red_books_insert_all"
      on public.red_books
      for insert
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'red_progress_entries'
      and policyname = 'red_progress_entries_select_all'
  ) then
    create policy "red_progress_entries_select_all"
      on public.red_progress_entries
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'red_progress_entries'
      and policyname = 'red_progress_entries_insert_all'
  ) then
    create policy "red_progress_entries_insert_all"
      on public.red_progress_entries
      for insert
      with check (true);
  end if;
end
$$;
