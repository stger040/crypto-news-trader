import OpenAI from "openai";
import { getJson, setJson } from "./redis";
import { hashContent } from "./hash";
import type { SentimentResult } from "./types";

const SYSTEM_PROMPT = `You are a crypto market sentiment classifier. Given a headline or post title, respond only with a JSON object: 
{score: number from -1.0 to 1.0, 
confidence: number from 0 to 1,
category: one of [bullish, bearish, neutral, fud, hype, regulatory_positive, regulatory_negative, hack_exploit, listing_announcement, macro],
affectedPairs: string[] of relevant trading pairs from [BTC,ETH,SOL,LINK,AVAX,DOT]}`;

const SCORE_TTL = 3600;

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required");
  return new OpenAI({ apiKey });
}

export async function getCachedSentiment(
  text: string
): Promise<SentimentResult | null> {
  const h = hashContent(text);
  return getJson<SentimentResult>(`score:${h}`);
}

export async function scoreSentiment(text: string): Promise<SentimentResult> {
  const cached = await getCachedSentiment(text);
  if (cached) return cached;

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as SentimentResult;

  const result: SentimentResult = {
    score: Math.max(-1, Math.min(1, Number(parsed.score) || 0)),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
    category: parsed.category ?? "neutral",
    affectedPairs: (parsed.affectedPairs ?? []).filter((p) =>
      ["BTC", "ETH", "SOL", "LINK", "AVAX", "DOT"].includes(p)
    ) as SentimentResult["affectedPairs"],
  };

  const h = hashContent(text);
  await setJson(`score:${h}`, result, SCORE_TTL);
  return result;
}

export async function scoreHeadlines(
  headlines: string[]
): Promise<Map<string, SentimentResult>> {
  const map = new Map<string, SentimentResult>();
  const unique = Array.from(new Set(headlines.filter(Boolean)));

  await Promise.all(
    unique.map(async (headline) => {
      try {
        const score = await scoreSentiment(headline);
        map.set(headline, score);
      } catch (e) {
        console.error("Sentiment scoring failed:", headline, e);
      }
    })
  );

  return map;
}
