export type Weights = { edital: number; frequency: number; errors: number; overdue: number };
export const defaultWeights: Weights = { edital: 30, frequency: 25, errors: 25, overdue: 20 };
export function priority(weight: number, frequency: number, errorRate: number, overdue: boolean, w = defaultWeights) {
  const raw = (weight / 40) * w.edital + (frequency / 100) * w.frequency + (errorRate / 100) * w.errors + (overdue ? w.overdue : 0);
  return Math.max(0, Math.min(100, Math.round(raw / (w.edital + w.frequency + w.errors + w.overdue) * 100)));
}
export function nextReview(rating: "Errei" | "Difícil" | "Bom" | "Fácil", now = new Date()) {
  const days = rating === "Errei" ? 1 : rating === "Difícil" ? 7 : rating === "Bom" ? 14 : 30;
  const date = new Date(now); date.setDate(date.getDate() + days); return date.toISOString();
}
export function createSchedule(names: string[], weekdays: number[], hours: number, start = new Date(), end?: Date) {
  const fallback = new Date(start); fallback.setDate(fallback.getDate() + 90); const limit = end && end > start ? end : fallback;
  const rows: { date: string; topic: string; theory: number; questions: number; review: number }[] = []; const cursor = new Date(start); let i = 0;
  while (cursor <= limit && rows.length < 120) { if (weekdays.includes(cursor.getDay())) { const mins = Math.max(30, hours * 60); rows.push({ date: cursor.toISOString(), topic: names[i++ % names.length], theory: Math.round(mins*.4), questions: Math.round(mins*.4), review: Math.round(mins*.2) }); } cursor.setDate(cursor.getDate()+1); }
  return rows;
}
