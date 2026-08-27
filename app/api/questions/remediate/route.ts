import { NextRequest, NextResponse } from "next/server";
import type { Question } from "../../../data";

export const dynamic="force-dynamic";

const questionSchema={type:"object",additionalProperties:false,required:["area","topic","difficulty","prompt","options","answer","explanation","wrong","sourceNote"],properties:{area:{type:"string"},topic:{type:"string"},difficulty:{type:"string",enum:["Fácil"]},prompt:{type:"string"},options:{type:"array",minItems:5,maxItems:5,items:{type:"string"}},answer:{type:"integer",minimum:0,maximum:4},explanation:{type:"string"},wrong:{type:"array",minItems:5,maxItems:5,items:{type:"string"}},sourceNote:{type:"string"}}};
const schema={type:"object",additionalProperties:false,required:["concept","simpleExplanation","workedExample","mnemonic","mapTitle","mapNodes","easierQuestion"],properties:{concept:{type:"string"},simpleExplanation:{type:"string"},workedExample:{type:"string"},mnemonic:{type:"string"},mapTitle:{type:"string"},mapNodes:{type:"array",minItems:3,maxItems:6,items:{type:"string"}},easierQuestion:questionSchema}};

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>null) as {question?:Question;chosen?:number}|null,q=body?.question;
  if(!q||!Number.isInteger(body?.chosen)||!Array.isArray(q.options))return NextResponse.json({error:"invalid_question"},{status:400});
  const runtime=await import("cloudflare:workers").catch(()=>null),key=(runtime?.env as unknown as Record<string,string|undefined>|undefined)?.OPENAI_API_KEY??process.env.OPENAI_API_KEY;
  if(!key)return NextResponse.json({error:"missing_key"},{status:503});
  const input=`O estudante errou a questão abaixo marcando ${String.fromCharCode(65+(body?.chosen??0))}. Crie uma intervenção pedagógica curta em português brasileiro. Explique com linguagem mais simples, dê um exemplo resolvido, uma frase de memorização e um mapa mental textual de 3 a 6 nós. Depois crie uma questão realmente mais fácil sobre o pré-requisito do mesmo conceito, com cinco alternativas e exatamente uma correta. A explanation deve usar Conceito:, Resolução: e Armadilha:. Confira o gabarito antes de responder.\n${JSON.stringify(q)}`;
  try{const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.4-mini",input,max_output_tokens:1800,reasoning:{effort:"low"},text:{format:{type:"json_schema",name:"adaptive_remediation",strict:true,schema}}})});
    if(!response.ok)return NextResponse.json({error:"generation_failed"},{status:response.status});
    const result=await response.json() as {output?:{content?:{type?:string;text?:string}[]}[]},text=result.output?.flatMap(x=>x.content??[]).find(x=>x.type==="output_text")?.text,data=JSON.parse(text??"{}");
    if(!data.easierQuestion)throw new Error("empty");
    return NextResponse.json({...data,easierQuestion:{...data.easierQuestion,id:Date.now()}});
  }catch{return NextResponse.json({error:"generation_failed"},{status:502})}
}
