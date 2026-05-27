import { getArticleById, getArticlesNearTime } from "./db";

export async function isCorroborated(
  articleId: number,
  windowMinutes = 30
): Promise<boolean> {
  const article = await getArticleById(articleId);
  if (!article || article.sentiment_score == null) return false;

  const score = Number(article.sentiment_score);
  const direction = score > 0.3 ? "bull" : score < -0.3 ? "bear" : "neutral";
  if (direction === "neutral") return false;

  const pairs = article.affected_pairs ?? [];
  if (!pairs.length) return false;

  const publishedAt = new Date(article.published_at);
  const nearby = await getArticlesNearTime(publishedAt, windowMinutes);

  for (const other of nearby) {
    if (other.id === articleId) continue;
    if (other.source === article.source) continue;
    if (other.sentiment_score == null) continue;

    const otherScore = Number(other.sentiment_score);
    const sameDirection =
      direction === "bull" ? otherScore > 0.3 : otherScore < -0.3;
    if (!sameDirection) continue;

    const otherPairs = other.affected_pairs ?? [];
    if (pairs.some((p) => otherPairs.includes(p))) return true;
  }

  return false;
}
