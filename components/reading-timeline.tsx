"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";

import { type ReadingDataset, type RedBook, type RedProgressEntry } from "@/lib/red-types";

type ReadingTimelineProps = {
  data: ReadingDataset;
};

type ThoughtsModalState = {
  bookTitle: string;
  entryDate: string;
  thoughts: string[];
};

type ActiveSlot = {
  book: RedBook;
  entry: RedProgressEntry;
  delta: number;
};

const MAX_VISIBLE_BOOKS = 5;
const FALLBACK_BAR_COLOR = "#6c6c6c";

function formatDbDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return date;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function extractDominantNonWhiteColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve(FALLBACK_BAR_COLOR);
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 48;
        canvas.width = size;
        canvas.height = size;

        const context = canvas.getContext("2d", { willReadFrequently: true });

        if (!context) {
          resolve(FALLBACK_BAR_COLOR);
          return;
        }

        context.drawImage(image, 0, 0, size, size);
        const { data } = context.getImageData(0, 0, size, size);

        const buckets = new Map<string, { r: number; g: number; b: number; weight: number }>();

        for (let index = 0; index < data.length; index += 16) {
          const r = data[index] ?? 0;
          const g = data[index + 1] ?? 0;
          const b = data[index + 2] ?? 0;
          const alpha = data[index + 3] ?? 0;

          if (alpha < 100) {
            continue;
          }

          if (r > 240 && g > 240 && b > 240) {
            continue;
          }

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max - min;
          const whitenessDistance = 255 - (r + g + b) / 3;
          const weight = 1 + saturation / 255 + whitenessDistance / 255;

          const bucketKey = `${Math.floor(r / 24)}-${Math.floor(g / 24)}-${Math.floor(b / 24)}`;
          const current = buckets.get(bucketKey);

          if (current) {
            current.r += r * weight;
            current.g += g * weight;
            current.b += b * weight;
            current.weight += weight;
          } else {
            buckets.set(bucketKey, {
              r: r * weight,
              g: g * weight,
              b: b * weight,
              weight,
            });
          }
        }

        let winner: { r: number; g: number; b: number; weight: number } | null = null;

        for (const value of buckets.values()) {
          if (!winner || value.weight > winner.weight) {
            winner = value;
          }
        }

        if (!winner || winner.weight <= 0) {
          resolve(FALLBACK_BAR_COLOR);
          return;
        }

        const dominantR = Math.round(winner.r / winner.weight);
        const dominantG = Math.round(winner.g / winner.weight);
        const dominantB = Math.round(winner.b / winner.weight);
        resolve(`rgb(${dominantR}, ${dominantG}, ${dominantB})`);
      } catch {
        resolve(FALLBACK_BAR_COLOR);
      }
    };

    image.onerror = () => {
      resolve(FALLBACK_BAR_COLOR);
    };

    image.src = imageUrl;
  });
}

