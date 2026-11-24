import type {Org} from '../organisation/data';
import type {RecordRow} from '../data';
import type {Workforce} from '../Workforce';
import {reviewLeave} from '../hrworkforce/model';
import {decide,onLeave} from '../attendance/model';
export const roles=['admin','hr','manager','employee'] as const;
export type UserRole=typeof roles[number];
export type UserAccount={id:string;name:string;email:string;role:UserRole;employee:string;active:boolean};
export const roleLabels:Record<UserRole,string>={admin:'System Administrator',hr:'Human Resources',manager:'Manager',employee:'Employee'};
export const roleHome:Record<UserRole,string>={admin:'/admin',hr:'/dashboard',manager:'/team',employee:'/self-service'};
export const initialAccounts=():UserAccount[]=>[
 {id:'user-admin',name:'System Administrator',email:'admin@example.invalid',role:'admin',employee:'employees-6',active:true},
 {id:'user-hr',name:'HR Administrator',email:'hr@example.invalid',role:'hr',employee:'employees-5',active:true},
 {id:'user-manager',name:'Team Manager',email:'manager@example.invalid',role:'manager',employee:'employees-2',active:true},
 {id:'user-employee',name:'Employee',email:'employee@example.invalid',role:'employee',employee:'employees-1',active:true},
];
export function accountForEmail(accounts:UserAccount[],email:string){return accounts.find(a=>a.active&&a.email.toLowerCase()===email.trim().toLowerCase())??null;}
export function teamIds(org:Org,manager:string){const result=new Set<string>(),queue=[manager];while(queue.length){const id=queue.shift()!;for(const a of org.assignments)if(a.manager===id&&a.employee!==manager&&!result.has(a.employee)){result.add(a.employee);queue.push(a.employee)}}return result;}
export function canVisit(role:UserRole,path:string){
 if(path==='/self-service')return true;
 if(role==='admin')return ['/admin','/users','/permissions','/system','/integrations','/security','/audit'].includes(path);
 if(role==='manager')return ['/team','/team/leave','/team/attendance','/team/overtime','/team/performance','/organisation'].includes(path);
 if(role==='employee')return path==='/organisation';
 return ['/dashboard','/employees','/organisation','/register','/attendance','/leave','/payroll','/performance','/learning','/skills','/tenders','/compliance','/relations','/assets','/engagement','/analytics','/assistant','/settings'].includes(path);
}
export function saveAccount(accounts:UserAccount[],draft:UserAccount,actorId:string,employees:RecordRow[]){
 const clean={...draft,name:draft.name.trim(),email:draft.email.trim().toLowerCase()};
 if(!clean.name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)||!roles.includes(clean.role))throw Error('Enter a name, valid email and assigned role.');
 if(!employees.some(e=>e.id===clean.employee&&e.status!=='Exited'))throw Error('Link the account to a current employee for personal services.');
 if(accounts.some(a=>a.id!==clean.id&&a.email.toLowerCase()===clean.email))throw Error('That email is already assigned to another account.');
 const old=accounts.find(a=>a.id===clean.id);if(clean.id===actorId&&old&&(old.role!==clean.role||!clean.active))throw Error('You cannot change your own role or deactivate your current account.');
 const next=[...accounts.filter(a=>a.id!==clean.id),clean];if(!next.some(a=>a.active&&a.role==='admin'))throw Error('Keep at least one active system administrator.');return next;
}
export function managerDecision(state:Workforce,org:Org,manager:string,kind:'leave'|'attendance'|'overtime',id:string,decision:'Approved'|'Rejected',note:string,reviewer:string):Workforce{
 if(!note.trim())throw Error('Record a reason for the decision.');const team=teamIds(org,manager);
 if(kind==='leave'){const row=state.leave.find(r=>r.id===id);if(!row||!team.has(row.employee)||row.employee===manager||row.stage==='HR')throw Error('Only your team’s manager-stage leave requests can be reviewed here.');return reviewLeave(state,id,decision,note,reviewer);}
 if(kind==='overtime'){const row=state.attendance?.requests.find(r=>r.id===id&&r.kind==='Overtime');if(!row||!team.has(row.employee)||row.employee===manager)throw Error('Only your team’s overtime requests can be reviewed here.');return decide(state,id,decision,note,reviewer);}
 const row=state.sessions.find(r=>r.id===id);if(!row||!team.has(row.employee)||row.employee===manager||row.status!=='Pending review')throw Error('Choose a pending attendance record from your own team.');if(decision==='Approved'&&onLeave(state,row.employee,row.date))throw Error('Resolve the overlapping approved leave before approving hours.');
 return {...state,sessions:state.sessions.map(r=>r.id===id?{...r,status:decision,reviewNote:note.trim(),reviewer,reviewedAt:new Date().toISOString()}:r)};
}
