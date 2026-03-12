export type RedBook = {
  id: string;
  title: string;
  author: string;
  image_url: string;
  created_at: string;
};

export type RedProgressEntry = {
  id: string;
  book_id: string;
  entry_date: string;
  eod_percentage: number;
  thoughts: string[];
  flashcards_count: number;
  created_at: string;
};

export type ReadingDataset = {
  books: RedBook[];
  entries: RedProgressEntry[];
  dates: string[];
  firstDate: string | null;
  lastDate: string | null;
  error: string | null;
};
