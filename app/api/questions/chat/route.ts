import { NextRequest, NextResponse } from "next/server";
import type { Question } from "../../../data";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user"|"assistant"; content: string };
const assistants:Record<string,string> = {
  professor:"Explique didaticamente, passo a passo, com exemplos curtos e uma regra final para revisão.",
  socratico:"Atue como tutor socrático: faça perguntas orientadoras e dê pistas antes de revelar a conclusão.",
  revisor:"Seja objetivo e técnico: confira conceitos, cálculos, gabarito e armadilhas de cada alternativa.",
};

export async function POST(request:NextRequest) {
  const body=await request.json().catch(()=>null) as { assistant?:string; messages?:ChatMessage[]; question?:Question; shareContext?:boolean; selectedAnswer?:number|null }|null;
  const assistant=body?.assistant&&assistants[body.assistant]?body.assistant:"professor";
  const messages=(body?.messages||[]).filter(m=>["user","assistant"].includes(m.role)&&typeof m.content==="string"&&m.content.trim()).slice(-12).map(m=>({role:m.role,content:m.content.slice(0,4000)}));
  if(!messages.length)return NextResponse.json({error:"empty_message"},{status:400});
  const runtime=await import("cloudflare:workers").catch(()=>null);
  const key=(runtime?.env as unknown as Record<string,string|undefined>|undefined)?.OPENAI_API_KEY??process.env.OPENAI_API_KEY;
  if(!key)return NextResponse.json({error:"missing_key"},{status:503});
  const q=body?.shareContext?body.question:undefined;
  const selected=Number.isInteger(body?.selectedAnswer)?String.fromCharCode(65+(body?.selectedAnswer as number)):"não marcada";
  const context=q?`\n\nCONTEXTO AUTORIZADO DA QUESTÃO:\n${q.prompt}\n${q.options.map((o,i)=>`${String.fromCharCode(65+i)}) ${o}`).join("\n")}\nResposta do estudante: ${selected}.\nGabarito informado: ${String.fromCharCode(65+q.answer)}.\nExplicação do aplicativo: ${q.explanation}`:"\n\nO estudante não autorizou o compartilhamento da questão. Responda somente ao que ele escrever e avise quando faltar contexto.";
  const instructions=`Você é um assistente de estudos para concurso de Professor EBTT em Informática. Responda em português brasileiro. ${assistants[assistant]} Não invente fatos nem finja ter visto conteúdo não compartilhado. Preserve o foco da conversa e use respostas proporcionais à dúvida.${context}`;
  try {
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-terra",reasoning:{effort:"low"},instructions,input:messages,max_output_tokens:900,text:{verbosity:"medium"}})});
    if(!response.ok){const failure=await response.json().catch(()=>({})) as {error?:{code?:string;type?:string}};return NextResponse.json({error:failure.error?.code??failure.error?.type??"chat_failed"},{status:response.status})}
    const result=await response.json() as {output?:{content?:{type?:string;text?:string}[]}[]};
    const answer=result.output?.flatMap(item=>item.content??[]).find(content=>content.type==="output_text")?.text;
    if(!answer)throw new Error("empty_answer");
    return NextResponse.json({answer});
  }catch{return NextResponse.json({error:"chat_failed"},{status:502})}
}
