import type {RecordRow} from '../data';
import type {Workforce} from '../Workforce';
import type {Operations} from '../operations/model';
import {today} from '../operations/model';

export type IntelligenceData={employees:RecordRow[];workforce:Workforce;operations:Operations};
export type ReportScope={start:string;end:string;department:string};
export const defaultScope=():ReportScope=>({start:today(-29),end:today(),department:''});
export function dateRange(start:string,end:string):string[]{
 const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 if(!valid(start)||!valid(end)||end<start)return [];
 const days=Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1;
 if(days>92)return [];
 return Array.from({length:days},(_,i)=>new Date(Date.parse(start+'T12:00:00Z')+i*86400000).toISOString().slice(0,10));
}
export function weekdays(start:string,end:string,scope:ReportScope){return dateRange(scope.start,scope.end).filter(d=>d>=start&&d<=end&&![0,6].includes(new Date(d+'T12:00:00Z').getUTCDay()));}
export function sessionHours(session:Workforce['sessions'][number]){const hours=(Date.parse(session.end)-Date.parse(session.start))/3600000;return Number.isFinite(hours)&&hours>0?hours:0;}
const group=(labels:string[])=>[...new Set(labels)].map(label=>({label,count:labels.filter(v=>v===label).length})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
export function buildReport(data:IntelligenceData,scope:ReportScope){
 const days=dateRange(scope.start,scope.end);
 const people=data.employees.filter(e=>!scope.department||e.values[2]===scope.department);
 const ids=new Set(people.map(e=>e.id));
 const current=people.filter(e=>e.status!=='Exited'&&(!e.values[5]||e.values[5]<=today()));
 const sessions=days.length?data.workforce.sessions.filter(s=>ids.has(s.employee)&&s.date>=scope.start&&s.date<=scope.end):[];
 const accepted=sessions.filter(s=>s.status!=='Rejected');
 const approved=sessions.filter(s=>s.status==='Approved');
 const leave=days.length?data.workforce.leave.filter(l=>ids.has(l.employee)&&l.start<=scope.end&&l.end>=scope.start):[];
 const approvedLeave=leave.filter(l=>l.status==='Approved');
 const leaveDays=new Set(approvedLeave.flatMap(l=>weekdays(l.start,l.end,scope).map(day=>l.employee+'|'+day)));
 const obligations=data.operations.obligations.filter(o=>!scope.department||ids.has(o.owner));
 const cases=data.operations.cases.filter(c=>!scope.department||ids.has(c.employee));
 const assets=data.operations.assets.filter(a=>!scope.department||ids.has(a.employee));
 const departmentRows=group(current.map(e=>e.values[2]||'Unassigned'));
 return {days,people,current,sessions,accepted,approved,leave,approvedLeave,
  joiners:days.length?people.filter(e=>e.values[5]>=scope.start&&e.values[5]<=scope.end):[],
  departments:departmentRows,contracts:group(current.map(e=>e.values[4]||'Unspecified')),
  hours:approved.reduce((sum,s)=>sum+sessionHours(s),0),
  recordedPeople:new Set(accepted.map(s=>s.employee)).size,
  employeeDays:new Set(accepted.map(s=>s.employee+'|'+s.date)).size,
  daily:days.map(date=>({date,people:new Set(accepted.filter(s=>s.date===date).map(s=>s.employee)).size,hours:approved.filter(s=>s.date===date).reduce((sum,s)=>sum+sessionHours(s),0)})),
  workplaces:group(accepted.map(s=>s.place)),
  pendingAttendance:sessions.filter(s=>s.status==='Pending review'),
  pendingLeave:leave.filter(l=>l.status==='Pending'),leaveDays:leaveDays.size,
  leaveTypes:group(approvedLeave.map(l=>l.type)).map(row=>({...row,days:new Set(approvedLeave.filter(l=>l.type===row.label).flatMap(l=>weekdays(l.start,l.end,scope).map(day=>l.employee+'|'+day))).size})),
  obligations,cases,assets,
  overdueObligations:obligations.filter(o=>o.status!=='Compliant'&&o.due<today()),
  openCases:cases.filter(c=>c.stage!=='Resolved'&&c.stage!=='Closed'),
  overdueAssets:assets.filter(a=>a.status==='Allocated'&&a.returnDate&&a.returnDate<today()),
  complianceMix:group(obligations.map(o=>o.status!=='Compliant'&&o.due<today()?'Overdue':o.status)),
  caseMix:group(cases.map(c=>c.stage)),assetMix:group(assets.map(a=>a.status)),
 };
}
export type Report=ReturnType<typeof buildReport>;
export const personName=(data:IntelligenceData,id:string)=>data.employees.find(e=>e.id===id)?.values[1]??'Unassigned';
export function csvText(rows:(string|number)[][]){return rows.map(row=>row.map(v=>{let value=String(v);if(/^[\s]*[=+@-]/.test(value))value="'"+value;return '"'+value.replaceAll('"','""')+'"'}).join(',')).join('\r\n');}
export function exportRows(report:Report,scope:ReportScope,section:string):(string|number)[][]{
 const name=(id:string)=>report.people.find(e=>e.id===id)?.values[1]??'Unassigned';
 const context=[['Report',section],['Department',scope.department||'All departments'],['Period',scope.start+' to '+scope.end],['Snapshot date',today()]];
 if(section==='Workforce')return [...context,['Basis','Current employee status; no historical headcount reconstruction'],[],['Employee number','Name','Department','Position','Contract','Start date','Current status'],...report.people.map(e=>[...e.values,e.status])];
 if(section==='Attendance')return [...context,['Basis','Hours from approved closed sessions, assigned to register date'],[],['Date','Employee ID','Employee','Workplace','Start','End','Status','Approved hours'],...report.sessions.map(s=>[s.date,s.employee,name(s.employee),s.place,s.start,s.end,s.status,s.status==='Approved'?sessionHours(s).toFixed(2):''])];
 if(section==='Leave')return [...context,['Basis','Weekdays within selected period; public holidays not excluded'],[],['Employee ID','Employee','Type','From','To','Weekdays in period','Status'],...report.leave.map(l=>[l.employee,name(l.employee),l.type,l.start,l.end,weekdays(l.start,l.end,scope).length,l.status])];
 return [...context,['Basis','Current operations snapshot; date filter does not apply'],[],['Area','Reference','State','Due date'],...report.obligations.map(o=>['Compliance',o.title,o.status!=='Compliant'&&o.due<today()?'Overdue':o.status,o.due]),...report.cases.map(c=>['Employee relations',c.reference,c.stage,c.nextDate]),...report.assets.map(a=>['Assets',a.tag,a.status,a.returnDate])];
}
export type AssistantAnswer={title:string;text:string;facts:{label:string;value:string|number}[];source:string;href:string;basis:string};
export function answerQuestion(question:string,data:IntelligenceData,scope:ReportScope):AssistantAnswer{
 const q=question.toLowerCase(),r=buildReport(data,scope),period=`${scope.start} to ${scope.end}`,department=scope.department||'All departments';
 const answer=(title:string,text:string,facts:AssistantAnswer['facts'],source:string,href:string,basis:string)=>({title,text,facts,source,href,basis});
 if(/\b(policy|policies|entitle|entitled|entitlement|legal|law|dismiss|fire|tax|diagnos|salary|pay rise|recommend.*employee)\b/.test(q))return answer('A verified policy source is needed','Published policies can be read and acknowledged in self-service. This demo does not interpret policy text or determine entitlement; ask HR to confirm policy or individual employment decisions.',[],'HR requests','/self-service','No policy answer generated.');
 if(!dateRange(scope.start,scope.end).length)return answer('Check your reporting dates','Choose a valid range of up to 92 days.',[],'HR Analytics','/analytics','Invalid reporting period.');
 if(/\b(leave|holiday|vacation)\b/.test(q))return answer('Leave in your selected period','Requests are included when their dates overlap your reporting period. Approved days count weekdays only.',[{label:'Pending requests',value:r.pendingLeave.length},{label:'Approved requests',value:r.approvedLeave.length},{label:'Approved employee weekdays',value:r.leaveDays}],'Leave Management','/leave',`${department} · ${period} · No entitlement or balance calculation.`);
 if(/\b(attendance|clock|hours|register|remote)\b/.test(q))return answer('Recorded attendance','Approved hours exclude open, rejected and unreviewed sessions. Attendance records do not verify physical presence.',[{label:'People with records',value:r.recordedPeople},{label:'Approved hours',value:r.hours.toFixed(1)},{label:'Awaiting review',value:r.pendingAttendance.length}],'Digital Register','/register',`${department} · ${period} · Hours assigned to register date.`);
 if(/\b(compliance|overdue obligation|evidence)\b/.test(q))return answer('Compliance review queue','These are current obligations owned by people in the selected department. Review the evidence in the compliance workspace.',[{label:'Overdue obligations',value:r.overdueObligations.length},{label:'In review',value:r.obligations.filter(o=>o.status==='In review').length},{label:'Compliant',value:r.obligations.filter(o=>o.status==='Compliant').length}],'Compliance & Governance','/compliance',`${department} · Current snapshot as of ${today()}; date range does not apply.`);
 if(/\b(asset|assets|equipment|laptop|returns|repair)\b/.test(q))return answer('Equipment custody','Overdue returns are allocated equipment with a return date before today. Department scope includes equipment currently assigned to that department.',[{label:'Allocated',value:r.assets.filter(a=>a.status==='Allocated').length},{label:'Overdue returns',value:r.overdueAssets.length},{label:'In repair',value:r.assets.filter(a=>a.status==='Repair').length}],'Asset Management','/assets',`${department} · Current snapshot as of ${today()}; unassigned stock is company-wide.`);
 if(/\b(case|cases|relations|grievance)\b/.test(q))return answer('Employee relations workload','This summary shows case stages only. Open the case workspace for the authorised review process.',[{label:'Active cases',value:r.openCases.length},{label:'Resolved',value:r.cases.filter(c=>c.stage==='Resolved').length},{label:'Closed',value:r.cases.filter(c=>c.stage==='Closed').length}],'Employee Relations','/relations',`${department} · Current snapshot as of ${today()}; no individual case details included.`);
 if(/\b(employee|employees|headcount|workforce|people|department|joiners|hires|contracts)\b/.test(q))return answer('Your current workforce','Current headcount excludes employees marked exited. Joiners are selected by recorded start date; historical headcount and turnover are unavailable.',[{label:'Current employees',value:r.current.length},{label:'Departments',value:r.departments.length},{label:'Joiners in period',value:r.joiners.length}],'Employees','/employees',`${department} · Headcount is current; joiners cover ${period}.`);
 return answer('Try a question about your records','I can summarise workforce, attendance, leave, compliance, cases or assets. This is a record-based demo assistant; it does not run a language model or change records.',[],'HR Analytics','/analytics',`${department} · ${period} · No external sources used.`);
}
