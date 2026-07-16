import { NextRequest, NextResponse } from "next/server";
import { questions, topics, type Question } from "../../data";

export const dynamic = "force-dynamic";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["area", "topic", "difficulty", "prompt", "options", "answer", "explanation", "wrong", "sourceNote"],
        properties: {
          area: { type: "string" }, topic: { type: "string" }, difficulty: { type: "string", enum: ["Fácil", "Média", "Difícil"] },
          prompt: { type: "string" }, options: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } },
          answer: { type: "integer", minimum: 0, maximum: 4 }, explanation: { type: "string" },
          wrong: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } }, sourceNote: { type: "string" },
        },
      },
    },
  },
};

function fallback(topic: string, seen: number[]): Question[] {
  const candidates = questions.filter((q) => !seen.includes(q.id) && (topic === "Todas" || q.topic.includes(topic) || q.area === topic));
  const pool = candidates.length ? candidates : questions.filter((q) => !seen.includes(q.id));
  return (pool.length ? pool : questions).slice(0, 2).map((q, i) => ({ ...q, id: Date.now() + i, sourceNote: q.sourceNote ?? "Questão autoral no estilo da prova anterior, com valores e contexto adaptados." }));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic : "Todas";
  const seen = Array.isArray(body.seen) ? body.seen.filter(Number.isInteger).slice(-100) : [];
  const runtime = await import("cloudflare:workers").catch(() => null);
  const key = (runtime?.env as unknown as Record<string, string | undefined> | undefined)?.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ questions: fallback(topic, seen), generated: false, reason: "missing_key" });

  const allowed = topics.map((t) => `${t.area}: ${t.name}`).join("\n");
  const prompt = `Crie 2 questões inéditas para concurso de Professor EBTT Informática do IFMT. Tópico preferencial: ${topic}.\n` +
    `Escopo permitido:\n${allowed}\n` +
    `Imite apenas o estilo pedagógico da banca/prova de 2023 (afirmações I/II/III, interpretação de código e conceitos), nunca copie texto. Altere valores, nomes e cenário. ` +
    `A explicação deve ser didática, em 2 a 4 parágrafos curtos: conceito, resolução passo a passo e armadilha da banca. sourceNote deve dizer claramente que é questão autoral inspirada no estilo da prova anterior.`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-5.4-mini", input: prompt, max_output_tokens: 2600, text: { format: { type: "json_schema", name: "question_batch", strict: true, schema } } }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
      throw new Error(`OpenAI ${response.status}: ${failure.error?.code ?? failure.error?.type ?? "request_failed"}`);
    }
    const result = await response.json() as { output_text?: string };
    const parsed = JSON.parse(result.output_text ?? "{}") as { questions?: Omit<Question, "id">[] };
    const batch = (parsed.questions ?? []).map((q, i) => ({ ...q, id: Date.now() + i }));
    if (!batch.length) throw new Error("empty batch");
    return NextResponse.json({ questions: batch, generated: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "generation_failed";
    return NextResponse.json({ questions: fallback(topic, seen), generated: false, reason });
  }
}
