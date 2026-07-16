# Rumo ao IFMT — Professor EBTT Informática

Aplicativo responsivo de preparação com painel adaptativo, cronograma, questões autorais, simulados, flashcards, caderno de erros e checklist. Funciona sem login e guarda o progresso no `localStorage`.

## Uso

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

## Arquitetura

- `app/App.tsx`: interface e fluxos.
- `app/data.ts`: escopo, questões e flashcards.
- `app/logic.ts`: prioridade, revisões e cronograma.
- `app/storage.ts`: persistência local tipada.
- `tests/`: regras principais e renderização.

O motor normaliza `(edital × 0,30) + (frequência × 0,25) + (erros × 0,25) + (revisão vencida × 0,20)` entre 0 e 100. Os pesos são configuráveis.

## Limitação documental

Somente o briefing foi anexado. Edital, anexos e prova anterior não estavam disponíveis; data, regras detalhadas, bibliografia, frequência histórica validada e diferenças aparecem como **não informadas**. Frequências do recomendador são estimativas iniciais, não conclusões documentais.
