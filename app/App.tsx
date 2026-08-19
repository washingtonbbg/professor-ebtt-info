/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
"use client";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  Download,
  FileQuestion,
  GraduationCap,
  Heart,
  Home,
  Menu,
  RotateCcw,
  Send,
  Settings,
  Star,
  Target,
  Upload,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import "./question-code.css";
import { exam, questions, topics, type Question } from "./data";
import { materialsForQuestion } from "./study-materials";
import {
  adaptiveLoad,
  createSchedule,
  learningState,
  nextReview,
  priority,
  todayStudyMinutes,
  weeklyEvolution,
} from "./logic";
import {
  initial,
  load,
  Progress,
  reset,
  save,
  type AIMessage,
  type DailyPlan,
  type Remediation,
} from "./storage";
type Page =
  | "Painel"
  | "Plano"
  | "Questões"
  | "Simulados"
  | "Questões feitas"
  | "Erros"
  | "Conteúdos"
  | "Configurações";
const nav: any[] = [
  ["Painel", Home],
  ["Plano", CalendarDays],
  ["Questões", FileQuestion],
  ["Simulados", Clock3],
  ["Questões feitas", RotateCcw],
  ["Erros", CircleAlert],
  ["Conteúdos", BookOpen],
  ["Configurações", Settings],
];
const fmt = (s: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(s),
  );
