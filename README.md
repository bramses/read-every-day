# Read Every Day

Next.js + Supabase reading tracker with:
- `red_`-prefixed Supabase tables
- book metadata (`title`, `author`, `image_url`)
- daily rows (`book_id`, `entry_date`, `eod_percentage`, `thoughts[]`, `flashcards_count`)
- timeline slider from first DB day to last DB day
- animated day-to-day progress + thoughts modal

## 1) Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 2) Supabase schema

Run [`supabase/schema.sql`](/Users/bram/Dropbox/PARA/Projects/read-every-day/supabase/schema.sql) in the Supabase SQL editor.

Tables:
- `public.red_books`
- `public.red_progress_entries`

## 3) Run app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 4) Insert data examples

```sql
insert into public.red_books (title, author, image_url)
values
  ('Virtue Hoarders', 'Catherine Liu', 'https://example.com/virtue-hoarders.jpg'),
  ('Italian Villas & Their Gardens', 'Edith Wharton', 'https://example.com/italian-villas.jpg');

insert into public.red_progress_entries (book_id, entry_date, eod_percentage, thoughts, flashcards_count)
values
  ('BOOK_UUID_1', '2026-03-01', 58, array['Strong chapter on class framing', 'Need to revisit intro'], 0),
  ('BOOK_UUID_2', '2026-03-01', 30, array[]::text[], 3);
```

`red_progress_entries` enforces one row per book/day (`unique(book_id, entry_date)`).
