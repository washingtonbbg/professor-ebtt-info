import type { Question } from "./data";

export type StudyMaterial = {
  id: string;
  title: string;
  description: string;
  href: string;
  slides: number;
  matches: (question: Question) => boolean;
};

const normalizationTerms = /normaliza|depend.ncia funcional|\b1fn\b|\b2fn\b|\b3fn\b|\bbcnf\b|forma normal/i;

export const studyMaterials: StudyMaterial[] = [
  {
    id: "algoritmos-bancos",
    title: "Algoritmos e Bancos de Dados",
    description: "Rastreamento de algoritmo, dependências funcionais e revisão de 1FN, 2FN e 3FN.",
    href: "/materiais/algoritmos-e-bancos-de-dados.pptx",
    slides: 13,
    matches: (question) =>
      question.area === "Banco de Dados" ||
      question.topic.toLowerCase().includes("algorit") ||
      question.prompt.toLowerCase().includes("algoritmo"),
  },
  {
    id: "refinaria-normalizacao",
    title: "A Refinaria da Normalização",
    description: "Dependências funcionais, 1FN a BCNF e decomposição sem perda de informação.",
    href: "/materiais/a-refinaria-da-normalizacao.pptx",
    slides: 15,
    matches: (question) =>
      normalizationTerms.test(`${question.topic} ${question.prompt}`),
  },
];

export function materialsForQuestion(question: Question) {
  return studyMaterials.filter((material) => material.matches(question));
}
