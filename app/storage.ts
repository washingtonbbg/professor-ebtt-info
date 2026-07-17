"use client";
import type { Question } from "./data";

export type Attempt = { questionId:number; topic:string; chosen:number; correct:number; isCorrect:boolean; answeredAt:string };
export type StudyRecord = { id:string; date:string; minutes:number };
export type Progress = {
  answered:number; correct:number; studyMinutes:number; streak:number; favorites:number[];
  topicStatus:Record<string,string>; confidence:Record<string,number>; completedSessions:string[];
  errors:{questionId:number;chosen:number;correct:number;topic:string;reason:string;note:string;nextReview:string;resolved:boolean;prompt?:string;options?:string[]}[];
  reviews:Record<number,string>; simulationHistory:{date:string;score:number;total:number;mode:string}[];
  generatedQuestions:Question[]; attemptHistory:Attempt[]; studyHistory:StudyRecord[]; profile:{name:string};
  settings:{dailyGoal:number;hours:number;weekdays:number[];specificPriority:number;examDate:string;weights:{edital:number;frequency:number;errors:number;overdue:number}};
};

export const initial:Progress={answered:0,correct:0,studyMinutes:0,streak:0,favorites:[],topicStatus:{},confidence:{},completedSessions:[],errors:[],reviews:{},simulationHistory:[],generatedQuestions:[],attemptHistory:[],studyHistory:[],profile:{name:""},settings:{dailyGoal:90,hours:1.5,weekdays:[1,2,3,4,5,6],specificPriority:60,examDate:"",weights:{edital:30,frequency:25,errors:25,overdue:20}}};
const KEY="ebtt-ifmt-progress-v2";
let remoteReady=false;
function normalize(old:Partial<Progress>):Progress{return{...initial,...old,profile:{...initial.profile,...old.profile},settings:{...initial.settings,...old.settings,weights:{...initial.settings.weights,...old.settings?.weights}},generatedQuestions:old.generatedQuestions||[],attemptHistory:old.attemptHistory||[],studyHistory:old.studyHistory||[]}}
function local():Progress{try{return normalize(JSON.parse(localStorage.getItem(KEY)||localStorage.getItem("ebtt-ifmt-progress-v1")||"{}"))}catch{return initial}}
async function syncFromDatabase(device:Progress){try{const response=await fetch("/api/progress",{cache:"no-store"});if(!response.ok)return;const data=await response.json();if(data.progress){const remote=normalize(data.progress);if(JSON.stringify(remote)!==JSON.stringify(device)){localStorage.setItem(KEY,JSON.stringify(remote));location.reload();return}}remoteReady=true;if(!data.progress)await save(device)}catch{/* mantém o modo local quando estiver offline */}}
export function load():Progress{const device=local();void syncFromDatabase(device);return device}
export function save(v:Progress){localStorage.setItem(KEY,JSON.stringify(v));if(remoteReady)void fetch("/api/progress",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(v)}).catch(()=>null)}
export function reset(){localStorage.setItem(KEY,JSON.stringify(initial));remoteReady=false;void fetch("/api/progress",{method:"DELETE"}).catch(()=>null);return initial}
