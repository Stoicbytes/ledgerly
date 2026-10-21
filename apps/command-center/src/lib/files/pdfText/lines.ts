import type { TextRun } from './content';

/** A word on a page line: where it starts and ends (points) and how it is set. */
export type TextWord = { text: string; x: number; end: number; size: number; bold: boolean };
/** One line of a page, top to bottom; words left to right. */
export type TextLine = { page: number; y: number; words: TextWord[] };

/** Runs split at spaces, each word placed by its share of the run's width. */
function words(run: TextRun): TextWord[] {
  const out: TextWord[] = [];
  const chars = run.text.length || 1;
  for (const match of run.text.matchAll(/\S+/g)) {
    const start = match.index ?? 0;
    out.push({
      text: match[0],
      x: run.x + (run.width * start) / chars,
      end: run.x + (run.width * (start + match[0].length)) / chars,
      size: run.size,
      bold: run.bold,
    });
  }
  return out;
}

/**
 * Groups a page's runs into lines (same baseline, within 40% of the type size) and joins
 * pieces of one word that were drawn separately (kerning, one glyph at a time).
 */
export function toLines(runs: TextRun[], page: number): TextLine[] {
  const sorted = runs.filter((run) => run.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; size: number; runs: TextRun[] }[] = [];
  for (const run of sorted) {
    const line = lines.find(
      (item) => Math.abs(item.y - run.y) <= Math.max(item.size, run.size, 1) * 0.4,
    );
    if (line) {
      line.runs.push(run);
      line.size = Math.max(line.size, run.size);
    } else lines.push({ y: run.y, size: run.size, runs: [run] });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const all = line.runs.flatMap(words).sort((a, b) => a.x - b.x);
      const joined: TextWord[] = [];
      for (const word of all) {
        const last = joined[joined.length - 1];
        if (last && word.x - last.end < Math.max(last.size, 1) * 0.12 && word.x >= last.x) {
          joined[joined.length - 1] = {
            ...last,
            text: last.text + word.text,
            end: Math.max(last.end, word.end),
          };
        } else joined.push(word);
      }
      return { page, y: line.y, words: joined };
    });
}
