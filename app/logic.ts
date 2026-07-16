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

export type AttemptRecord = { topic: string; isCorrect: boolean; answeredAt: string };
export type StudyRecord = { id: string; date: string; minutes: number };
const dateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

export function weeklyEvolution(attempts: AttemptRecord[], now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const key = dateKey(date);
    const answered = attempts.filter((attempt) => dateKey(new Date(attempt.answeredAt)) === key).length;
    return { d: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", ""), q: answered, date: key };
  });
}

export function adaptiveLoad(attempts: AttemptRecord[], baseMinutes: number, examDate: string, now = new Date()) {
  const start = new Date(now); start.setDate(start.getDate() - 7);
  const recent = attempts.filter((attempt) => new Date(attempt.answeredAt) >= start);
  const accuracy = recent.length ? Math.round(recent.filter((attempt) => attempt.isCorrect).length / recent.length * 100) : null;
  const daysRemaining = Math.max(0, Math.ceil((new Date(`${examDate}T14:00:00-04:00`).getTime() - now.getTime()) / 86400000));
  const urgency = daysRemaining <= 14 ? 1.4 : daysRemaining <= 30 ? 1.2 : 1;
  const performanceBoost = accuracy === null ? 0.1 : Math.max(0, (75 - accuracy) / 100);
  const recommendedMinutes = Math.min(360, Math.ceil(baseMinutes * (urgency + performanceBoost) / 15) * 15);
  const questionTarget = Math.min(80, Math.max(15, Math.ceil(recommendedMinutes * .35 / 2 * (1 + performanceBoost))));
  return { accuracy, daysRemaining, recommendedMinutes, questionTarget, recentQuestions: recent.length };
}

export function todayStudyMinutes(records: StudyRecord[], now = new Date()) {
  const today = dateKey(now);
  return records.filter((record) => dateKey(new Date(record.date)) === today).reduce((sum, record) => sum + record.minutes, 0);
}
