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
  assert.match(app, /weeklyEvolution\(p\.attemptHistory\)/);
  assert.match(app, /adaptiveLoad\(p\.attemptHistory/);
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
  assert.match(app, /some\(a=>a\.questionId===q\.id&&a\.isCorrect\)/);
  assert.match(app, /studyHistory:\[\.\.\.v\.studyHistory/);
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
  assert.match(route, /exatamente uma alternativa correta/);
  assert.match(route, /question_review/);
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
