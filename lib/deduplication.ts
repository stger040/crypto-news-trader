import { getArticlesNearTime } from "./db";

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "as", "it", "its", "this", "that", "after", "over", "into", "about",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let intersection = 0;
  a.forEach((w) => {
    if (b.has(w)) intersection++;
  });
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

export async function isDuplicate(
  title: string,
  publishedAt: Date
): Promise<boolean> {
  const nearby = await getArticlesNearTime(publishedAt, 60);
  const wordsA = significantWords(title);

  for (const article of nearby) {
    const wordsB = significantWords(article.title);
    if (jaccardSimilarity(wordsA, wordsB) > 0.6) return true;
  }

  return false;
}
