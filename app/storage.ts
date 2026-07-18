"use client";
import type { Question } from "./data";

export type Attempt = { questionId:number; topic:string; chosen:number; correct:number; isCorrect:boolean; answeredAt:string };
export type StudyRecord = { id:string; date:string; minutes:number };
export type AIMessage = { id:string; role:"user"|"assistant"; content:string; createdAt:string; assistant:string };
export type Progress = {
  answered:number; correct:number; studyMinutes:number; streak:number; favorites:number[];
  topicStatus:Record<string,string>; confidence:Record<string,number>; completedSessions:string[];
  errors:{questionId:number;chosen:number;correct:number;topic:string;reason:string;note:string;nextReview:string;resolved:boolean;prompt?:string;options?:string[]}[];
  reviews:Record<number,string>; simulationHistory:{date:string;score:number;total:number;mode:string}[];
  generatedQuestions:Question[]; attemptHistory:Attempt[]; studyHistory:StudyRecord[]; profile:{name:string};
  aiChats:Record<string,AIMessage[]>;
  settings:{dailyGoal:number;hours:number;weekdays:number[];specificPriority:number;examDate:string;weights:{edital:number;frequency:number;errors:number;overdue:number}};
};

export const initial:Progress={answered:0,correct:0,studyMinutes:0,streak:0,favorites:[],topicStatus:{},confidence:{},completedSessions:[],errors:[],reviews:{},simulationHistory:[],generatedQuestions:[],attemptHistory:[],studyHistory:[],aiChats:{},profile:{name:""},settings:{dailyGoal:90,hours:1.5,weekdays:[1,2,3,4,5,6],specificPriority:60,examDate:"",weights:{edital:30,frequency:25,errors:25,overdue:20}}};
const KEY="ebtt-ifmt-progress-v2";
let remoteReady=false;
function normalize(old:Partial<Progress>):Progress{return{...initial,...old,profile:{...initial.profile,...old.profile},settings:{...initial.settings,...old.settings,weights:{...initial.settings.weights,...old.settings?.weights}},generatedQuestions:old.generatedQuestions||[],attemptHistory:old.attemptHistory||[],studyHistory:old.studyHistory||[],aiChats:old.aiChats||{}}}
function local():Progress{try{return normalize(JSON.parse(localStorage.getItem(KEY)||localStorage.getItem("ebtt-ifmt-progress-v1")||"{}"))}catch{return initial}}
function union<T>(a:T[],b:T[],key:(item:T)=>string){const rows=new Map<string,T>();for(const item of [...a,...b])rows.set(key(item),item);return[...rows.values()]}
function mergeQuestions(remote:Question[],device:Question[]){const rows=new Map<number,Question>();for(const item of [...remote,...device]){const saved=rows.get(item.id),savedReviewed=saved?.sourceNote?.includes("revisada por IA"),incomingReviewed=item.sourceNote?.includes("revisada por IA");if(!saved||incomingReviewed||!savedReviewed)rows.set(item.id,item)}return[...rows.values()]}
function merge(remote:Progress,device:Progress):Progress{const attemptHistory=union(remote.attemptHistory,device.attemptHistory,a=>`${a.questionId}:${a.answeredAt}`),studyHistory=union(remote.studyHistory,device.studyHistory,s=>s.id),generatedQuestions=mergeQuestions(remote.generatedQuestions,device.generatedQuestions),errors=union(remote.errors,device.errors,e=>`${e.questionId}:${e.chosen}:${e.nextReview}`),chatKeys=new Set([...Object.keys(remote.aiChats),...Object.keys(device.aiChats)]),aiChats=Object.fromEntries([...chatKeys].map(key=>[key,union(remote.aiChats[key]||[],device.aiChats[key]||[],m=>m.id).slice(-40)]));return normalize({...remote,...device,attemptHistory,studyHistory,generatedQuestions,errors,aiChats,favorites:[...new Set([...remote.favorites,...device.favorites])],completedSessions:[...new Set([...remote.completedSessions,...device.completedSessions])],topicStatus:{...remote.topicStatus,...device.topicStatus},confidence:{...remote.confidence,...device.confidence},reviews:{...remote.reviews,...device.reviews},simulationHistory:union(remote.simulationHistory,device.simulationHistory,s=>`${s.date}:${s.mode}`),answered:attemptHistory.length,correct:attemptHistory.filter(a=>a.isCorrect).length,studyMinutes:Math.max(remote.studyMinutes,device.studyMinutes,studyHistory.reduce((sum,s)=>sum+s.minutes,0))})}
async function put(progress:Progress){return fetch("/api/progress",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(progress)})}
async function syncFromDatabase(device:Progress){try{const response=await fetch("/api/progress",{cache:"no-store"});if(!response.ok)return;const data=await response.json();if(data.progress){const combined=merge(normalize(data.progress),device);await put(combined);if(JSON.stringify(combined)!==JSON.stringify(device)){localStorage.setItem(KEY,JSON.stringify(combined));location.reload();return}}remoteReady=true;if(!data.progress)await put(device)}catch{/* mantém o modo local quando estiver offline */}}
export function load():Progress{const device=local();void syncFromDatabase(device);return device}
export function save(v:Progress){localStorage.setItem(KEY,JSON.stringify(v));if(remoteReady)void put(v).catch(()=>null)}
export function reset(){localStorage.setItem(KEY,JSON.stringify(initial));remoteReady=false;void fetch("/api/progress",{method:"DELETE"}).catch(()=>null);return initial}
