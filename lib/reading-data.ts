import { type ReadingDataset, type RedBook, type RedProgressEntry } from "@/lib/red-types";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const EMPTY_DATASET: ReadingDataset = {
  books: [],
  entries: [],
  dates: [],
  firstDate: null,
  lastDate: null,
  error: null,
};

export async function getReadingDataset(): Promise<ReadingDataset> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return {
      ...EMPTY_DATASET,
      error:
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment variables.",
    };
  }

  const [booksResult, entriesResult] = await Promise.all([
    supabase
      .from("red_books")
      .select("id, title, author, image_url, created_at")
      .order("title", { ascending: true }),
    supabase
      .from("red_progress_entries")
      .select("id, book_id, entry_date, eod_percentage, thoughts, flashcards_count, created_at")
      .order("entry_date", { ascending: true }),
  ]);

  if (booksResult.error || entriesResult.error) {
    return {
      ...EMPTY_DATASET,
      error: [booksResult.error?.message, entriesResult.error?.message]
        .filter(Boolean)
        .join(" | "),
    };
  }

  const books: RedBook[] = (booksResult.data ?? []) as RedBook[];
  const entries: RedProgressEntry[] = ((entriesResult.data ?? []) as RedProgressEntry[]).map(
    (entry) => ({
      ...entry,
      thoughts: Array.isArray(entry.thoughts) ? entry.thoughts : [],
    }),
  );

  const dates = [...new Set(entries.map((entry) => entry.entry_date))].sort();

  return {
    books,
    entries,
    dates,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    error: null,
  };
}
