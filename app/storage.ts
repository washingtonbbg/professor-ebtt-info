"use client";
import type { Question } from "./data";

export type Attempt = { questionId:number; topic:string; chosen:number; correct:number; isCorrect:boolean; answeredAt:string };
export type Progress = {
  answered:number; correct:number; studyMinutes:number; streak:number; favorites:number[];
  topicStatus:Record<string,string>; confidence:Record<string,number>; completedSessions:string[];
  errors:{questionId:number;chosen:number;correct:number;topic:string;reason:string;note:string;nextReview:string;resolved:boolean;prompt?:string;options?:string[]}[];
  reviews:Record<number,string>; simulationHistory:{date:string;score:number;total:number;mode:string}[];
  generatedQuestions:Question[]; attemptHistory:Attempt[]; profile:{name:string};
  settings:{dailyGoal:number;hours:number;weekdays:number[];specificPriority:number;examDate:string;weights:{edital:number;frequency:number;errors:number;overdue:number}};
};

export const initial:Progress={answered:0,correct:0,studyMinutes:0,streak:0,favorites:[],topicStatus:{},confidence:{},completedSessions:[],errors:[],reviews:{},simulationHistory:[],generatedQuestions:[],attemptHistory:[],profile:{name:""},settings:{dailyGoal:90,hours:1.5,weekdays:[1,2,3,4,5,6],specificPriority:60,examDate:"",weights:{edital:30,frequency:25,errors:25,overdue:20}}};
const KEY="ebtt-ifmt-progress-v2";
export function load():Progress{try{const old=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem("ebtt-ifmt-progress-v1")||"{}");return{...initial,...old,profile:{...initial.profile,...old.profile},settings:{...initial.settings,...old.settings,weights:{...initial.settings.weights,...old.settings?.weights}},generatedQuestions:old.generatedQuestions||[],attemptHistory:old.attemptHistory||[]}}catch{return initial}}
export function save(v:Progress){localStorage.setItem(KEY,JSON.stringify(v))}
export function reset(){localStorage.setItem(KEY,JSON.stringify(initial));return initial}
