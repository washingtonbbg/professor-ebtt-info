import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("renderiza o aplicativo EBTT", async () => {
  const u = new URL("../dist/server/index.js", import.meta.url); u.searchParams.set("test", Date.now());
  const { default: worker } = await import(u.href);
  const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200); const html = await response.text();
  assert.match(html, /Rumo ao IFMT/); assert.match(html, /Professor EBTT/); assert.doesNotMatch(html, /codex-preview/);
});

test("documenta prioridade e revisão", async () => {
  const s = await readFile(new URL("../app/logic.ts", import.meta.url), "utf8");
  for (const x of [/edital: 30/, /frequency: 25/, /errors: 25/, /overdue: 20/, /\? 1 : rating/, /\? 7 : rating/, /\? 14 : 30/]) assert.match(s, x);
});

test("incorpora as regras oficiais do Edital 03 de 2026", async () => {
  const s = await readFile(new URL("../app/data.ts", import.meta.url), "utf8");
  assert.match(s, /date:"2026-08-30"/); assert.match(s, /totalQuestions:50/); assert.match(s, /minimumScore:70/); assert.match(s, /Conhecimentos Específicos de Informática",20,3/);
  assert.match(s, /prova de 2023 citou Puga/); assert.match(s, /3 foram anuladas/);
});

test("calcula evolução e carga adaptativa com dados reais", async () => {
  const app = await readFile(new URL("../app/App.tsx", import.meta.url), "utf8");
  const logic = await readFile(new URL("../app/logic.ts", import.meta.url), "utf8");
  assert.match(app, /weeklyEvolution\(\s*p\.attemptHistory\s*\)/);
  assert.match(app, /adaptiveLoad\(\s*p\.attemptHistory/);
  assert.match(app, /Calculado somente com suas respostas/);
  assert.doesNotMatch(app, /\[8,12,6,15,10,18,9\]/);
  assert.doesNotMatch(app, /\[\["Programação",76\]/);
  assert.match(logic, /daysRemaining <= 14 \? 1\.4/);
  assert.match(logic, /75 - accuracy/);
});

test("não repete acertos e registra estudo ao responder", async () => {
  const app = await readFile(new URL("../app/App.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/questions/route.ts", import.meta.url), "utf8");
  assert.match(app, /successfulIds\.has\(q\.id\)/);
  assert.match(app, /some\(\s*\(a\)\s*=>\s*a\.questionId\s*===\s*q\.id\s*&&\s*a\.isCorrect\s*\)/);
  assert.match(app, /studyHistory:\s*\[\s*\.\.\.\s*v\.studyHistory/);
  assert.match(app, /Zerar todas as estatísticas/);
  assert.match(route, /return pool\.slice\(0, 2\)/);
});

test("sincroniza progresso e questões geradas no D1", async () => {
  const storage = await readFile(new URL("../app/storage.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/progress/route.ts", import.meta.url), "utf8");
  const hosting = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"));
  assert.equal(hosting.d1, "DB");
  assert.match(storage, /fetch\("\/api\/progress"/);
  assert.match(storage, /syncFromDatabase/);
  assert.match(storage, /function merge\(remote:Progress,device:Progress\)/);
  assert.match(storage, /attemptHistory=union/);
  assert.match(route, /oai-authenticated-user-email/);
  assert.match(route, /ON CONFLICT\(user_id\) DO UPDATE/);
});

test("revisa e persiste correções de questões pela API", async () => {
  const app = await readFile(new URL("../app/App.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/questions/review/route.ts", import.meta.url), "utf8");
  const storage = await readFile(new URL("../app/storage.ts", import.meta.url), "utf8");
  assert.match(app, /Revisar com IA/);
  assert.match(app, /\/api\/questions\/review/);
  assert.match(app, /disabled=\{reviewing\}/);
  assert.doesNotMatch(app, /disabled=\{reviewing \|\| checked\}/);
  assert.doesNotMatch(app, /setAnsweredQuestion\(reviewed\);\s*setChosen\(null\)/);
  assert.match(route, /exatamente uma alternativa correta/);
  assert.match(route, /question_review/);
  assert.match(route, /internallyConsistent/);
  assert.match(route, /attempt<2/);
  assert.match(storage, /mergeQuestions/);
  assert.match(storage, /revisada por IA/);
});

test("renderiza código de questões em bloco organizado", async () => {
  const app = await readFile(new URL("../app/App.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/question-code.css", import.meta.url), "utf8");
  const generation = await readFile(new URL("../app/api/questions/route.ts", import.meta.url), "utf8");
  assert.match(app, /function QuestionPrompt/);
  assert.match(app, /<pre key=\{i\}>/);
  assert.match(css, /white-space: pre/);
  assert.match(css, /Consolas/);
  assert.match(generation, /nunca compacte código em uma linha/);
});

test("abre painel lateral integrado com consentimento e troca de assistente", async () => {
  const app = await readFile(new URL("../app/App.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/question-code.css", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/questions/chat/route.ts", import.meta.url), "utf8");
  for (const assistant of ["Professor didático", "Tutor socrático", "Revisor técnico"]) assert.match(app, new RegExp(assistant));
  assert.match(app, /Autorizar contexto desta questão/);
  assert.match(app, /question-with-ai open/);
  assert.match(app, /\/api\/questions\/chat/);
  assert.match(css, /ai-side-panel/);
  assert.match(css, /position: sticky/);
  assert.match(route, /shareContext/);
  assert.match(route, /O estudante não autorizou/);
  assert.match(route, /gpt-5\.6-terra/);
});

test("persiste o histórico do assistente junto ao progresso", async () => {
  const storage = await readFile(new URL("../app/storage.ts", import.meta.url), "utf8");
  assert.match(storage, /aiChats:Record<string,AIMessage\[\]>/);
  assert.match(storage, /chatKeys=new Set/);
  assert.match(storage, /slice\(-40\)/);
});

test("formata Markdown e converte fórmulas do chat em texto legível", async () => {
  const app = await readFile(new URL("../app/App.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/question-code.css", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/questions/chat/route.ts", import.meta.url), "utf8");
  assert.match(app, /function MarkdownText/);
  assert.match(app, /function readableMath/);
  assert.match(app, /part\.startsWith\("\*\*"\)/);
  assert.match(css, /\.ai-markdown pre/);
  assert.match(route, /Nunca use delimitadores LaTeX/);
});

test("organiza a correção da questão em etapas didáticas", async () => {
  const app = await readFile(new URL("../app/App.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/question-code.css", import.meta.url), "utf8");
  const generation = await readFile(new URL("../app/api/questions/route.ts", import.meta.url), "utf8");
  const review = await readFile(new URL("../app/api/questions/review/route.ts", import.meta.url), "utf8");
  assert.match(app, /function QuestionFeedback/);
  for (const label of ["ALTERNATIVA CORRETA", "Conceito-chave", "Como resolver", "Armadilha da questão", "Analisar todas as alternativas"]) assert.match(app, new RegExp(label));
  assert.match(css, /\.explanation-steps/);
  assert.match(css, /\.alternative-review/);
  assert.match(generation, /exatamente 3 frases/);
  assert.match(review, /exatamente 3 frases/);
});

test("fecha o painel de IA antes de avançar para a próxima questão", async () => {
  const app = await readFile(new URL("../app/App.tsx", import.meta.url), "utf8");
  assert.match(app, /const next\s*=\s*async\s*\(\)\s*=>\s*\{\s*setAiOpen\(false\);/);
});

test("reapresenta no dia seguinte as questões erradas", async () => {
  const app = await readFile(new URL("../app/App.tsx", import.meta.url), "utf8");
  const logic = await readFile(new URL("../app/logic.ts", import.meta.url), "utf8");
  assert.match(app, /dueReviewIds\s*=\s*new Set/);
  assert.match(app, /new Date\(e\.nextReview\)\s*<=\s*new Date\(\)/);
  assert.match(app, /!attemptedIds\.has\(q\.id\)\s*\|\|\s*dueReviewIds\.has\(q\.id\)/);
  assert.match(app, /resolved:\s*true/);
  assert.match(logic, /rating === "Errei"\)date\.setHours\(0,0,0,0\)/);
});

test("formata seções longas do revisor e evita resposta cortada", async () => {
  const app = await readFile(new URL("../app/App.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/question-code.css", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/questions/chat/route.ts", import.meta.url), "utf8");
  assert.match(app, /return <hr key=\{key\}/);
  assert.match(app, /<h3 key=\{key\}>/);
  assert.match(css, /\.ai-markdown h3/);
  assert.match(css, /\.ai-markdown hr/);
  assert.match(route, /no máximo 6 seções curtas/);
  assert.match(route, /max_output_tokens:1500/);
  assert.match(route, /conclusão completa/);
});

test("gera e persiste uma meta adaptativa diária no ritmo oficial da prova", async () => {
  const app = await readFile(new URL("../app/App.tsx", import.meta.url), "utf8");
  const logic = await readFile(new URL("../app/logic.ts", import.meta.url), "utf8");
  const storage = await readFile(new URL("../app/storage.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/plan/daily/route.ts", import.meta.url), "utf8");
  assert.match(logic, /EXAM_MINUTES_PER_QUESTION = 240 \/ 50/);
  assert.match(app, /\/api\/plan\/daily/);
  assert.match(app, /4 min 48 s por questão/);
  assert.match(storage, /dailyPlans:Record<string,DailyPlan>/);
  assert.match(storage, /dailyPlans:\{\.\.\.remote\.dailyPlans,\.\.\.device\.dailyPlans\}/);
  assert.match(route, /gpt-5\.6-terra/);
  assert.match(route, /questionBlockMinutes/);
  assert.match(app, /Atualizado em/);
  assert.match(app, /fmtDateTime\(adaptive\.generatedAt\)/);
  assert.match(route, /generatedAt:new Date\(\)\.toISOString\(\)/);
});

test("corrige o gabarito legado do la\u00e7o e valida novas quest\u00f5es", async () => {
  const storage = await readFile(new URL("../app/storage.ts", import.meta.url), "utf8");
  const generation = await readFile(new URL("../app/api/questions/route.ts", import.meta.url), "utf8");
  assert.match(storage, /LOOP_QUESTION_SIGNATURE/);
  assert.match(storage, /answer:3/);
  assert.match(storage, /correct:3,isCorrect:a\.chosen===3/);
  assert.match(generation, /verification\.correctOption/);
  assert.match(generation, /q\.verification\?\.correctOption===q\.answer/);
});

test("substitui flashcards por revisão livre das questões já feitas", async () => {
  const app = await readFile(new URL("../app/App.tsx", import.meta.url), "utf8");
  const storage = await readFile(new URL("../app/storage.ts", import.meta.url), "utf8");
  assert.match(app, /"Questões feitas"/);
  assert.match(app, /function QuestionReviews/);
  assert.match(app, /Responder novamente/);
  assert.doesNotMatch(app, /function Cards/);
  assert.match(storage, /questionReviews:QuestionReview\[\]/);
  assert.match(storage, /questionReviews=union/);
});
