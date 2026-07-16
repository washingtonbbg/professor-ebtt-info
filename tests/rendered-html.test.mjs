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
