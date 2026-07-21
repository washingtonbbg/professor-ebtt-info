import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TopicStat = { topic:string; answered:number; correct:number };
type Body = { date?:string; daysRemaining?:number; baseMinutes?:number; accuracy?:number|null; recentQuestions?:number; unresolvedErrors?:number; topics?:TopicStat[] };
const MINUTES_PER_QUESTION=240/50;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

function finish(date:string,recommendedMinutes:number,focusTopics:string[],rationale:string,generatedByAi:boolean){
  const minutes=clamp(Math.round(recommendedMinutes/15)*15,30,360);
  const questionBlockMinutes=Math.round(minutes*.4);
  const questionTarget=clamp(Math.floor(questionBlockMinutes/MINUTES_PER_QUESTION),5,50);
  return {date,generatedAt:new Date().toISOString(),recommendedMinutes:minutes,questionTarget,minutesPerQuestion:MINUTES_PER_QUESTION,questionBlockMinutes,focusTopics:focusTopics.slice(0,3),rationale:rationale.slice(0,320),generatedByAi};
}

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({})) as Body;
  const date=/^\d{4}-\d{2}-\d{2}$/.test(body.date||"")?body.date!:new Date().toISOString().slice(0,10);
  const base=clamp(Number(body.baseMinutes)||90,30,360);
  const weak=[...(body.topics||[])].filter(t=>t.answered>0).sort((a,b)=>(a.correct/a.answered)-(b.correct/b.answered)).slice(0,3).map(t=>t.topic);
  const fallback=finish(date,base,weak,"Meta calculada pelo desempenho recente, pelos erros pendentes e pela proximidade da prova.",false);
  const runtime=await import("cloudflare:workers").catch(()=>null);
  const key=(runtime?.env as unknown as Record<string,string|undefined>|undefined)?.OPENAI_API_KEY??process.env.OPENAI_API_KEY;
  if(!key)return NextResponse.json(fallback);
  const input={exam:{date:"2026-08-30",questions:50,durationMinutes:240,minutesPerQuestion:MINUTES_PER_QUESTION},daysRemaining:body.daysRemaining,baseMinutes:base,accuracy:body.accuracy,recentQuestions:body.recentQuestions,unresolvedErrors:body.unresolvedErrors,weakTopics:(body.topics||[]).slice(0,12)};
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.6-terra",reasoning:{effort:"low"},instructions:"Você planeja a preparação diária para a prova EBTT. Ajuste o tempo entre 30 e 360 minutos, intensificando gradualmente perto da prova sem aumentos impraticáveis. Priorize até 3 assuntos com pior aproveitamento ou erros. O bloco de questões será calculado pelo servidor no ritmo oficial de 4,8 minutos por questão. Seja breve e não invente dados.",input:JSON.stringify(input),max_output_tokens:450,text:{format:{type:"json_schema",name:"daily_plan",strict:true,schema:{type:"object",additionalProperties:false,properties:{recommendedMinutes:{type:"integer",minimum:30,maximum:360},focusTopics:{type:"array",items:{type:"string"},maxItems:3},rationale:{type:"string"}},required:["recommendedMinutes","focusTopics","rationale"]}}}})});
    if(!response.ok)return NextResponse.json(fallback);
    const result=await response.json() as {output?:{content?:{type?:string;text?:string}[]}[]};
    const text=result.output?.flatMap(item=>item.content||[]).find(c=>c.type==="output_text")?.text;
    if(!text)return NextResponse.json(fallback);
    const plan=JSON.parse(text) as {recommendedMinutes:number;focusTopics:string[];rationale:string};
    return NextResponse.json(finish(date,plan.recommendedMinutes,plan.focusTopics,plan.rationale,true));
  }catch{return NextResponse.json(fallback)}
}
