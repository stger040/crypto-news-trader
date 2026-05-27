import { getPairArticleCounts } from "./db";

export async function getVelocityMultiplier(pair: string): Promise<number> {
  const { recent1h, baseline7dHourly } = await getPairArticleCounts(pair);
  const baseline = Math.max(baseline7dHourly, 1);
  const multiplier = recent1h / baseline;
  return Math.min(multiplier, 5.0);
}

export function boostConfidence(
  confidence: number,
  velocityMultiplier: number
): number {
  const boost = Math.min(1.0 + (velocityMultiplier - 1) * 0.1, 1.3);
  return Math.min(confidence * boost, 1.0);
}
