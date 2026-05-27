import OpenAI from "openai";
import {
  getUnprocessedArticles,
  updateArticleSentiment,
} from "./db";
import type { SentimentResult } from "./types";

const SYSTEM_PROMPT = `You are a crypto market sentiment classifier. Given a headline or post title, respond ONLY with valid JSON and nothing else — no markdown, no explanation:
{
  score: number from -1.0 to 1.0,
  confidence: number from 0 to 1,
  category: one of: bullish, bearish, neutral, fud, hype,
    regulatory_positive, regulatory_negative,
    hack_exploit, listing_announcement, macro_event,
  affectedPairs: array containing only values from:
    [BTC, ETH, SOL, LINK, AVAX, DOT]
}`;

const VALID_PAIRS = new Set(["BTC", "ETH", "SOL", "LINK", "AVAX", "DOT"]);
const BATCH_SIZE = 10;

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY required");
  return new OpenAI({ apiKey: key });
}

function parseResult(raw: string): SentimentResult {
  const parsed = JSON.parse(raw) as SentimentResult;
  return {
    score: Math.max(-1, Math.min(1, Number(parsed.score) || 0)),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
    category: parsed.category ?? "neutral",
    affectedPairs: (parsed.affectedPairs ?? []).filter((p) =>
      VALID_PAIRS.has(p)
    ) as SentimentResult["affectedPairs"],
  };
}

export async function scoreSentiment(title: string): Promise<SentimentResult> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: title },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return parseResult(raw);
}

export async function scoreUnprocessedArticles(): Promise<number> {
  const articles = await getUnprocessedArticles(100);
  if (!articles.length) return 0;

  let scored = 0;
  const openai = getOpenAI();

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (article) => {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: article.title },
            ],
          });

          const raw = completion.choices[0]?.message?.content ?? "{}";
          const result = parseResult(raw);

          await updateArticleSentiment(
            article.id,
            result.score,
            result.category,
            result.confidence,
            result.affectedPairs
          );
          scored++;
        } catch (e) {
          console.error("Score failed for article", article.id, e);
        }
      })
    );
  }

  return scored;
}
