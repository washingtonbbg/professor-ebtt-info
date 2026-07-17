import { NextRequest, NextResponse } from "next/server";
import type { Question } from "../../../data";

export const dynamic = "force-dynamic";

const questionSchema = {
  type: "object", additionalProperties: false,
  required: ["area", "topic", "difficulty", "prompt", "options", "answer", "explanation", "wrong", "sourceNote"],
  properties: {
    area: { type: "string" }, topic: { type: "string" }, difficulty: { type: "string", enum: ["Fácil", "Média", "Difícil"] },
    prompt: { type: "string" }, options: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } },
    answer: { type: "integer", minimum: 0, maximum: 4 }, explanation: { type: "string" },
    wrong: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } }, sourceNote: { type: "string" },
  },
};

const schema = {
  type: "object", additionalProperties: false, required: ["changed", "summary", "issues", "question"],
  properties: {
    changed: { type: "boolean" }, summary: { type: "string" },
    issues: { type: "array", items: { type: "string" }, maxItems: 6 }, question: questionSchema,
  },
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { question?: Question } | null;
  const question = body?.question;
  if (!question || !Number.isInteger(question.id) || !Array.isArray(question.options) || question.options.length !== 5) return NextResponse.json({ error: "invalid_question" }, { status: 400 });
  const runtime = await import("cloudflare:workers").catch(() => null);
  const key = (runtime?.env as unknown as Record<string, string | undefined> | undefined)?.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "missing_key" }, { status: 503 });
  const prompt = `Revise tecnicamente esta questão de concurso EBTT. Recalcule códigos, fórmulas e afirmações passo a passo. ` +
    `Confirme que existe exatamente uma alternativa correta, que answer aponta para ela e que explanation e wrong são coerentes. ` +
    `Corrija apenas o necessário, preserve tema, dificuldade, cinco alternativas e idioma português. Não confie no gabarito recebido. ` +
    `sourceNote deve informar que a questão foi revisada por IA e exige validação humana em temas jurídicos ou normativos.\n${JSON.stringify(question)}`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-5.4-mini", input: prompt, max_output_tokens: 2200, reasoning: { effort: "low" }, text: { format: { type: "json_schema", name: "question_review", strict: true, schema } } }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
      return NextResponse.json({ error: failure.error?.code ?? failure.error?.type ?? "review_failed" }, { status: response.status });
    }
    const result = await response.json() as { output?: { content?: { type?: string; text?: string }[] }[] };
    const outputText = result.output?.flatMap((item) => item.content ?? []).find((content) => content.type === "output_text")?.text;
    const reviewed = JSON.parse(outputText ?? "{}") as { changed?: boolean; summary?: string; issues?: string[]; question?: Omit<Question, "id"> };
    if (!reviewed.question) throw new Error("empty_review");
    return NextResponse.json({ ...reviewed, question: { ...reviewed.question, id: question.id } });
  } catch { return NextResponse.json({ error: "review_failed" }, { status: 502 }); }
}
