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
  type: "object", additionalProperties: false, required: ["changed", "summary", "issues", "question", "verification"],
  properties: {
    changed: { type: "boolean" }, summary: { type: "string" },
    issues: { type: "array", items: { type: "string" }, maxItems: 6 }, question: questionSchema,
    verification: {
      type: "object", additionalProperties: false, required: ["correctOption", "optionVerdicts"],
      properties: {
        correctOption: { type: "integer", minimum: 0, maximum: 4 },
        optionVerdicts: { type: "array", minItems: 5, maxItems: 5, items: { type: "boolean" } },
      },
    },
  },
};

function internallyConsistent(reviewed:{question?:Omit<Question,"id">;verification?:{correctOption:number;optionVerdicts:boolean[]}}){
  const q=reviewed.question;
  const verification=reviewed.verification;
  if(!q||!verification||q.answer<0||q.answer>4||q.wrong.length!==5||verification.optionVerdicts.length!==5)return false;
  const saysCorrect=(text:string)=>/\b(correta|correto|alternativa correta)\b/i.test(text)&&!/\b(incorreta|incorreto|n\u00e3o (?:\u00e9|est\u00e1) correta)\b/i.test(text);
  return verification.correctOption===q.answer&&verification.optionVerdicts.filter(Boolean).length===1&&verification.optionVerdicts[q.answer]&&q.wrong.every((text,index)=>index===q.answer?saysCorrect(text):!saysCorrect(text));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { question?: Question; concern?: string } | null;
  const question = body?.question;
  const concern = typeof body?.concern === "string" ? body.concern.trim().slice(0, 600) : "";
  if (!question || !Number.isInteger(question.id) || !Array.isArray(question.options) || question.options.length !== 5) return NextResponse.json({ error: "invalid_question" }, { status: 400 });
  const runtime = await import("cloudflare:workers").catch(() => null);
  const key = (runtime?.env as unknown as Record<string, string | undefined> | undefined)?.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "missing_key" }, { status: 503 });
  const prompt = `Revise tecnicamente esta questão de concurso EBTT. Recalcule códigos, fórmulas e afirmações passo a passo. ` +
    `Confirme que existe exatamente uma alternativa correta, que answer aponta para ela e que explanation e wrong são coerentes. ` +
    `Corrija apenas o necessário, preserve tema, dificuldade, cinco alternativas e idioma português. Não confie no gabarito recebido. Formate explanation em exatamente 3 frases com os prefixos "Conceito:", "Resolução:" e "Armadilha:"; cada item de wrong deve explicar especificamente a alternativa correspondente. ` +
    `No prompt revisado, todo código ou pseudocódigo deve ficar em bloco Markdown com três crases, uma instrução por linha, linhas em branco entre blocos lógicos e indentação de quatro espaços por nível. ` +
    `Em verification, marque como true somente a alternativa correta; correctOption, answer e a única posição true devem coincidir. ` +
    `sourceNote deve informar que a questão foi revisada por IA e exige validação humana em temas jurídicos ou normativos.` +
    (concern ? `\nContradição relatada pelo estudante: ${concern}` : "") + `\n${JSON.stringify(question)}`;
  try {
    let lastError="";
    for(let attempt=0;attempt<2;attempt++){
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-5.4-mini", input: prompt+(lastError?`\nA tentativa anterior foi rejeitada: ${lastError}. Refa\u00e7a os c\u00e1lculos e alinhe obrigatoriamente answer, explanation e wrong.`:""), max_output_tokens: 2200, reasoning: { effort: "medium" }, text: { format: { type: "json_schema", name: "question_review", strict: true, schema } } }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
      return NextResponse.json({ error: failure.error?.code ?? failure.error?.type ?? "review_failed" }, { status: response.status });
    }
    const result = await response.json() as { output?: { content?: { type?: string; text?: string }[] }[] };
    const outputText = result.output?.flatMap((item) => item.content ?? []).find((content) => content.type === "output_text")?.text;
    const reviewed = JSON.parse(outputText ?? "{}") as { changed?: boolean; summary?: string; issues?: string[]; question?: Omit<Question, "id">; verification?: {correctOption:number;optionVerdicts:boolean[]} };
    if (!reviewed.question) {lastError="resposta vazia";continue}
    if(!internallyConsistent(reviewed)){lastError="o gabarito contradiz as explica\u00e7\u00f5es das alternativas";continue}
    const {verification:_,...reviewResult}=reviewed;
    return NextResponse.json({ ...reviewResult, question: { ...reviewed.question, id: question.id } });
    }
    throw new Error(lastError||"inconsistent_review");
  } catch { return NextResponse.json({ error: "review_failed" }, { status: 502 }); }
}
