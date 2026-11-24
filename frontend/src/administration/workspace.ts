import { initialCoreHR, reconcileEmployment, type CoreHR } from '../corehr/model';
import {useReducer,type SetStateAction} from 'react';
import {initialRecords,definitions,type RecordRow} from '../data';
import {initialOrg,type Org} from '../organisation/data';
import {initialWorkforce,type Workforce} from '../Workforce';
import {initialOperations,type Operations} from '../operations/model';
import {initialAdministration,type Administration} from './model';
export type AuditEvent={id:string;sequence:number;at:string;actor:string;module:string;action:string;reference:string;fields:string[];transition:string;outcome:string};
export type Workspace={store:Record<string,RecordRow[]>;org:Org;workforce:Workforce;operations:Operations;admin:Administration;core:CoreHR;audit:AuditEvent[]};
type Slice=Exclude<keyof Workspace,'audit'>;
type Change={module:string;action:string;reference:string;fields:string[];transition:string};
type Context={id:string;at:string;actor:string};
export type WorkspaceAction=({type:'change';apply:(state:Workspace)=>Workspace}|{type:'log';event:Change})&Context;
export function initialWorkspace():Workspace{return {store:initialRecords(),org:structuredClone(initialOrg),workforce:initialWorkforce(),operations:initialOperations(),admin:initialAdministration(),core:initialCoreHR(),audit:[]};}
function same(a:unknown,b:unknown){return JSON.stringify(a)===JSON.stringify(b);}
function compareRows<T extends {id:string}>(before:T[],after:T[],module:string,reference:(row:T)=>string):Change[]{
 const fields:Record<string,string>={values:'Record fields',status:'Status',stage:'Case stage',notes:'Case chronology',checklist:'Review checklist',evidence:'Evidence references',history:'Custody history',employee:'Employee assignment',returnDate:'Expected return',acknowledged:'Read acknowledgement',response:'Feedback response',vote:'Poll response',options:'Poll options',closed:'Poll state',owner:'Responsible owner',officer:'HR officer',updates:'Request history',openedAt:'First opened',acknowledgedAt:'Employee acknowledgement',issuedAt:'Policy availability',lastRemindedAt:'In-app reminder',reminderCount:'Reminder count',content:'Policy text',policyId:'Policy version',nextAction:'Next action',nextDate:'Follow-up date'};
 const changes:Change[]=[];
 for(const row of after){const old=before.find(r=>r.id===row.id);if(old&&same(old,row))continue;const oldObject=old as unknown as Record<string,unknown>|undefined,next=row as unknown as Record<string,unknown>;const keys=oldObject?Object.keys(next).filter(k=>k!=='id'&&!same(oldObject[k],next[k])):[];
 const from=oldObject?.status??oldObject?.stage,to=next.status??next.stage;
 changes.push({module,action:!old?'Created':from!==to?'Status changed':'Updated',reference:reference(row),fields:keys.map(k=>fields[k]??k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())),transition:old&&from!==to&&typeof from==='string'&&typeof to==='string'?`${from} → ${to}`:''});}
 for(const row of before)if(!after.some(r=>r.id===row.id))changes.push({module,action:'Removed',reference:reference(row),fields:[],transition:''});
 return changes;
}
export function detectChanges(before:Workspace,after:Workspace):Change[]{
 const changes:Change[]=[];
 for(const key of Object.keys({...before.store,...after.store})){
 const events=compareRows(before.store[key]??[],after.store[key]??[],key==='employees'?'Employees':key[0].toUpperCase()+key.slice(1),r=>key==='employees'?r.values[0]:r.id);
 for(const event of events){if(event.fields.includes('Record fields')){const row=after.store[key]?.find(r=>(key==='employees'?r.values[0]:r.id)===event.reference),old=row?before.store[key]?.find(r=>r.id===row.id):undefined;if(row&&old)event.fields=event.fields.flatMap(field=>field==='Record fields'?row.values.flatMap((value,i)=>value!==old.values[i]?[definitions[key]?.fields[i]??`Field ${i+1}`]:[]):[field]);}changes.push(event);}
 }
 for(const key of ['branches','departments','positions'] as const)changes.push(...compareRows<{id:string}>(before.org[key],after.org[key],'Organisation',r=>r.id));
 if(!same(before.org.chartLayout,after.org.chartLayout))changes.push({module:'Organisation',action:'Updated',reference:'Chart arrangement',fields:['Card positions'],transition:''});
 if(!same(before.org.assignments,after.org.assignments))changes.push({module:'Organisation',action:'Updated',reference:'Reporting assignments',fields:['Position and manager assignments'],transition:''});
 for(const [key,module] of [['leave','Leave Management'],['sessions','Digital Register'],['pay','Payroll']] as const)changes.push(...compareRows<{id:string}>(before.workforce[key],after.workforce[key],module,r=>r.id));
 for(const key of ['leaveConnection','payConnection'] as const)if(!same(before.workforce[key],after.workforce[key]))changes.push({module:key==='leaveConnection'?'Leave Management':'Payroll',action:'Updated',reference:'Integration configuration',fields:['Provider configuration'],transition:''});
 changes.push(...compareRows(before.operations.obligations,after.operations.obligations,'Compliance',r=>r.id),...compareRows(before.operations.policies,after.operations.policies,'Policies',r=>r.id),...compareRows(before.operations.cases,after.operations.cases,'Employee Relations',r=>r.reference),...compareRows(before.operations.assets,after.operations.assets,'Assets',r=>r.tag),...compareRows(before.operations.posts,after.operations.posts,'Engagement',r=>r.id),...compareRows(before.operations.polls,after.operations.polls,'Engagement',r=>r.id),...compareRows(before.operations.feedback,after.operations.feedback,'Engagement',r=>r.id),...compareRows(before.admin.requests,after.admin.requests,'Self-Service',r=>r.reference));
 if(!same(before.admin.settings,after.admin.settings)){const labels:Record<string,string>={companyName:'Organisation name',location:'Office location',hrEmail:'HR contact email',density:'Table density',receiptNote:'Request receipt message',services:'Request catalogue'};changes.push({module:'Settings',action:'Updated',reference:'Workspace configuration',fields:(Object.keys(after.admin.settings) as (keyof Administration['settings'])[]).filter(k=>!same(before.admin.settings[k],after.admin.settings[k])).map(k=>labels[k]),transition:''});}
 for(const id of Object.keys(after.admin.contacts))if(!same(before.admin.contacts[id],after.admin.contacts[id]))changes.push({module:'Self-Service',action:'Updated',reference:id,fields:['Contact details'],transition:''});
 for(const event of compareRows(before.operations.policyDeliveries,after.operations.policyDeliveries,'Policy Acknowledgements',r=>r.id)){const next=after.operations.policyDeliveries.find(d=>d.id===event.reference),old=before.operations.policyDeliveries.find(d=>d.id===event.reference);if(!old&&next)event.action='Distributed';else if(old&&next){if(!old.acknowledgedAt&&next.acknowledgedAt)event.action='Acknowledged';else if(!old.openedAt&&next.openedAt)event.action='Opened';else if(next.reminderCount>old.reminderCount)event.action='Reminded';else if(old.state!==next.state){event.action='Status changed';event.transition=old.state+' → '+next.state;}}changes.push(event);}
 for(const [key,module] of [['contracts','Contracts'],['documents','Personnel Documents'],['requirements','Personnel Documents'],['probations','Probation'],['history','Employment History']] as const)changes.push(...compareRows<{id:string}>(before.core[key],after.core[key],module,r=>r.id));
 for(const employee of Object.keys(after.core.personal))if(!same(before.core.personal[employee],after.core.personal[employee]))changes.push({module:'Employees',action:'Updated',reference:employee,fields:['Personal information and emergency contact'],transition:''});
 return changes;
}
export function workspaceReducer(state:Workspace,action:WorkspaceAction):Workspace{
 const next=action.type==='change'?reconcileEmployment(state,action.apply(state),action.at):state;
 const changes=action.type==='change'?detectChanges(state,next):[action.event];
 if(!changes.length)return state;
 const events=changes.map((change,index)=>({...change,id:`${action.id}:${index}`,sequence:state.audit.length+index+1,at:action.at,actor:action.actor,outcome:'Applied in demo'}));
 return {...next,audit:[...state.audit,...events]};
}
export function changeAction<K extends Slice>(slice:K,value:SetStateAction<Workspace[K]>,actor='Demo HR user',context?:Partial<Context>):WorkspaceAction{return {type:'change',id:context?.id??crypto.randomUUID(),at:context?.at??new Date().toISOString(),actor:context?.actor??actor,apply:state=>({...state,[slice]:typeof value==='function'?(value as (previous:Workspace[K])=>Workspace[K])(state[slice]):value})};}
export type UpdateSlice<K extends Slice>=(value:SetStateAction<Workspace[K]>,actor?:string)=>void;
export function useWorkspace(){const [state,dispatch]=useReducer(workspaceReducer,undefined,initialWorkspace);return {state,
 setStore:((value,actor)=>dispatch(changeAction('store',value,actor))) as UpdateSlice<'store'>,
 setOrg:((value,actor)=>dispatch(changeAction('org',value,actor))) as UpdateSlice<'org'>,
 setWorkforce:((value,actor)=>dispatch(changeAction('workforce',value,actor))) as UpdateSlice<'workforce'>,
 setOperations:((value,actor)=>dispatch(changeAction('operations',value,actor))) as UpdateSlice<'operations'>,
 setCore:((value,actor)=>dispatch(changeAction('core',value,actor))) as UpdateSlice<'core'>,
 commit:(apply:(state:Workspace)=>Workspace,actor='Demo HR user')=>dispatch({type:'change',apply,id:crypto.randomUUID(),at:new Date().toISOString(),actor}),
 setAdmin:((value,actor)=>dispatch(changeAction('admin',value,actor))) as UpdateSlice<'admin'>,
 logExport:(count:number)=>dispatch({type:'log',id:crypto.randomUUID(),at:new Date().toISOString(),actor:'Demo HR user',event:{module:'Audit Logs',action:'Exported',reference:`${count} filtered session events`,fields:[],transition:''}}),
 };}
