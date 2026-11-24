import type {Workforce,Leave,Pay} from '../Workforce';
import type {RecordRow} from '../data';
import {localDay,scheduled,duration,approvedOvertime} from '../attendance/model';
export type Policy={id:string;name:string;paid:boolean;limited:boolean;allowance:number;accrual:'Upfront'|'Monthly';carryLimit:number;notice:number;evidenceAfter:number;approval:'Manager'|'Manager + HR';active:boolean};
export type Entitlement={id:string;employee:string;policy:string;year:number;allocation:number;carry:number;adjustment:number;reason:string};
export type Benefit={id:string;employee:string;name:string;employer:number;employeeCost:number;active:boolean};
export type Salary={id:string;employee:string;basic:number;allowance:number;deduction:number};
export type Run={id:string;period:string;status:'Draft'|'Reviewed'|'Approved'|'Exported';notes:string;reviewer:string;at:string;rows:Pay[]};
export type PayrollConfig={id:string;employee:string;externalId:string};
export type HRConfig={policies:Policy[];entitlements:Entitlement[];holidays:{id:string;date:string;name:string}[];benefits:Benefit[];salaries:Salary[];runs:Run[];mappings:PayrollConfig[];payslips:{id:string;employee:string;period:string;reference:string;file:File}[]};
const policy=(name:string,paid:boolean,limited:boolean):Policy=>({id:name,name,paid,limited,allowance:0,accrual:'Upfront',carryLimit:0,notice:0,evidenceAfter:0,approval:'Manager',active:true});
export const initialHRConfig=():HRConfig=>({policies:[policy('Annual',true,true),policy('Sick',true,true),policy('Family responsibility',true,true),policy('Unpaid',false,false),policy('Other',true,true)],entitlements:[],holidays:[],benefits:[],salaries:[],runs:[],mappings:[],payslips:[]});
export const config=(s:Workforce)=>s.hrConfig??initialHRConfig();
export function countDays(s:Workforce,employee:string,start:string,end:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)return 0;let n=0;for(let d=new Date(start+'T12:00:00Z'),i=0;Number.isFinite(+d)&&d.toISOString().slice(0,10)<=end&&i<3661;d.setUTCDate(d.getUTCDate()+1),i++){const date=d.toISOString().slice(0,10);if(!config(s).holidays.some(h=>h.date===date)&&(scheduled(s,employee,date)??(d.getUTCDay()!==0&&d.getUTCDay()!==6)))n++}return n}
export function balance(s:Workforce,employee:string,type:string,year:number,asOf=localDay()){
 const p=config(s).policies.find(x=>x.name===type),e=config(s).entitlements.find(x=>x.employee===employee&&x.policy===p?.id&&x.year===year);
 const start=year+'-01-01',end=year+'-12-31';
 const used=(status:string)=>s.leave.filter(l=>l.employee===employee&&l.type===type&&l.status===status&&l.start<=end&&l.end>=start).reduce((n,l)=>n+(l.days!==undefined&&l.start.slice(0,4)===String(year)&&l.end.slice(0,4)===String(year)?l.days:countDays(s,employee,l.start>start?l.start:start,l.end<end?l.end:end)),0);
 const months=asOf<start?0:asOf>end?12:Number(asOf.slice(5,7));
 const granted=e?(p?.accrual==='Monthly'?Math.floor(e.allocation*months/12*100)/100:e.allocation)+e.carry+e.adjustment:0;
 return {configured:!!e||p?.limited===false,unlimited:p?.limited===false,granted,approved:used('Approved'),pending:used('Pending'),available:Math.round((granted-used('Approved')-used('Pending'))*100)/100};
}
export function submitLeave(s:Workforce,people:RecordRow[],input:{employee:string;type:string;start:string;end:string;reason:string;evidence?:string},manager=''):Workforce{
 if(s.leaveConnection.mode==='external')throw Error('External leave system owns requests.');
 const p=config(s).policies.find(x=>x.name===input.type&&x.active),person=people.find(x=>x.id===input.employee&&x.status!=='Exited');
 if(!p||!person||input.start<person.values[5]||input.start>input.end||input.start.slice(0,4)!==input.end.slice(0,4))throw Error('Choose an eligible employee and dates within one entitlement year.');
 const days=countDays(s,input.employee,input.start,input.end);if(!days)throw Error('Select at least one scheduled working day.');
 if(s.leave.some(l=>l.employee===input.employee&&l.status!=='Rejected'&&l.start<=input.end&&l.end>=input.start))throw Error('Overlapping leave request.');
 if(p.notice&&input.start<new Date(Date.now()+p.notice*86400000).toISOString().slice(0,10))throw Error('Required notice period is not met.');
 if(p.evidenceAfter>0&&days>=p.evidenceAfter&&!input.evidence?.trim())throw Error('Supporting evidence reference required.');
 const b=balance(s,input.employee,input.type,Number(input.start.slice(0,4)));if(p.limited&&(!b.configured||days>b.available))throw Error('Insufficient or unconfigured entitlement.');
 return {...s,leave:[...s.leave,{...input,id:crypto.randomUUID(),status:'Pending',days,stage:'Manager',approval:p.approval,manager,paid:p.paid,history:[]}]};
}
export function reviewLeave(s:Workforce,id:string,decision:'Approved'|'Rejected',note:string,reviewer:string):Workforce{
 if(s.leaveConnection.mode==='external')throw Error('External mode is read-only.');
 const l=s.leave.find(x=>x.id===id);if(!l||l.status!=='Pending'||!note.trim()||!reviewer.trim())throw Error('Pending request, reviewer and reason required.');
 if(decision==='Approved'&&s.sessions.some(x=>x.employee===l.employee&&x.date>=l.start&&x.date<=l.end&&x.status!=='Rejected'))throw Error('Resolve overlapping attendance before approval.');
 const next=decision==='Approved'&&l.approval==='Manager + HR'&&l.stage!=='HR';
 if(decision==='Approved'&&!next){const p=config(s).policies.find(x=>x.name===l.type);const b=balance(s,l.employee,l.type,Number(l.start.slice(0,4)));if(p?.limited&&(!b.configured||b.available<0))throw Error('Entitlement requires review before approval.');}
 return {...s,leave:s.leave.map(x=>x.id===id?{...x,status:next?'Pending':decision,stage:next?'HR':'Complete',history:[...(x.history??[]),{reviewer,note:note.trim(),decision,stage:x.stage??'Manager',at:new Date().toISOString()}]}:x)};
}
export function withdrawLeave(s:Workforce,id:string,employee:string,note:string):Workforce{const l=s.leave.find(x=>x.id===id&&x.employee===employee);if(s.leaveConnection.mode==='external'||!l||l.status!=='Pending'||!note.trim())throw Error('Only pending local requests can be withdrawn.');return {...s,leave:s.leave.map(x=>x.id===id?{...x,status:'Rejected',stage:'Withdrawn',history:[...(x.history??[]),{reviewer:employee,note,decision:'Withdrawn',stage:x.stage??'Manager',at:new Date().toISOString()}]}:x)}}
export function saveEntitlement(s:Workforce,e:Entitlement){const p=config(s).policies.find(x=>x.id===e.policy);if(s.leaveConnection.mode==='external'||!p||!e.employee||!Number.isInteger(e.year)||e.year<2000||e.year>2100||![e.allocation,e.carry,e.adjustment].every(Number.isFinite)||e.allocation<0||e.carry<0||e.carry>p.carryLimit||!e.reason.trim())throw Error('Enter valid entitlement, carry-over and adjustment reason.');const b=balance({...s,hrConfig:{...config(s),entitlements:[...config(s).entitlements.filter(x=>x.id!==e.id),e]}},e.employee,p.name,e.year);if(b.available<0)throw Error('Allocation cannot fall below reserved and approved leave.');return {...s,hrConfig:{...config(s),entitlements:[...config(s).entitlements.filter(x=>x.id!==e.id),e]}}}
export const monthEnd=(period:string)=>period+'-'+String(new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7)),0)).getUTCDate()).padStart(2,'0');
export function workforceInputs(s:Workforce,employee:string,period:string){const from=period+'-01',to=monthEnd(period);const sessions=s.sessions.filter(x=>x.employee===employee&&x.date>=from&&x.date<=to);const leave=s.leave.filter(x=>x.employee===employee&&x.start<=to&&x.end>=from);return {hours:sessions.filter(x=>x.status==='Approved').reduce((n,x)=>n+duration(x),0),overtime:approvedOvertime(s,employee,from,to),unpaid:leave.filter(x=>x.status==='Approved'&&(x.paid===false||x.type==='Unpaid')).reduce((n,x)=>n+countDays(s,employee,x.start>from?x.start:from,x.end<to?x.end:to),0),pending:sessions.filter(x=>x.status==='Open'||x.status==='Pending review').length+leave.filter(x=>x.status==='Pending').length+(s.attendance?.requests??[]).filter(x=>x.employee===employee&&x.date>=from&&x.date<=to&&x.status==='Pending').length}}
export function prepareRun(s:Workforce,people:RecordRow[],period:string):Workforce{
 if(s.payConnection.mode==='external'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw Error('Choose a valid local preparation period.');
 const c=config(s),existing=c.runs.find(x=>x.period===period);if(existing&&existing.status!=='Draft')throw Error('Reviewed runs are locked.');
 const eligible=people.filter(x=>x.status!=='Exited'&&x.values[5]<=monthEnd(period));if(!eligible.length)throw Error('No eligible employees.');
 const rows=eligible.map(p=>{const salary=c.salaries.find(x=>x.employee===p.id);if(!salary)throw Error('Missing salary profile: '+p.values[0]);const benefits=c.benefits.filter(x=>x.employee===p.id&&x.active);return {id:period+'|'+p.id,employee:p.id,period,basic:salary.basic,allowance:salary.allowance,deduction:salary.deduction,status:'Draft' as const,benefitEmployer:benefits.reduce((n,x)=>n+x.employer,0),benefitEmployee:benefits.reduce((n,x)=>n+x.employeeCost,0),...workforceInputs(s,p.id,period)}});
 return {...s,pay:[...s.pay.filter(x=>x.period!==period),...rows],hrConfig:{...c,runs:[...c.runs.filter(x=>x.period!==period),{id:period,period,status:'Draft',notes:'',reviewer:'',at:'',rows}]}};
}
export function transitionRun(s:Workforce,period:string,action:'Reviewed'|'Approved'|'Exported'|'Draft',note:string,reviewer:string):Workforce{
 const c=config(s),run=c.runs.find(x=>x.period===period);if(s.payConnection.mode==='external'||!run||!note.trim()||!reviewer.trim())throw Error('Run and review reason required.');
 const expected={Reviewed:'Draft',Approved:'Reviewed',Exported:'Approved',Draft:'Reviewed'}[action];if(run.status!==expected)throw Error('Invalid run transition.');
 if(action==='Reviewed'||action==='Approved'){for(const row of run.rows){const live=workforceInputs(s,row.employee,period);if(live.pending||live.hours!==row.hours||live.overtime!==row.overtime||live.unpaid!==row.unpaid)throw Error('Resolve outstanding or changed workforce inputs and regenerate the draft.');}}
 const status=action==='Exported'?'Approved':action;const rows=run.rows.map(x=>({...x,status}));return {...s,pay:[...s.pay.filter(x=>x.period!==period),...rows],hrConfig:{...c,runs:c.runs.map(x=>x.id===run.id?{...x,status:action,notes:note.trim(),reviewer,at:new Date().toISOString(),rows}:x)}};
}
