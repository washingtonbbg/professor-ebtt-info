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
        required: ["area", "topic", "difficulty", "prompt", "options", "answer", "explanation", "wrong", "sourceNote", "verification"],
        properties: {
          area: { type: "string" }, topic: { type: "string" }, difficulty: { type: "string", enum: ["Fácil", "Média", "Difícil"] },
          prompt: { type: "string" }, options: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } },
          answer: { type: "integer", minimum: 0, maximum: 4 }, explanation: { type: "string" },
          wrong: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } }, sourceNote: { type: "string" },
          verification: { type: "object", additionalProperties: false, required: ["correctOption", "recalculation"], properties: { correctOption: { type: "integer", minimum: 0, maximum: 4 }, recalculation: { type: "string" } } },
        },
      },
    },
  },
};

function fallback(topic: string, seen: number[]): Question[] {
  const candidates = questions.filter((q) => !seen.includes(q.id) && (topic === "Todas" || q.topic.includes(topic) || q.area === topic));
  const pool = candidates.length ? candidates : questions.filter((q) => !seen.includes(q.id));
  return pool.slice(0, 2).map((q, i) => ({ ...q, id: Date.now() + i, sourceNote: q.sourceNote ?? "Questão autoral no estilo da prova anterior, com valores e contexto adaptados." }));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic : "Todas";
  const seen = Array.isArray(body.seen) ? body.seen.filter(Number.isInteger).slice(-100) : [];
  const runtime = await import("cloudflare:workers").catch(() => null);
  const key = (runtime?.env as unknown as Record<string, string | undefined> | undefined)?.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ questions: fallback(topic, seen), generated: false, reason: "missing_key" });

  const relevantTopics = topic === "Todas"
    ? [...topics].sort((a, b) => b.frequency - a.frequency).slice(0, 10)
    : topics.filter((t) => t.area === topic || t.name.includes(topic)).slice(0, 10);
  const allowed = (relevantTopics.length ? relevantTopics : topics.slice(0, 10))
    .map((t) => `${t.area}: ${t.name}`).join("; ");
  const prompt = `Crie 2 questões inéditas para o concurso de Professor EBTT Informática do IFMT. Preferência: ${topic}. ` +
    `Escopo: ${allowed}. ` +
    `Use o estilo pedagógico da prova de 2023 (afirmações I/II/III, código ou conceitos), sem copiar. Varie dados e cenário. ` +
    `Sempre formate código ou pseudocódigo dentro de um bloco Markdown com três crases, linhas separadas e indentação de quatro espaços por nível; nunca compacte código em uma linha. ` +
    `Cada explanation deve ter exatamente 3 frases objetivas, nesta ordem e com estes prefixos: "Conceito:", "Resolução:" e "Armadilha:". Cada item de wrong deve explicar o erro específico daquela alternativa em uma frase curta e didática. ` +
    `sourceNote deve informar que a questão é autoral e inspirada no estilo da prova anterior.`;
  const verifiedPrompt=prompt+` Antes de definir answer, resolva novamente a quest\u00e3o do zero em verification.recalculation e indique o \u00edndice obtido em verification.correctOption. answer e verification.correctOption devem ser id\u00eanticos.`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-5.4-mini", input: verifiedPrompt, max_output_tokens: 1800, reasoning: { effort: "low" }, text: { format: { type: "json_schema", name: "question_batch", strict: true, schema } } }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
      throw new Error(`OpenAI ${response.status}: ${failure.error?.code ?? failure.error?.type ?? "request_failed"}`);
    }
    const result = await response.json() as {
      output?: { content?: { type?: string; text?: string }[] }[];
      usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
    };
    const outputText = result.output?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")?.text;
    const parsed = JSON.parse(outputText ?? "{}") as { questions?: (Omit<Question, "id"> & {verification?:{correctOption:number;recalculation:string}})[] };
    const batch = (parsed.questions ?? []).filter(q=>q.verification?.correctOption===q.answer).map((q, i) => {const {verification:_,...question}=q;return{...question,id:Date.now()+i}});
    if (!batch.length) throw new Error("empty batch");
    return NextResponse.json({ questions: batch, generated: true, usage: result.usage });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "generation_failed";
    return NextResponse.json({ questions: fallback(topic, seen), generated: false, reason });
  }
}