const fmtDateTime = (s: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(s));
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function dailyAdaptive(p: Progress) {
  const base = adaptiveLoad(
      p.attemptHistory,
      p.settings.dailyGoal,
      p.settings.examDate || exam.date,
    ),
    saved = p.dailyPlans[todayKey()];
  return saved ? { ...base, ...saved } : base;
}
export default function App() {
  const [page, setPage] = useState<Page>("Painel"),
    [p, setP] = useState<Progress>(initial),
    [ready, setReady] = useState(false),
    [toast, setToast] = useState(""),
    dailyRequested = useRef(false);
  useEffect(() => {
    setP(load());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) save(p);
  }, [p, ready]);
  useEffect(() => {
    const key = todayKey();
    if (!ready || dailyRequested.current || p.dailyPlans[key]?.generatedAt)
      return;
    dailyRequested.current = true;
    const base = adaptiveLoad(
        p.attemptHistory,
        p.settings.dailyGoal,
        p.settings.examDate || exam.date,
      ),
      stats = new Map<
        string,
        { topic: string; answered: number; correct: number }
      >();
    for (const a of p.attemptHistory) {
      const row = stats.get(a.topic) || {
        topic: a.topic,
        answered: 0,
        correct: 0,
      };
      row.answered++;
      if (a.isCorrect) row.correct++;
      stats.set(a.topic, row);
    }
    void fetch("/api/plan/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: key,
        daysRemaining: base.daysRemaining,
        baseMinutes: base.recommendedMinutes,
        accuracy: base.accuracy,
        recentQuestions: base.recentQuestions,
        unresolvedErrors: p.errors.filter((e) => !e.resolved).length,
        topics: [...stats.values()],
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((plan: DailyPlan | null) => {
        if (plan)
          setP((v) => ({ ...v, dailyPlans: { ...v.dailyPlans, [key]: plan } }));
      })
      .catch(() => null);
  }, [ready, p]);
  const update = (f: (v: Progress) => Progress) => setP((v) => f(v));
  const notify = (s: string) => {
      setToast(s);
      setTimeout(() => setToast(""), 2400);
    },
    adaptive = dailyAdaptive(p),
    studiedToday = todayStudyMinutes(p.studyHistory);
  return (
    <div className="shell">
      <aside>
        <Brand />
        <nav>
          {nav.map(([n, I]) => (
            <button
              key={n}
              className={page === n ? "active" : ""}
              onClick={() => setPage(n)}
            >
              <I size={19} />
              {n}
              {n === "Erros" && p.errors.length > 0 ? (
                <b>{p.errors.filter((e) => !e.resolved).length}</b>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="goal">
          <span>Meta adaptativa de hoje</span>
          <strong>
            {studiedToday}/{adaptive.recommendedMinutes} min
          </strong>
          <progress value={studiedToday} max={adaptive.recommendedMinutes} />
          <small>{adaptive.questionTarget} questões · 4 min 48 s cada</small>
        </div>
      </aside>
      <header>
        <Brand />
        <button
          aria-label="Configurações"
          onClick={() => setPage("Configurações")}
        >
          <Settings />
        </button>
      </header>
      <main>
        <div className="page-head">
          <div>
            <h1>{page}</h1>
            <p>Preparação adaptativa para Professor EBTT — Informática</p>
          </div>
          <span>
            <CalendarDays size={16} />
            Prova: {exam.dateLabel}
          </span>
        </div>
        {page === "Painel" && <Dashboard p={p} go={setPage} />}{" "}
        {page === "Plano" && <Plan p={p} update={update} />}{" "}
        {page === "Questões" && (
          <QuestionBank p={p} update={update} notify={notify} />
        )}{" "}
        {page === "Simulados" && <Simulation p={p} update={update} />}{" "}
        {page === "Questões feitas" && (
          <QuestionReviews p={p} update={update} />
        )}{" "}
        {page === "Erros" && <Errors p={p} update={update} />}{" "}
        {page === "Conteúdos" && <Syllabus p={p} update={update} />}{" "}
        {page === "Configurações" && (
          <Config p={p} update={update} notify={notify} />
        )}
      </main>
      <nav className="bottom">
        {nav.slice(0, 5).map(([n, I]) => (
          <button
            key={n}
            className={page === n ? "active" : ""}
            onClick={() => setPage(n)}
          >
            <I size={20} />
            <span>{n}</span>
          </button>
        ))}
        <button onClick={() => setPage("Conteúdos")}>
          <Menu size={20} />
          <span>Mais</span>
        </button>
      </nav>
      {toast && (
        <div className="toast">
          <Check size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span>
        <GraduationCap />
      </span>
      <div>
        <strong>Rumo ao IFMT</strong>
        <small>Professor EBTT • Informática</small>
      </div>
    </div>
  );
}
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
function Button({
  children,
  onClick,
  kind = "primary",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: string;
  disabled?: boolean;
}) {
  return (
    <button disabled={disabled} className={kind} onClick={onClick}>
      {children}
    </button>
  );
}
function QuestionPrompt({ text }: { text: string }) {
  const parts = text.split(/```(?:\w+)?\s*\n?([\s\S]*?)```/g);
  return (
    <div className="question-prompt">
      {parts.map((part, i) =>
        part.trim() ? (
          i % 2 ? (
            <pre key={i}>
              <code>{part.trim()}</code>
            </pre>
          ) : (
            <h2 key={i}>{part.trim()}</h2>
          )
        ) : null,
      )}
    </div>
  );
}
function readableMath(text: string) {
  return text
    .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)")
    .replace(/\\(times|cdot)\b/g, (_, x) => (x === "times" ? "×" : "·"))
    .replace(/\\leq?\b/g, "≤")
    .replace(/\\geq?\b/g, "≥")
    .replace(/\\neq\b/g, "≠")
    .replace(/\\rightarrow\b/g, "→")
    .replace(/\\infty\b/g, "∞")
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\\text\{([^{}]+)\}/g, "$1")
    .trim();
}
function InlineText({ text }: { text: string }) {
  return (
    <>
      {readableMath(text)
        .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
        .filter(Boolean)
        .map((part, i) =>
          part.startsWith("**") ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
          ) : part.startsWith("`") ? (
            <code key={i}>{part.slice(1, -1)}</code>
          ) : (
            part
          ),
        )}
    </>
  );
}
function MarkdownText({ text }: { text: string }) {
  const parts = text.split(/```(?:\w+)?\s*\n?([\s\S]*?)```/g);
  return (
    <div className="ai-markdown">
      {parts.map((part, i) => {
        if (!part.trim()) return null;
        if (i % 2)
          return (
            <pre key={i}>
              <code>{part.trim()}</code>
            </pre>
          );
        return part
          .trim()
          .split(/\n{2,}/)
          .map((block, j) => {
            const lines = block
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
              key = `${i}-${j}`,
              bullets = lines.every((x) => /^[-*]\s+/.test(x)),
              numbers = lines.every((x) => /^\d+[.)]\s+/.test(x));
            if (lines.every((x) => /^(-{3,}|_{3,}|\*{3,})$/.test(x)))
              return <hr key={key} />;
            if (bullets)
              return (
                <ul key={key}>
                  {lines.map((x, k) => (
                    <li key={k}>
                      <InlineText text={x.replace(/^[-*]\s+/, "")} />
                    </li>
                  ))}
                </ul>
              );
            if (numbers)
              return (
                <ol key={key}>
                  {lines.map((x, k) => (
                    <li key={k}>
                      <InlineText text={x.replace(/^\d+[.)]\s+/, "")} />
                    </li>
                  ))}
                </ol>
              );
            const heading = lines[0]?.match(/^(#{1,4})\s+(.+)/);
            if (heading)
              return heading[1].length <= 2 ? (
                <h3 key={key}>
                  <InlineText text={heading[2]} />
                </h3>
              ) : (
                <h4 key={key}>
                  <InlineText text={heading[2]} />
                </h4>
              );
            return (
              <p key={key}>
                {lines.map((line, k) => (
                  <span key={k}>
                    <InlineText text={line} />
                    {k < lines.length - 1 && <br />}
                  </span>
                ))}
              </p>
            );
          });
      })}
    </div>
  );
}
function QuestionMaterials({ q }: { q: Question }) {
  const materials = materialsForQuestion(q);
  if (!materials.length) return null;
  return (
    <aside className="question-materials" aria-label="Materiais complementares">
      <div>
        <b>Material complementar</b>
        <small>Abra os slides para revisar o conteúdo desta questão.</small>
      </div>
      <div className="question-material-list">
        {materials.map((material) => (
          <a key={material.id} href={material.href} target="_blank" rel="noreferrer">
            <span aria-hidden="true">PPT</span>
            <div>
              <strong>{material.title}</strong>
              <small>{material.description}</small>
              <em>{material.slides} slides · arquivo PowerPoint</em>
            </div>
          </a>
        ))}
      </div>
    </aside>
  );
}
const sqlStudents=[{id:1,nome:"Ana",curso:"Informática",nota:8.5},{id:2,nome:"Bruno",curso:"Informática",nota:6.0},{id:3,nome:"Carla",curso:"Edificações",nota:9.0},{id:4,nome:"Diego",curso:"Informática",nota:7.5},{id:5,nome:"Eva",curso:"Edificações",nota:5.5}];
function algorithmLabKind(q:Question):"binary"|"parity"|null{
  const text=`${q.prompt} ${q.explanation}`.toLocaleLowerCase("pt-BR");
  if(/busca bin[aá]ria/.test(text))return "binary";
  if(/mod\s*2|m[oó]dulo\s*2/.test(text)&&/para\s+i|la[cç]o/.test(text))return "parity";
  return null;
}
function AlgorithmLab({q}:{q:Question}){
  const kind=algorithmLabKind(q),[n,setN]=useState(kind==="binary"?1024:5),[step,setStep]=useState(0),[complexity,setComplexity]=useState(""),[checked,setChecked]=useState(false);
  if(!kind)return null;
  const parityTrace=Array.from({length:n},(_,index)=>index+1).map((i,index,rows)=>{const before=rows.slice(0,index).reduce((sum,j)=>j%2===0?sum+j:sum-1,0),after=i%2===0?before+i:before-1;return{i,condition:i%2===0?"verdadeira":"falsa",operation:i%2===0?`S ← ${before} + ${i}`:`S ← ${before} - 1`,S:after}});
  const binaryTrace=[] as {low:number;high:number;middle:number;result:string}[];
  if(kind==="binary"){let low=1,high=n;while(low<=high){const middle=Math.floor((low+high)/2);binaryTrace.push({low,high,middle,result:"valor procurado é maior"});low=middle+1}binaryTrace.push({low,high,middle:0,result:"intervalo vazio: não encontrado"})}
  const total=kind==="binary"?binaryTrace.length:parityTrace.length,visibleParity=parityTrace.slice(0,step),visibleBinary=binaryTrace.slice(0,step),current=parityTrace[Math.min(step,parityTrace.length)-1];
  const reset=(value=n)=>{setN(value);setStep(0);setComplexity("");setChecked(false)};
  const expectedComplexity=kind==="binary"?"O(log N)":"O(N)";
  return <details className="algorithm-lab" open>
    <summary><Brain size={18}/><span><b>Laboratório de Algoritmos</b><small>{kind==="binary"?"Simule a busca binária descrita na questão":"Execute o pseudocódigo da questão passo a passo"}</small></span></summary>
    <div className="algorithm-body"><label>{kind==="binary"?"Tamanho do vetor":"Entrada N"}: <b>{n}</b><input type="range" min={kind==="binary"?3:1} max={kind==="binary"?10:10} value={kind==="binary"?Math.log2(n):n} onChange={e=>reset(kind==="binary"?2**(+e.target.value):+e.target.value)}/></label>
      {kind==="binary"?<div className="algorithm-workspace"><pre><code>{`início ← 1\nfim ← ${n}\nenquanto início ≤ fim faça\n    meio ← ⌊(início + fim) / 2⌋\n    compare vetor[meio] com o valor\n    descarte metade do intervalo\nfimenquanto\nretorne “não encontrado”`}</code></pre><div className="variable-watch"><small>QUESTÃO ATUAL</small><span>elementos <b>{n}</b></span><span>pior caso <b>{binaryTrace.length-1} comparações</b></span><span>intervalo <b>reduz pela metade</b></span></div></div>:<div className="algorithm-workspace"><pre><code>{`leia N\nS ← 0\npara i de 1 até N faça\n    se i mod 2 = 0 então\n        S ← S + i\n    senão\n        S ← S - 1\n    fimse\nfimpara\nescreva S`}</code></pre><div className="variable-watch"><small>MEMÓRIA</small><span>N <b>{n}</b></span><span>i <b>{current?.i??"—"}</b></span><span>S <b>{current?.S??0}</b></span><span>condição <b>{current?.condition??"—"}</b></span></div></div>}
      <div className="algorithm-controls"><button onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0}>← Voltar</button><button className="run-step" onClick={()=>setStep(Math.min(total,step+1))} disabled={step===total}>{step===0?"Iniciar execução":"Próximo passo →"}</button><button onClick={()=>setStep(total)}>Executar tudo</button><button onClick={()=>reset()}>Reiniciar</button></div>
      {kind==="binary"&&visibleBinary.length>0&&<div className="trace-table"><table><thead><tr><th>comparação</th><th>início</th><th>fim</th><th>meio</th><th>resultado</th></tr></thead><tbody>{visibleBinary.map((row,index)=><tr key={index} className={index===visibleBinary.length-1?"current":""}><td>{row.middle?index+1:"—"}</td><td>{row.low}</td><td>{row.high}</td><td>{row.middle||"—"}</td><td>{row.result}</td></tr>)}</tbody></table>{step===total&&<p>Depois de <b>{binaryTrace.length-1} comparações</b> com elementos, o intervalo fica vazio e a busca conclui que o valor não está no vetor.</p>}</div>}
      {kind==="parity"&&visibleParity.length>0&&<div className="trace-table"><table><thead><tr><th>passo</th><th>i</th><th>i é par?</th><th>operação</th><th>S</th></tr></thead><tbody>{visibleParity.map((row,index)=><tr key={row.i} className={index===visibleParity.length-1?"current":""}><td>{index+1}</td><td>{row.i}</td><td>{row.condition}</td><td>{row.operation}</td><td>{row.S}</td></tr>)}</tbody></table>{step===total&&<p>Saída final: <b>{parityTrace.at(-1)?.S}</b>. O laço realizou exatamente <b>{n}</b> iterações.</p>}</div>}
      <div className="complexity-challenge"><b>Qual é a complexidade temporal?</b><div>{["O(1)","O(log N)","O(N)","O(N²)"].map(option=><button key={option} className={complexity===option?"selected":""} onClick={()=>{setComplexity(option);setChecked(false)}}>{option}</button>)}</div><button className="check-complexity" disabled={!complexity} onClick={()=>setChecked(true)}>Verificar</button>{checked&&<p className={complexity===expectedComplexity?"correct":"incorrect"}>{complexity===expectedComplexity?(kind==="binary"?"Correto. Cada comparação elimina metade do intervalo, portanto o crescimento é logarítmico.":"Correto. Cada valor de 1 até N é processado uma vez e o corpo realiza trabalho constante."):(kind==="binary"?"A cada comparação, metade dos elementos deixa de ser candidata. Tente O(log N).":"A quantidade de iterações cresce na mesma proporção de N. Tente O(N).")}</p>}</div>
    </div>
  </details>
}
function DatabaseLab({topic}:{topic:string}){
  const isNormalization=/normaliza|dependência/i.test(topic),[lesson,setLesson]=useState<"filter"|"group"|"normalization">(isNormalization?"normalization":"filter"),[minGrade,setMinGrade]=useState(7),[ran,setRan]=useState(false),[determinant,setDeterminant]=useState("Aluno, Disciplina"),[normalForm,setNormalForm]=useState(""),[checkedForm,setCheckedForm]=useState(false);
  const filtered=sqlStudents.filter(row=>row.nota>=minGrade),groups=[...new Set(sqlStudents.map(row=>row.curso))].map(curso=>({curso,alunos:sqlStudents.filter(row=>row.curso===curso).length,média:(sqlStudents.filter(row=>row.curso===curso).reduce((sum,row)=>sum+row.nota,0)/sqlStudents.filter(row=>row.curso===curso).length).toFixed(1)}));
  const closures:Record<string,string[]>={"Aluno, Disciplina":["Aluno","Disciplina","Professor","Sala","Horário"],Professor:["Professor","Sala","Horário"],"Disciplina, Horário":["Disciplina","Horário","Professor","Sala"],Aluno:["Aluno"]},closure=closures[determinant];
  const query=lesson==="filter"?`SELECT nome, curso, nota\nFROM alunos\nWHERE nota >= ${minGrade}\nORDER BY nota DESC;`:lesson==="group"?"SELECT curso, COUNT(*) AS alunos, AVG(nota) AS média\nFROM alunos\nGROUP BY curso;":"-- Separação em duas relações elimina repetição\nALUNO(id, nome, curso_id)\nCURSO(id, nome)\n-- ALUNO.curso_id → CURSO.id";
  return <details className="database-lab" open={/normaliza|sql|consulta|banco/i.test(topic)}>
    <summary><Database size={18}/><span><b>Laboratório de Banco de Dados</b><small>Execute, observe e assimile o conceito</small></span></summary>
    <div className="db-tabs" role="tablist" aria-label="Experimentos SQL"><button className={lesson==="filter"?"active":""} onClick={()=>{setLesson("filter");setRan(false)}}>Filtro WHERE</button><button className={lesson==="group"?"active":""} onClick={()=>{setLesson("group");setRan(false)}}>GROUP BY</button><button className={lesson==="normalization"?"active":""} onClick={()=>{setLesson("normalization");setRan(false)}}>Normalização</button></div>
    {lesson==="filter"&&<label className="db-control">Nota mínima: <b>{minGrade.toFixed(1)}</b><input type="range" min="5" max="9" step="0.5" value={minGrade} onChange={e=>{setMinGrade(+e.target.value);setRan(false)}}/></label>}
    {lesson==="normalization"&&<div className="fd-lab">
      <p><b>R</b>(Aluno, Disciplina, Professor, Sala, Horário)</p>
      <div className="fd-list"><span>(Aluno, Disciplina) → Professor</span><span>Professor → Sala</span><span>Professor → Horário</span><span>(Disciplina, Horário) → Professor</span></div>
      <label>Calcule o fecho de <select value={determinant} onChange={e=>setDeterminant(e.target.value)}>{Object.keys(closures).map(x=><option key={x}>{x}</option>)}</select></label>
      <div className="closure"><b>{`{${determinant}}⁺`}</b><i>→</i>{closure.map(attribute=><span key={attribute}>{attribute}</span>)}</div>
      <p className="closure-tip">{closure.length===5?"O fecho alcançou todos os atributos: esse conjunto é uma chave candidata.":"O fecho não alcançou toda a relação: não é uma superchave."}</p>
      <div className="normal-form-challenge"><b>Em qual forma normal R se encontra?</b><div>{["1FN","2FN","3FN","BCNF"].map(form=><button key={form} className={normalForm===form?"selected":""} onClick={()=>{setNormalForm(form);setCheckedForm(false)}}>{form}</button>)}</div><button className="check-form" disabled={!normalForm} onClick={()=>setCheckedForm(true)}>Verificar resposta</button>{checkedForm&&<p className={normalForm==="2FN"?"correct":"incorrect"}>{normalForm==="2FN"?"Correto. R está na 2FN, mas Professor → Sala e Professor → Horário criam dependências transitivas e impedem a 3FN.":"Ainda não. A chave (Aluno, Disciplina) não possui dependência parcial, então R alcança a 2FN; porém existem dependências transitivas."}</p>}</div>
      <div className="decomposition"><b>Decomposição pedagógica para 3FN</b><div><span>MATRÍCULA<small>Aluno, Disciplina, Professor</small></span><i>+</i><span>PROFESSOR_LOCAL<small>Professor, Sala, Horário</small></span><i>+</i><span>AULA<small>Disciplina, Horário, Professor</small></span></div><p>Cada dependência fica representada em uma relação cujo determinante funciona como chave.</p></div>
    </div>}
    <pre className="sql-editor"><code>{query}</code></pre>
    <button className="run-query" onClick={()=>setRan(true)}>▶ Executar experimento</button>
    {ran&&<div className="db-result" aria-live="polite">{lesson==="normalization"?<><div className="relation-map"><span>ALUNO</span><i>curso_id → id</i><span>CURSO</span></div><p><b>Assimile:</b> dados do curso ficam em uma única tabela. Isso evita repetir o nome do curso em cada aluno e reduz anomalias de atualização.</p></>:<><table><thead><tr>{Object.keys((lesson==="filter"?filtered:groups)[0]||{}).map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{(lesson==="filter"?filtered:groups).map((row:any,i)=><tr key={i}>{Object.values(row).map((value:any,j)=><td key={j}>{value}</td>)}</tr>)}</tbody></table><p><b>Assimile:</b> {lesson==="filter"?"WHERE seleciona linhas antes da exibição; aumentar a nota reduz o conjunto retornado.":"GROUP BY reúne linhas com o mesmo curso; as funções calculam um resultado para cada grupo."}</p></>}</div>}
  </details>
}
function QuestionFeedback({
  q,
  chosen,
  reviewing = false,
  reviewConcern,
  onReviewConcern,
  onReview,
}: {
  q: Question;
  chosen: number;
  reviewing?: boolean;
  reviewConcern?: string;
  onReviewConcern?: (value: string) => void;
  onReview?: () => void;
}) {
  const ok = chosen === q.answer,
    parts = q.explanation.split(/(?<=[.!?])\s+/).filter(Boolean),
    labels = ["Conceito-chave", "Como resolver", "Armadilha da questão"];
  return (
    <section className={`answer-feedback ${ok ? "ok" : "bad"}`}>
      <header>
        <span>{ok ? <Check /> : <CircleAlert />}</span>
        <div>
          <strong>{ok ? "Resposta correta" : "Resposta incorreta"}</strong>
          <small>
            Você marcou {String.fromCharCode(65 + chosen)} · Gabarito{" "}
            {String.fromCharCode(65 + q.answer)}
          </small>
        </div>
      </header>
      <div className="correct-answer">
        <span>{String.fromCharCode(65 + q.answer)}</span>
        <div>
          <small>ALTERNATIVA CORRETA</small>
          <strong>{q.options[q.answer]}</strong>
        </div>
      </div>
      <div className="explanation-steps">
        {parts.map((part, i) => (
          <div key={i}>
            <small>{labels[Math.min(i, 2)]}</small>
            <p>{part.replace(/^(Conceito|Resolução|Armadilha):\s*/i, "")}</p>
          </div>
        ))}
      </div>
      {!ok && (
        <div className="mistake-note">
          <b>Por que sua alternativa não serve</b>
          <p>
            {q.wrong[chosen] ||
              "A alternativa não atende completamente ao conceito cobrado."}
          </p>
        </div>
      )}
      <details className="alternative-review">
        <summary>Analisar todas as alternativas</summary>
        <div>
          {q.options.map((option, i) => (
            <div key={i} className={i === q.answer ? "right" : ""}>
              <span>{String.fromCharCode(65 + i)}</span>
              <p>
                <b>{option}</b>
                <small>
                  {i === q.answer ? "Alternativa correta." : q.wrong[i]}
                </small>
              </p>
            </div>
          ))}
        </div>
      </details>
      {onReview && onReviewConcern && (
        <div className="answer-review-ai">
          <label htmlFor={`review-concern-${q.id}`}>
            Gabarito ou explicação contraditórios?
          </label>
          <textarea
            id={`review-concern-${q.id}`}
            value={reviewConcern}
            maxLength={600}
            placeholder="Ex.: marquei B, mas a justificativa fala apenas do item III."
            onChange={(event) => onReviewConcern(event.target.value)}
          />
          <button disabled={reviewing} onClick={onReview}>
            {reviewing ? "Revisando gabarito…" : "Revisar gabarito com IA"}
          </button>
        </div>
      )}
      <footer>
        {q.sourceNote ||
          "Questão autoral alinhada ao conteúdo e ao estilo histórico da banca."}
      </footer>
    </section>
  );
}
const questionPool = (generated: Question[]) => [
  ...new Map([...questions, ...generated].map((q) => [q.id, q])).values(),
];
const AI_PROVIDERS = [
  { name: "ChatGPT", url: "https://chatgpt.com/" },
  { name: "Gemini", url: "https://gemini.google.com/app" },
  { name: "Claude", url: "https://claude.ai/new" },
  { name: "Copilot", url: "https://copilot.microsoft.com/" },
  { name: "Perplexity", url: "https://www.perplexity.ai/" },
];
const AI_ASSISTANTS = [
  {
    id: "professor",
    name: "Professor didático",
    hint: "Explicação passo a passo",
  },
  { id: "socratico", name: "Tutor socrático", hint: "Perguntas e pistas" },
  { id: "revisor", name: "Revisor técnico", hint: "Conceitos e gabarito" },
];
const areaGroup = (area: string) =>
  area === "Banco de Dados"
    ? "Banco de Dados"
    : area === "Modelagem"
      ? "UML e GoF"
      : ["Programação", "Linguagens"].includes(area)
        ? "Programação"
        : "Formação geral";
function Dashboard({ p, go }: { p: Progress; go: (x: Page) => void }) {
  const allQuestions = [...questions, ...p.generatedQuestions],
    attemptArea = (a: any) =>
      areaGroup(
        allQuestions.find((q) => q.id === a.questionId)?.area ||
          topics.find(
            (t) => t.name.includes(a.topic) || a.topic.includes(t.name),
          )?.area ||
          "Formação geral",
      ),
    topicError = (name: string) => {
      const rows = p.attemptHistory.filter(
        (a) => name.includes(a.topic) || a.topic.includes(name),
      );
      return rows.length
        ? Math.round(
            (rows.filter((a) => !a.isCorrect).length / rows.length) * 100,
          )
        : 25;
    },
    next = [...topics].sort(
      (a, b) =>
        priority(
          b.weight,
          b.frequency,
          topicError(b.name),
          false,
          p.settings.weights,
        ) -
        priority(
          a.weight,
          a.frequency,
          topicError(a.name),
          false,
          p.settings.weights,
        ),
    )[0],
    acc = p.answered ? Math.round((p.correct / p.answered) * 100) : null,
    adaptive = dailyAdaptive(p),
    chart = weeklyEvolution(p.attemptHistory),
    areas = [
      "Programação",
      "Banco de Dados",
      "UML e GoF",
      "Formação geral",
    ].map((name) => {
      const rows = p.attemptHistory.filter((a) => attemptArea(a) === name);
      return {
        name,
        value: rows.length
          ? Math.round(
              (rows.filter((a) => a.isCorrect).length / rows.length) * 100,
            )
          : null,
        count: rows.length,
      };
    }),
    theory = Math.round(adaptive.recommendedMinutes * 0.4),
    questionMinutes = adaptive.questionBlockMinutes,
    review = adaptive.recommendedMinutes - theory - questionMinutes;
  return (
    <>
      <div className="notice">
        <Check />
        <div>
          <strong>Plano recalculado pela sua evolução</strong>
          <span>
            {adaptive.accuracy === null
              ? "Responda questões para calibrar a carga."
              : `Últimos 7 dias: ${adaptive.accuracy}% de acertos em ${adaptive.recentQuestions} questões.`}
          </span>
          {adaptive.generatedAt && (
            <small>Atualizado em {fmtDateTime(adaptive.generatedAt)}</small>
          )}
        </div>
      </div>
      <div className="metrics">
        <Metric
          I={CalendarDays}
          n="Dias restantes"
          v={`${adaptive.daysRemaining}`}
          s="prova em 30/08/2026"
        />
        <Metric
          I={Clock3}
          n="Horas estudadas"
          v={`${(p.studyMinutes / 60).toFixed(1)}h`}
          s="neste dispositivo"
        />
        <Metric
          I={FileQuestion}
          n="Questões"
          v={`${p.answered}`}
          s={`${p.correct} acertos`}
        />
        <Metric
          I={Target}
          n="Aproveitamento"
          v={acc === null ? "—" : `${acc}%`}
          s="desempenho geral"
        />
        <Metric
          I={Star}
          n="Meta diária"
          v={`${adaptive.recommendedMinutes} min`}
          s={`${adaptive.questionTarget} questões · 4min48s cada`}
        />
        <Metric
          I={RotateCcw}
          n="Revisões"
          v={`${Object.values(p.reviews).filter((d) => new Date(d) <= new Date()).length}`}
          s="pendentes"
        />
      </div>
      <div className="dash">
        <Card className="recommend">
          <div className="ring">
            {priority(
              next.weight,
              next.frequency,
              topicError(next.name),
              false,
              p.settings.weights,
            )}
          </div>
          <div>
            <small>RECOMENDAÇÃO ADAPTATIVA</small>
            <h2>{next.name}</h2>
            <p>
              A carga aumenta com baixo aproveitamento e proximidade da prova.
            </p>
            <div className="tags">
              <i>{theory} min teoria</i>
              <i>
                {questionMinutes} min / {adaptive.questionTarget} questões
              </i>
              <i>{review} min revisão</i>
            </div>
            <Button onClick={() => go("Questões")}>
              Começar estudo <ChevronRight size={17} />
            </Button>
          </div>
        </Card>
        <Card>
          <Title
            t="Evolução diária"
            s="Questões realmente respondidas nos últimos 7 dias"
          />
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="d" axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="q" fill="#2459d3" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card>
        <Title
          t="Desempenho por área"
          s="Calculado somente com suas respostas"
        />
        <div className="areas">
          {areas.map((a) => (
            <div key={a.name}>
              <span>
                {a.name}
                <small>
                  {a.count ? ` · ${a.count} questões` : " · sem dados"}
                </small>
              </span>
              <i>
                <b style={{ width: `${a.value || 0}%` }} />
              </i>
              <strong>{a.value === null ? "—" : `${a.value}%`}</strong>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
function Metric({ I, n, v, s }: any) {
  return (
    <Card className="metric">
      <em>
        <I size={20} />
      </em>
      <div>
        <small>{n}</small>
        <strong>{v}</strong>
        <p>{s}</p>
      </div>
    </Card>
  );
}
function Title({ t, s }: { t: string; s: string }) {
  return (
    <div className="title">
      <div>
        <h2>{t}</h2>
        <p>{s}</p>
      </div>
      <BarChart3 size={20} />
    </div>
  );
}
function Plan({ p, update }: { p: Progress; update: any }) {
  const adaptive = dailyAdaptive(p),
    ranked = [...topics].sort(
      (a, b) =>
        priority(b.weight, b.frequency, 25, false, p.settings.weights) -
        priority(a.weight, a.frequency, 25, false, p.settings.weights),
    ),
    rows = createSchedule(
      ranked.map((t) => t.name),
      p.settings.weekdays,
      adaptive.recommendedMinutes / 60,
      new Date(),
      new Date(p.settings.examDate || exam.date),
    ).slice(0, 18);
  return (
    <div className="two">
      <div>
        <Card>
          <Title
            t="Disponibilidade"
            s="A carga pode subir conforme a evolução"
          />
          <div className="days">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <button
                key={i}
                className={p.settings.weekdays.includes(i) ? "selected" : ""}
                onClick={() =>
                  update((v: Progress) => ({
                    ...v,
                    settings: {
                      ...v.settings,
                      weekdays: v.settings.weekdays.includes(i)
                        ? v.settings.weekdays.filter((x) => x !== i)
                        : [...v.settings.weekdays, i],
                    },
                  }))
                }
              >
                {d}
              </button>
            ))}
          </div>
          <label>
            Meta mínima por dia
            <input
              type="number"
              min=".5"
              max="8"
              step=".5"
              value={p.settings.hours}
              onChange={(e) =>
                update((v: Progress) => ({
                  ...v,
                  settings: {
                    ...v.settings,
                    hours: +e.target.value,
                    dailyGoal: Math.round(+e.target.value * 60),
                  },
                }))
              }
            />
          </label>
          <p>
            Meta calculada hoje:{" "}
            <b>
              {adaptive.recommendedMinutes} min e {adaptive.questionTarget}{" "}
              questões
            </b>
            . Ritmo oficial: <b>4 min 48 s por questão</b>.
          </p>
        </Card>
        <Card>
          <h2>Revisão espaçada</h2>
          <div className="steps">
            {[1, 7, 14, 30].map((d) => (
              <span key={d}>
                <b>{d}</b>
                {d === 1 ? "dia" : "dias"}
              </span>
            ))}
          </div>
          <p>
            O cronograma é gerado e intensificado até a prova oficial de
            30/08/2026.
          </p>
        </Card>
      </div>
      <Card>
        <Title
          t="Próximas sessões"
          s={`${rows.length} atividades adaptativas`}
        />
        <div className="schedule">
          {rows.map((s) => {
            const id = s.date + s.topic,
              done = p.completedSessions.includes(id),
              mins = s.theory + s.questions + s.review;
            return (
              <div className={done ? "done" : ""} key={id}>
                <button
                  onClick={() =>
                    update((v: Progress) => ({
                      ...v,
                      studyMinutes: v.studyMinutes + (done ? -mins : mins),
                      completedSessions: done
                        ? v.completedSessions.filter((x) => x !== id)
                        : [...v.completedSessions, id],
                      studyHistory: done
                        ? v.studyHistory.filter((x) => x.id !== id)
                        : [
                            ...v.studyHistory,
                            {
                              id,
                              date: new Date().toISOString(),
                              minutes: mins,
                            },
                          ],
                    }))
                  }
                >
                  {done ? <Check /> : null}
                </button>
                <time>{fmt(s.date)}</time>
                <div>
                  <strong>{s.topic}</strong>
                  <p>
                    Teoria {s.theory} • Questões {s.questions} • Revisão{" "}
                    {s.review} min
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
function QuestionBank({ p, update, notify }: any) {
  const [idx, setIdx] = useState(0),
    [chosen, setChosen] = useState<number | null>(null),
    [checked, setChecked] = useState(false),
    [filter, setFilter] = useState("Todas"),
    [loading, setLoading] = useState(false),
    [reviewing, setReviewing] = useState(false),
    [reviewConcern, setReviewConcern] = useState(""),
    [remediating, setRemediating] = useState(false),
    [aiOpen, setAiOpen] = useState(false),
    [answeredQuestion, setAnsweredQuestion] = useState<Question | null>(null),
    [startedAt, setStartedAt] = useState(() => Date.now());
  const pool: Question[] = questionPool(p.generatedQuestions),
    successfulIds = new Set<number>(
      p.attemptHistory
        .filter((a: any) => a.isCorrect)
        .map((a: any) => a.questionId),
    ),
    attemptedIds = new Set<number>(
      p.attemptHistory.map((a: any) => a.questionId),
    ),
    dueReviewIds = new Set<number>(
      p.errors
        .filter((e: any) => !e.resolved && new Date(e.nextReview) <= new Date())
        .map((e: any) => e.questionId),
    ),
    list = pool
      .filter(
        (q) =>
          (filter === "Todas" || q.area === filter) &&
          !successfulIds.has(q.id) &&
          (!attemptedIds.has(q.id) || dueReviewIds.has(q.id)),
      )
      .sort(
        (a, b) =>
          Number(dueReviewIds.has(b.id)) - Number(dueReviewIds.has(a.id)),
      );
  const fetchMore = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const currentQuestion = answeredQuestion || list[idx % Math.max(1, list.length)];
      const currentTopic = currentQuestion?.topic;
      const learning = currentTopic ? learningState(p.attemptHistory, currentTopic) : null;
      const areaTopics = topics.filter((item) => item.area === currentQuestion?.area);
      const currentTopicIndex = areaTopics.findIndex((item) =>
        item.name.toLocaleLowerCase("pt-BR").includes((currentTopic || "").toLocaleLowerCase("pt-BR")) ||
        (currentTopic || "").toLocaleLowerCase("pt-BR").includes(item.name.toLocaleLowerCase("pt-BR")),
      );
      const nextTopic = learning?.readyToAdvance && areaTopics.length
        ? areaTopics[(currentTopicIndex >= 0 ? currentTopicIndex + 1 : 0) % areaTopics.length].name
        : currentTopic;
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: nextTopic || filter,
          seen: p.attemptHistory.map((a: any) => a.questionId),
          learning: learning ? { ...learning, advancedFrom: learning.readyToAdvance ? currentTopic : null } : null,
        }),
      });
      const data = await response.json();
      const incoming: Question[] = data.questions || [];
      update((v: Progress) => {
        const prompts = new Set(
          [...questions, ...v.generatedQuestions].map((q) => q.prompt),
        );
        return {
          ...v,
          generatedQuestions: [
            ...v.generatedQuestions,
            ...incoming.filter((q) => !prompts.has(q.prompt)),
          ].slice(-80),
        };
      });
      notify(
        data.generated
          ? "Novas questões inéditas geradas"
          : incoming.length
            ? "Questões de reserva carregadas"
            : "Banco concluído nesta área",
      );
      return incoming;
    } catch {
      notify("Não foi possível carregar agora");
      return [];
    } finally {
      setLoading(false);
    }
  };
  if (!list.length && !answeredQuestion)
    return (
      <>
        <div className="filters">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setIdx(0);
              setStartedAt(Date.now());
            }}
          >
            <option>Todas</option>
            {[...new Set(pool.map((q) => q.area))].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <span>Nenhuma questão pendente</span>
        </div>
        <Card className="empty">
          <Check />
          <h2>Questões disponíveis concluídas</h2>
          <p>
            Gere a próxima questão adaptativa para continuar consolidando o
            conceito ou avançar para um novo conteúdo.
          </p>
          <div className="actions">
            <Button disabled={loading} onClick={fetchMore}>
              {loading ? "Gerando…" : "Gerar questões inéditas"}
            </Button>
            <Button
              kind="danger"
              onClick={() => {
                if (
                  confirm(
                    "Zerar todas as estatísticas e criar um plano do zero?",
                  )
                ) {
                  reset();
                  location.reload();
                }
              }}
            >
              Zerar plano
            </Button>
          </div>
        </Card>
      </>
    );
  const q = answeredQuestion || list[idx % list.length];
  const reviewQuestion = async (concern = "") => {
    if (reviewing) return;
    setReviewing(true);
    try {
      const response = await fetch("/api/questions/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, concern: concern.trim() }),
        }),
        data = await response.json();
      if (!response.ok || !data.question)
        throw new Error(data.error || "review_failed");
      const reviewed: Question = data.question;
      update((v: Progress) => ({
        ...v,
        generatedQuestions: [
          ...v.generatedQuestions.filter((x) => x.id !== reviewed.id),
          reviewed,
        ].slice(-80),
      }));
      setAnsweredQuestion(reviewed);
      setReviewConcern("");
      notify(
        data.changed
          ? `Questão corrigida: ${data.summary}`
          : "Questão revisada e validada",
      );
    } catch {
      notify("Não foi possível revisar esta questão agora");
    } finally {
      setReviewing(false);
    }
  };
  const remediate = async (question:Question,selected:number) => {
    if(remediating||p.remediations[String(question.id)])return;
    setRemediating(true);
    try{
      const response=await fetch("/api/questions/remediate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,chosen:selected})}),data=await response.json();
      if(!response.ok||!data.easierQuestion)throw new Error("remediation_failed");
      const remediation:Remediation={...data,sourceQuestionId:question.id,createdAt:new Date().toISOString()};
      update((v:Progress)=>({...v,remediations:{...v.remediations,[String(question.id)]:remediation},generatedQuestions:[...v.generatedQuestions.filter(x=>x.id!==remediation.easierQuestion.id),remediation.easierQuestion].slice(-80)}));
      notify("Trilha de reforço criada para este erro");
    }catch{notify("O reforço pedagógico será tentado novamente depois")}finally{setRemediating(false)}
  };
  const answer = () => {
    if (chosen === null) return;
    setChecked(true);
    setAnsweredQuestion(q);
    const ok = chosen === q.answer,
      answeredAt = new Date().toISOString(),
      minutes = Math.max(
        1,
        Math.min(10, Math.ceil((Date.now() - startedAt) / 60000)),
      );
    update((v: Progress) => {
      const existing = v.errors.some(
          (e) => e.questionId === q.id && !e.resolved,
        ),
        errors = ok
          ? v.errors.map((e) =>
              e.questionId === q.id && !e.resolved
                ? { ...e, resolved: true }
                : e,
            )
          : existing
            ? v.errors.map((e) =>
                e.questionId === q.id && !e.resolved
                  ? {
                      ...e,
                      chosen,
                      correct: q.answer,
                      nextReview: nextReview("Errei"),
                      prompt: q.prompt,
                      options: q.options,
                    }
                  : e,
              )
            : [
                ...v.errors,
                {
                  questionId: q.id,
                  chosen,
                  correct: q.answer,
                  topic: q.topic,
                  reason: "Falta de domínio",
                  note: "",
                  nextReview: nextReview("Errei"),
                  resolved: false,
                  prompt: q.prompt,
                  options: q.options,
                },
              ];
      return {
        ...v,
        answered: v.answered + 1,
        correct: v.correct + (ok ? 1 : 0),
        studyMinutes: v.studyMinutes + minutes,
        studyHistory: [
          ...v.studyHistory,
          { id: `question-${q.id}-${answeredAt}`, date: answeredAt, minutes },
        ],
        attemptHistory: [
          ...v.attemptHistory,
          {
            questionId: q.id,
            topic: q.topic,
            chosen,
            correct: q.answer,
            isCorrect: ok,
            answeredAt,
          },
        ].slice(-500),
        errors,
      };
    });
    if(!ok)void remediate(q,chosen);
  };
  const next = async () => {
    setAiOpen(false);
    const incoming = await fetchMore();
    setIdx(idx);
    setChosen(null);
    setChecked(false);
    setAnsweredQuestion(incoming?.[0] || null);
    setStartedAt(Date.now());
  };
  const mastery = learningState(p.attemptHistory, q.topic);
  return (
    <>
      <div className="filters">
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setIdx(0);
            setChosen(null);
            setChecked(false);
            setAnsweredQuestion(null);
            setStartedAt(Date.now());
          }}
        >
          <option>Todas</option>
          {[...new Set(pool.map((q) => q.area))].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <span>
          {loading
            ? "Preparando próximas questões…"
            : `${list.length} questões pendentes`}
        </span>
      </div>
      <div className={aiOpen ? "question-with-ai open" : "question-with-ai"}>
        <Card className="question">
          <section className="learning-path" aria-label="Progresso adaptativo no conceito">
            <div>
              <small>TRILHA ADAPTATIVA · {mastery.stage.toUpperCase()}</small>
              <strong>{mastery.readyToAdvance ? "Conceito dominado — próximo tópico liberado" : `Construindo domínio em ${q.topic}`}</strong>
              <p>{mastery.answered ? `${mastery.correct} acertos em ${mastery.answered} tentativas recentes · sequência de ${mastery.streak}` : "Começaremos pelo conceito mais básico e avançaremos no seu ritmo."}</p>
            </div>
            <span>{mastery.score}%</span>
          </section>
          <div className="qmeta">
            <span>{q.area}</span>
            <span>{q.topic}</span>
            <span>{q.difficulty}</span>
            <button
              disabled={reviewing}
              aria-label="Revisar questão com IA"
              onClick={() => void reviewQuestion()}
            >
              {reviewing ? "Revisando…" : "Revisar com IA"}
            </button>
            <button
              aria-label="Favoritar"
              onClick={() => {
                update((v: Progress) => ({
                  ...v,
                  favorites: v.favorites.includes(q.id)
                    ? v.favorites.filter((x) => x !== q.id)
                    : [...v.favorites, q.id],
                }));
                notify("Favoritos atualizados");
              }}
            >
              <Heart
                fill={p.favorites.includes(q.id) ? "currentColor" : "none"}
              />
            </button>
          </div>
          <QuestionPrompt text={q.prompt} />
          {q.area === "Programação" && /Algoritmos|Lógica/i.test(q.topic) && <AlgorithmLab key={q.id} q={q} />}
          <Options
            q={q}
            chosen={chosen}
            setChosen={setChosen}
            checked={checked}
          />
          {checked && chosen !== null && (
            <QuestionFeedback
              q={q}
              chosen={chosen}
              reviewing={reviewing}
              reviewConcern={reviewConcern}
              onReviewConcern={setReviewConcern}
              onReview={() => void reviewQuestion(reviewConcern)}
            />
          )}{" "}
          {checked && chosen!==null && chosen!==q.answer && (
            <RemediationPanel remediation={p.remediations[String(q.id)]} loading={remediating}/>
          )}
          {checked && (
            <div className="ai-explain">
              <button
                className="ai-explain-trigger"
                aria-expanded={aiOpen}
                onClick={() => setAiOpen(true)}
              >
                ✨ Explicar com outra IA
              </button>
            </div>
          )}
          <div className="actions">
            {checked ? (
              <Button onClick={next}>
                {loading ? "Preparando…" : "Próxima"} <ChevronRight />
              </Button>
            ) : (
              <Button disabled={chosen === null || reviewing} onClick={answer}>
                Responder
              </Button>
            )}
          </div>
        </Card>
        {aiOpen && (
          <AIPanel
            key={q.id}
            q={q}
            chosen={chosen}
            p={p}
            update={update}
            notify={notify}
            close={() => setAiOpen(false)}
          />
        )}
      </div>
    </>
  );
}
function RemediationPanel({remediation,loading}:{remediation?:Remediation;loading:boolean}){
  if(loading)return <section className="remediation loading"><Brain/><div><strong>Preparando reforço personalizado…</strong><p>A IA está simplificando o conceito e criando uma questão de pré-requisito.</p></div></section>;
  if(!remediation)return null;
  return <section className="remediation">
    <header><Brain/><div><small>TRILHA ADAPTATIVA</small><strong>{remediation.concept}</strong></div></header>
    <div className="learning-grid"><article><small>EXPLICAÇÃO SIMPLES</small><p>{remediation.simpleExplanation}</p></article><article><small>EXEMPLO RESOLVIDO</small><p>{remediation.workedExample}</p></article><article className="memory"><small>MEMORIZE</small><p>{remediation.mnemonic}</p></article></div>
    <div className="mind-map"><strong>{remediation.mapTitle}</strong><div>{remediation.mapNodes.map((node,i)=><span key={i}>{node}</span>)}</div></div>
    <div className="easier-next"><small>PRÓXIMO PASSO</small><p>Uma questão mais fácil sobre esse pré-requisito foi adicionada ao seu banco.</p></div>
  </section>
}
function AIPanel({
  q,
  chosen,
  p,
  update,
  notify,
  close,
}: {
  q: Question;
  chosen: number | null;
  p: Progress;
  update: any;
  notify: (s: string) => void;
  close: () => void;
}) {
  const [assistant, setAssistant] = useState("professor"),
    [shareContext, setShareContext] = useState(false),
    [draft, setDraft] = useState(""),
    [sending, setSending] = useState(false);
  const key = String(q.id),
    messages: AIMessage[] = p.aiChats[key] || [],
    profile = AI_ASSISTANTS.find((a) => a.id === assistant)!;
  const persist = (message: AIMessage) =>
    update((v: Progress) => ({
      ...v,
      aiChats: {
        ...v.aiChats,
        [key]: [...(v.aiChats[key] || []), message].slice(-40),
      },
    }));
  const send = async (text = draft) => {
    const content = text.trim();
    if (!content || sending) return;
    const userMessage: AIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      assistant,
    };
    persist(userMessage);
    setDraft("");
    setSending(true);
    try {
      const history = [...messages, userMessage].map(({ role, content }) => ({
        role,
        content,
      }));
      const response = await fetch("/api/questions/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assistant,
            messages: history,
            question: q,
            shareContext,
            selectedAnswer: chosen,
          }),
        }),
        data = await response.json();
      if (!response.ok || !data.answer)
        throw new Error(data.error || "chat_failed");
      persist({
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        createdAt: new Date().toISOString(),
        assistant,
      });
    } catch {
      notify("Não foi possível conversar com a IA agora");
    } finally {
      setSending(false);
    }
  };
  return (
    <aside className="ai-side-panel" aria-label="Assistente de IA">
      <div className="ai-panel-head">
        <div>
          <strong>Assistente de estudos</strong>
          <small>Converse sem sair da questão</small>
        </div>
        <button aria-label="Fechar assistente" onClick={close}>
          <X />
        </button>
      </div>
      <label className="assistant-picker">
        Assistente
        <select
          value={assistant}
          onChange={(e) => setAssistant(e.target.value)}
        >
          {AI_ASSISTANTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.hint}
            </option>
          ))}
        </select>
      </label>
      <label className="context-consent">
        <input
          type="checkbox"
          checked={shareContext}
          onChange={(e) => setShareContext(e.target.checked)}
        />
        <span>
          <b>Autorizar contexto desta questão</b>
          <small>
            {shareContext
              ? `Inclui enunciado, alternativas, sua resposta ${chosen === null ? "não marcada" : String.fromCharCode(65 + chosen)} e gabarito.`
              : "A IA receberá somente o que você escrever."}
          </small>
        </span>
      </label>
      <div className="ai-chat" aria-live="polite">
        {!messages.length && (
          <div className="ai-welcome">
            <strong>{profile.name}</strong>
            <p>Como posso ajudar nesta questão?</p>
            <div>
              {[
                "Explique passo a passo",
                "Por que as outras estão erradas?",
                "Crie uma regra para revisar",
              ].map((x) => (
                <button key={x} onClick={() => send(x)}>
                  {x}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`ai-message ${m.role}`}>
            <small>
              {m.role === "user"
                ? "Você"
                : AI_ASSISTANTS.find((a) => a.id === m.assistant)?.name ||
                  "Assistente"}
            </small>
            <MarkdownText text={m.content} />
          </div>
        ))}
        {sending && (
          <div className="ai-message assistant waiting">
            <small>{profile.name}</small>
            <div className="ai-markdown">
              <p>Analisando…</p>
            </div>
          </div>
        )}
      </div>
      <form
        className="ai-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label="Mensagem para a IA"
          placeholder="Pergunte sobre a questão…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          disabled={!draft.trim() || sending}
          aria-label="Enviar mensagem"
        >
          <Send />
        </button>
      </form>
      <div className="ai-panel-foot">
        <span>Usa a IA configurada no projeto</span>
        {messages.length > 0 && (
          <button
            onClick={() =>
              update((v: Progress) => ({
                ...v,
                aiChats: { ...v.aiChats, [key]: [] },
              }))
            }
          >
            Limpar conversa
          </button>
        )}
      </div>
      <details className="external-ai">
        <summary>Abrir em uma IA externa</summary>
        <div>
          {AI_PROVIDERS.map((provider) => (
            <button
              key={provider.name}
              onClick={() =>
                window.open(provider.url, "_blank", "noopener,noreferrer")
              }
            >
              {provider.name} ↗
            </button>
          ))}
        </div>
      </details>
    </aside>
  );
}
function Options({ q, chosen, setChosen, checked = false }: any) {
  return (
    <div className="options">
      {q.options.map((o: string, i: number) => (
        <button
          disabled={checked}
          key={i}
          className={`${chosen === i ? "chosen" : ""} ${checked && i === q.answer ? "correct" : ""} ${checked && chosen === i && i !== q.answer ? "wrong" : ""}`}
          onClick={() => setChosen(i)}
        >
          <span>{String.fromCharCode(65 + i)}</span>
          {o}
        </button>
      ))}
    </div>
  );
}
function Simulation({ p, update }: any) {
  const [mode, setMode] = useState<null | string>(null),
    [idx, setIdx] = useState(0),
    [answers, setAnswers] = useState<Record<number, number>>({}),
    [done, setDone] = useState(false);
  if (!mode)
    return (
      <>
        <div className="simgrid">
          {[
            [
              "specific",
              "Simulado específico",
              "20 questões de Informática",
              "20",
            ],
            [
              "full",
              "Simulado completo",
              "Distribuição oficial do Edital 03/2026",
              "50",
            ],
          ].map((x) => (
            <Card key={x[0]}>
              <em>
                <Brain />
              </em>
              <h2>{x[1]}</h2>
              <p>{x[2]}</p>
              <strong>{x[3]} questões</strong>
              <Button onClick={() => setMode(x[0])}>Iniciar</Button>
            </Card>
          ))}
        </div>
        <Card>
          <Title t="Histórico" s="Evolução dos simulados" />
          <div className="history">
            {p.simulationHistory.map((h: any, i: number) => (
              <div key={i}>
                <span>{fmt(h.date)}</span>
                <strong>{h.mode}</strong>
                <b>
                  {h.score}/{h.total}
                </b>
              </div>
            ))}
          </div>
        </Card>
      </>
    );
  const total = mode === "full" ? 50 : 20,
    pool = Array.from(
      { length: total },
      (_, i) => questions[i % questions.length],
    ),
    score = pool.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
  if (done)
    return (
      <Card className="result">
        <div className="ring large">{Math.round((score / total) * 100)}%</div>
        <h2>Simulado concluído</h2>
        <p>
          Você acertou{" "}
          <b>
            {score} de {total}
          </b>
          .
        </p>
        <Button
          onClick={() => {
            setMode(null);
            setDone(false);
            setAnswers({});
            setIdx(0);
          }}
        >
          Voltar
        </Button>
      </Card>
    );
  const q = pool[idx];
  return (
    <Card className="exam">
      <div className="examtop">
        <strong>
          Questão {idx + 1} de {total}
        </strong>
        <span>
          <Clock3 /> correção somente ao finalizar
        </span>
      </div>
      <progress value={idx + 1} max={total} />
      <QuestionPrompt text={q.prompt} />
      <Options
        q={q}
        chosen={answers[idx]}
        setChosen={(i: number) => setAnswers({ ...answers, [idx]: i })}
      />
      <div className="actions">
        <Button
          kind="secondary"
          disabled={idx === 0}
          onClick={() => setIdx(idx - 1)}
        >
          <ChevronLeft />
          Anterior
        </Button>
        {idx === total - 1 ? (
          <Button
            onClick={() => {
              setDone(true);
              update((v: Progress) => ({
                ...v,
                answered: v.answered + total,
                correct: v.correct + score,
                simulationHistory: [
                  ...v.simulationHistory,
                  {
                    date: new Date().toISOString(),
                    score,
                    total,
                    mode: mode === "full" ? "Completo" : "Específico",
                  },
                ],
              }));
            }}
          >
            Finalizar
          </Button>
        ) : (
          <Button onClick={() => setIdx(idx + 1)}>
            Próxima
            <ChevronRight />
          </Button>
        )}
      </div>
    </Card>
  );
}
function QuestionReviews({ p, update }: any) {
  const [i, setI] = useState(0),
    [chosen, setChosen] = useState<number | null>(null),
    [checked, setChecked] = useState(false),
    all = questionPool(p.generatedQuestions),
    doneIds = [
      ...new Set<number>(p.attemptHistory.map((a: any) => a.questionId)),
    ],
    list = doneIds
      .map((id) => all.find((q) => q.id === id))
      .filter(Boolean) as Question[];
  if (!list.length)
    return (
      <Card className="empty">
        <RotateCcw />
        <h2>Nenhuma questão feita ainda</h2>
        <p>
          Depois que você responder questões, elas aparecerão aqui para serem
          refeitas quantas vezes quiser.
        </p>
      </Card>
    );
  const q = list[i % list.length],
    answer = () => {
      if (chosen === null) return;
      setChecked(true);
      const reviewedAt = new Date().toISOString();
      update((v: Progress) => ({
        ...v,
        answered: v.answered + 1,
        correct: v.correct + (chosen === q.answer ? 1 : 0),
        attemptHistory: [
          ...v.attemptHistory,
          {
            questionId: q.id,
            topic: q.topic,
            chosen,
            correct: q.answer,
            isCorrect: chosen === q.answer,
            answeredAt: reviewedAt,
          },
        ].slice(-500),
        questionReviews: [
          ...v.questionReviews,
          {
            id: crypto.randomUUID(),
            questionId: q.id,
            topic: q.topic,
            chosen,
            correct: q.answer,
            isCorrect: chosen === q.answer,
            reviewedAt,
          },
        ].slice(-1000),
      }));
    },
    move = (step: number) => {
      setI((i + step + list.length) % list.length);
      setChosen(null);
      setChecked(false);
    };
  return (
    <div className="review-questions">
      <Card className="question">
        <div className="qmeta">
          <span>REVISÃO LIVRE</span>
          <span>{q.area}</span>
          <span>{q.topic}</span>
        </div>
        <QuestionPrompt text={q.prompt} />
        <Options
          q={q}
          chosen={chosen}
          setChosen={setChosen}
          checked={checked}
        />
        {checked && chosen !== null && (
          <QuestionFeedback q={q} chosen={chosen} />
        )}
        <div className="actions">
          <Button kind="secondary" onClick={() => move(-1)}>
            <ChevronLeft />
            Anterior
          </Button>
          {checked ? (
            <Button onClick={() => move(1)}>
              Próxima
              <ChevronRight />
            </Button>
          ) : (
            <Button disabled={chosen === null} onClick={answer}>
              Responder novamente
            </Button>
          )}
        </div>
      </Card>
      <Card>
        <small>QUESTÕES JÁ FEITAS</small>
        <strong className="huge">{list.length}</strong>
        <p>
          Esta lista recomeça sempre que você entrar. As tentativas de revisão
          são salvas separadamente e não alteram seu desempenho principal.
        </p>
        <p>
          <b>{p.questionReviews.length}</b> revisões registradas.
        </p>
      </Card>
    </div>
  );
}
function Errors({ p, update }: any) {
  return p.errors.length === 0 ? (
    <Card className="empty">
      <CircleAlert />
      <h2>Caderno de erros vazio</h2>
      <p>Questões erradas serão registradas automaticamente aqui.</p>
    </Card>
  ) : (
    <div className="errorlist">
      {p.errors.map((e: any, i: number) => {
        const q = [...questions, ...p.generatedQuestions].find(
            (x) => x.id === e.questionId,
          ),
          prompt = q?.prompt || e.prompt || "Questão registrada",
          options = q?.options || e.options || [];
        return (
          <Card key={i}>
            <div className="title">
              <span className="status">
                {e.resolved ? "Corrigido" : "Pendente"}
              </span>
              <small>Revisar {fmt(e.nextReview)}</small>
            </div>
            <h2>{prompt}</h2>
            <p>
              <b>Sua resposta:</b> {options[e.chosen] || "—"} • <b>Correta:</b>{" "}
              {options[e.correct] || "—"}
            </p>
            <div className="errorfields">
              <select
                value={e.reason}
                onChange={(ev) =>
                  update((v: Progress) => ({
                    ...v,
                    errors: v.errors.map((x, j) =>
                      j === i ? { ...x, reason: ev.target.value } : x,
                    ),
                  }))
                }
              >
                {[
                  "Falta de domínio",
                  "Conceitual",
                  "Distração",
                  "Interpretação",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <input
                placeholder="Observação do estudante"
                value={e.note}
                onChange={(ev) =>
                  update((v: Progress) => ({
                    ...v,
                    errors: v.errors.map((x, j) =>
                      j === i ? { ...x, note: ev.target.value } : x,
                    ),
                  }))
                }
              />
              <Button
                kind="secondary"
                onClick={() =>
                  update((v: Progress) => ({
                    ...v,
                    errors: v.errors.map((x, j) =>
                      j === i ? { ...x, resolved: !x.resolved } : x,
                    ),
                  }))
                }
              >
                {e.resolved ? "Reabrir" : "Marcar corrigido"}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
function Syllabus({ p, update }: any) {
  const [query,setQuery]=useState(""),areas=[...new Set(topics.map(t=>t.area))],normalized=query.trim().toLocaleLowerCase("pt-BR"),visible=topics.filter(t=>!normalized||`${t.area} ${t.name}`.toLocaleLowerCase("pt-BR").includes(normalized)),mastered=topics.filter(t=>p.topicStatus[t.id]==="dominado").length;
  return (
    <div className="syllabus">
      <Card className="index-head">
        <div><small>ÍNDICE DO CONTEÚDO PROGRAMÁTICO</small><h2>{topics.length} tópicos em {areas.length} áreas</h2><p>Localize assuntos e acompanhe seu domínio em relação ao programa da prova.</p></div>
        <div className="index-progress"><strong>{mastered}/{topics.length}</strong><span>dominados</span><progress value={mastered} max={topics.length}/></div>
        <input aria-label="Buscar no conteúdo programático" placeholder="Buscar assunto ou área…" value={query} onChange={e=>setQuery(e.target.value)}/>
      </Card>
      <nav className="area-index" aria-label="Áreas do conteúdo">{areas.map((area,i)=><a key={area} href={`#area-${i+1}`}>{i+1}. {area}<span>{topics.filter(t=>t.area===area).length}</span></a>)}</nav>
      {[...new Set(topics.map((t) => t.area))].map((g) => (
        visible.some(t=>t.area===g)&&<Card key={g} id={`area-${areas.indexOf(g)+1}`}>
          <Title
            t={g}
            s={`${topics.filter((t) => t.area === g).length} tópicos`}
          />
          {visible
            .filter((t) => t.area === g)
            .map((t) => (
              <div className="topic" key={t.id}>
                <div>
                  <strong>{t.name}</strong>
                  <small>
                    Prioridade{" "}
                    {priority(
                      t.weight,
                      t.frequency,
                      25,
                      false,
                      p.settings.weights,
                    )}
                    /100
                  </small>
                </div>
                <select
                  value={p.topicStatus[t.id] || "não iniciado"}
                  onChange={(e) =>
                    update((v: Progress) => ({
                      ...v,
                      topicStatus: { ...v.topicStatus, [t.id]: e.target.value },
                    }))
                  }
                >
                  {["não iniciado", "estudando", "revisando", "dominado"].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
                <label>
                  Confiança
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={p.confidence[t.id] || 1}
                    onChange={(e) =>
                      update((v: Progress) => ({
                        ...v,
                        confidence: {
                          ...v.confidence,
                          [t.id]: +e.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>
            ))}
        </Card>
      ))}
    </div>
  );
}
function Config({ p, update, notify }: any) {
  const download = (name: string, type: string, content: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
  };
  return (
    <div className="settings">
      <Card>
        <h2>Planejamento</h2>
        <label>
          Data da prova
          <input
            type="date"
            value={p.settings.examDate || exam.date}
            onChange={(e) =>
              update((v: Progress) => ({
                ...v,
                settings: { ...v.settings, examDate: e.target.value },
              }))
            }
          />
          <small>Data oficial do Anexo I do Edital 03/2026.</small>
        </label>
        <label>
          Meta diária (min)
          <input
            type="number"
            min="15"
            max="600"
            value={p.settings.dailyGoal}
            onChange={(e) =>
              update((v: Progress) => ({
                ...v,
                settings: { ...v.settings, dailyGoal: +e.target.value },
              }))
            }
          />
        </label>
        <label>
          Prioridade específica: {p.settings.specificPriority}%
          <input
            type="range"
            min="20"
            max="90"
            value={p.settings.specificPriority}
            onChange={(e) =>
              update((v: Progress) => ({
                ...v,
                settings: { ...v.settings, specificPriority: +e.target.value },
              }))
            }
          />
        </label>
      </Card>
      <Card>
        <h2>Pesos adaptativos</h2>
        {Object.entries({
          edital: "Peso no edital",
          frequency: "Frequência histórica",
          errors: "Taxa de erros",
          overdue: "Revisão vencida",
        }).map(([k, n]) => (
          <label className="weight" key={k}>
            <span>{n}</span>
            <input
              type="number"
              min="0"
              max="100"
              value={(p.settings.weights as any)[k]}
              onChange={(e) =>
                update((v: Progress) => ({
                  ...v,
                  settings: {
                    ...v.settings,
                    weights: { ...v.settings.weights, [k]: +e.target.value },
                  },
                }))
              }
            />
          </label>
        ))}
      </Card>
      <Card>
        <h2>Seus dados</h2>
        <div className="data">
          <Button
            kind="secondary"
            onClick={() =>
              download(
                "progresso-ebtt.json",
                "application/json",
                JSON.stringify(p, null, 2),
              )
            }
          >
            <Download />
            Exportar JSON
          </Button>
          <Button
            kind="secondary"
            onClick={() =>
              download(
                "relatorio-ebtt.csv",
                "text/csv",
                [
                  "area,topico,status",
                  ...topics.map(
                    (t) =>
                      `"${t.area}","${t.name}","${p.topicStatus[t.id] || "não iniciado"}"`,
                  ),
                ].join("\n"),
              )
            }
          >
            <Download />
            Relatório CSV
          </Button>
          <label className="secondary">
            <Upload />
            Importar JSON
            <input
              hidden
              type="file"
              accept="application/json"
              onChange={async (e) => {
                try {
                  const data = JSON.parse(await e.target.files![0].text());
                  update(() => ({ ...initial, ...data }));
                  notify("Dados importados");
                } catch {
                  notify("JSON inválido");
                }
              }}
            />
          </label>
          <Button
            kind="danger"
            onClick={() => {
              if (confirm("Restaurar demonstração?")) {
                reset();
                location.reload();
              }
            }}
          >
            <RotateCcw />
            Restaurar demonstração
          </Button>
        </div>
      </Card>
      <Card>
        <h2>Transparência</h2>
        <dl>
          <dt>Data</dt>
          <dd>{exam.dateLabel}</dd>
          <dt>Regras</dt>
          <dd>{exam.rules}</dd>
          <dt>Estilo anterior</dt>
          <dd>{exam.historicalStyle}</dd>
          <dt>Frequência anterior</dt>
          <dd>{exam.historicalFrequency}</dd>
          <dt>Bibliografia</dt>
          <dd>{exam.bibliography}</dd>
          <dt>Comparação</dt>
          <dd>{exam.historicalComparison}</dd>
        </dl>
      </Card>
    </div>
  );
}