export function ReadingTimeline({ data }: ReadingTimelineProps) {
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(data.dates.length - 1, 0));
  const [modalState, setModalState] = useState<ThoughtsModalState | null>(null);
  const [barColorByBook, setBarColorByBook] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function hydrateBarColors() {
      const missingBooks = data.books.filter((book) => !barColorByBook[book.id]);

      if (missingBooks.length === 0) {
        return;
      }

      const updates = await Promise.all(
        missingBooks.map(async (book) => {
          const color = await extractDominantNonWhiteColor(book.image_url);
          return [book.id, color] as const;
        }),
      );

      if (cancelled) {
        return;
      }

      setBarColorByBook((previous) => {
        const next = { ...previous };

        for (const [bookId, color] of updates) {
          if (!next[bookId]) {
            next[bookId] = color;
          }
        }

        return next;
      });
    }

    hydrateBarColors();

    return () => {
      cancelled = true;
    };
  }, [barColorByBook, data.books]);

  useEffect(() => {
    if (!modalState) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalState(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalState]);

  const maxSliderIndex = Math.max(data.dates.length - 1, 0);
  const boundedSelectedIndex = Math.min(selectedIndex, maxSliderIndex);
  const selectedDate = data.dates[boundedSelectedIndex] ?? null;

  const deltaByKey = useMemo(() => {
    const entriesForBook = new Map<string, RedProgressEntry[]>();
    const deltaLookup = new Map<string, number>();

    for (const entry of data.entries) {
      const existing = entriesForBook.get(entry.book_id) ?? [];
      existing.push(entry);
      entriesForBook.set(entry.book_id, existing);
    }

    for (const [, bookEntries] of entriesForBook) {
      bookEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date));

      let previousPercentage: number | null = null;

      for (const entry of bookEntries) {
        const delta = previousPercentage === null ? 0 : entry.eod_percentage - previousPercentage;
        deltaLookup.set(`${entry.book_id}:${entry.entry_date}`, delta);
        previousPercentage = entry.eod_percentage;
      }
    }

    return deltaLookup;
  }, [data.entries]);

  const slotsByDate = useMemo(() => {
    const bookById = new Map(data.books.map((book) => [book.id, book]));
    const entriesByDate = new Map<string, RedProgressEntry[]>();

    for (const entry of data.entries) {
      const existing = entriesByDate.get(entry.entry_date) ?? [];
      existing.push(entry);
      entriesByDate.set(entry.entry_date, existing);
    }

    const result = new Map<string, Array<ActiveSlot | null>>();
    const slotToBook: Array<string | null> = new Array(MAX_VISIBLE_BOOKS).fill(null);
    const bookToSlot = new Map<string, number>();

    for (const date of data.dates) {
      const dayEntries = (entriesByDate.get(date) ?? [])
        .slice()
        .sort((left, right) => {
          const leftTitle = bookById.get(left.book_id)?.title ?? "";
          const rightTitle = bookById.get(right.book_id)?.title ?? "";
          return leftTitle.localeCompare(rightTitle);
        })
        .slice(0, MAX_VISIBLE_BOOKS);

      const activeBookIds = new Set(dayEntries.map((entry) => entry.book_id));

      for (let slotIndex = 0; slotIndex < MAX_VISIBLE_BOOKS; slotIndex += 1) {
        const occupyingBookId = slotToBook[slotIndex];

        if (!occupyingBookId) {
          continue;
        }

        if (!activeBookIds.has(occupyingBookId)) {
          slotToBook[slotIndex] = null;
          bookToSlot.delete(occupyingBookId);
        }
      }

      for (const entry of dayEntries) {
        if (bookToSlot.has(entry.book_id)) {
          continue;
        }

        const emptySlot = slotToBook.indexOf(null);

        if (emptySlot === -1) {
          continue;
        }

        slotToBook[emptySlot] = entry.book_id;
        bookToSlot.set(entry.book_id, emptySlot);
      }

      const daySlots: Array<ActiveSlot | null> = new Array(MAX_VISIBLE_BOOKS).fill(null);

      for (const entry of dayEntries) {
        const slotIndex = bookToSlot.get(entry.book_id);

        if (slotIndex === undefined) {
          continue;
        }

        const book = bookById.get(entry.book_id);

        if (!book) {
          continue;
        }

        daySlots[slotIndex] = {
          book,
          entry,
          delta: deltaByKey.get(`${entry.book_id}:${entry.entry_date}`) ?? 0,
        };
      }

      result.set(date, daySlots);
    }

    return result;
  }, [data.books, data.dates, data.entries, deltaByKey]);

  const emptySlots = useMemo(() => new Array<ActiveSlot | null>(MAX_VISIBLE_BOOKS).fill(null), []);
  const currentSlots = selectedDate ? (slotsByDate.get(selectedDate) ?? emptySlots) : emptySlots;
  const previousDate = boundedSelectedIndex > 0 ? (data.dates[boundedSelectedIndex - 1] ?? null) : null;
  const previousSlots = previousDate ? (slotsByDate.get(previousDate) ?? emptySlots) : emptySlots;

  return (
    <div className="timeline-app">
      <main className="timeline-main">
        <header className="timeline-header">
          <h1 className="timeline-title">Read. Every Day.</h1>
          <div className="timeline-header-nav">
            <button
              type="button"
              className="day-nav-button"
              onClick={() => setSelectedIndex((index) => Math.max(index - 1, 0))}
              disabled={boundedSelectedIndex <= 0}
            >
              Previous Day
            </button>
            <p className="timeline-date">{selectedDate ? formatDbDate(selectedDate) : "No reading days yet"}</p>
            <button
              type="button"
              className="day-nav-button"
              onClick={() => setSelectedIndex((index) => Math.min(index + 1, maxSliderIndex))}
              disabled={boundedSelectedIndex >= maxSliderIndex}
            >
              Next Day
            </button>
          </div>
        </header>

        {data.error ? <p className="timeline-error">{data.error}</p> : null}

        <section className="book-list">
          {currentSlots.map((slot, slotIndex) => {
            const previousSlot = previousSlots[slotIndex];
            const isNewBook = Boolean(slot && (!previousSlot || previousSlot.book.id !== slot.book.id));
            const wasVacated = Boolean(!slot && previousSlot);

            return (
              <article
                key={`slot-${slotIndex}`}
                className={`book-row ${slot ? "book-row--active" : "book-row--empty"} ${
                  isNewBook ? "book-row--enter" : ""
                } ${wasVacated ? "book-row--leave" : ""}`}
              >
                {slot ? (
                  <>
                    <div className="book-cover-wrap">
                      <img
                        src={slot.book.image_url || "/file.svg"}
                        alt={`${slot.book.title} cover`}
                        className="book-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="book-main">
                      <div className="progress-track" aria-hidden="true">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${slot.entry.eod_percentage}%`,
                            backgroundColor: barColorByBook[slot.book.id] ?? FALLBACK_BAR_COLOR,
                          }}
                        />
                      </div>
                      <p className="book-title">{slot.book.title}</p>
                      <p className="book-author">{slot.book.author}</p>
                    </div>

                    <div className="book-stats">
                      <p className="percent-block">
                        <span
                          key={`${slot.book.id}-${selectedDate}-percentage`}
                          className="percent-value value-pop"
                        >
                          {slot.entry.eod_percentage}%
                        </span>
                        <span
                          key={`${slot.book.id}-${selectedDate}-delta`}
                          className={`percent-delta ${
                            slot.delta > 0
                              ? "percent-delta--up"
                              : slot.delta < 0
                                ? "percent-delta--down"
                                : ""
                          } value-pop`}
                        >
                          ({slot.delta >= 0 ? `+${slot.delta}` : `${slot.delta}`}%)
                        </span>
                      </p>

                      <button
                        type="button"
                        className="thoughts-button"
                        onClick={() =>
                          setModalState({
                            bookTitle: slot.book.title,
                            entryDate: slot.entry.entry_date,
                            thoughts: slot.entry.thoughts,
                          })
                        }
                      >
                        +{slot.entry.thoughts.length} Thoughts
                      </button>

                      <p className="flashcards-count">
                        {slot.entry.flashcards_count} Flashcard
                        {slot.entry.flashcards_count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="book-cover-wrap">
                      <div className="book-cover-empty" />
                    </div>

                    <div className="book-main book-main--empty">
                      <p className="book-nothing">nothing</p>
                    </div>

                    <div className="book-stats book-stats--empty" />
                  </>
                )}
              </article>
            );
          })}
        </section>
      </main>

      <footer className="timeline-footer">
        <div className="timeline-labels">
          <span>{data.firstDate ? formatDbDate(data.firstDate) : "First Day in DB"}</span>
          <span>{data.lastDate ? formatDbDate(data.lastDate) : "Last Day in DB"}</span>
        </div>

        <input
          className="timeline-slider"
          type="range"
          min={0}
          max={maxSliderIndex}
          value={boundedSelectedIndex}
          onChange={(event) => setSelectedIndex(Number(event.target.value))}
          disabled={data.dates.length <= 1}
          aria-label="Reading timeline"
        />
      </footer>

      {modalState ? (
        <div className="thoughts-modal-backdrop" onClick={() => setModalState(null)}>
          <div className="thoughts-modal" onClick={(event) => event.stopPropagation()}>
            <div className="thoughts-modal-header">
              <h2>{modalState.bookTitle}</h2>
              <button
                type="button"
                className="thoughts-modal-close"
                onClick={() => setModalState(null)}
              >
                Close
              </button>
            </div>
            <p className="thoughts-modal-date">{formatDbDate(modalState.entryDate)}</p>

            {modalState.thoughts.length === 0 ? (
              <p className="thoughts-empty">No thoughts saved for this day.</p>
            ) : (
              <ul className="thought-list">
                {modalState.thoughts.map((thought, index) => (
                  <li key={`${modalState.entryDate}-${index}`} className="thought-item">
                    {thought}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
