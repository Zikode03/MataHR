import type {Workforce} from '../Workforce';
import type {RecordRow} from '../data';
export type Location={id:string;name:string;kind:string;address:string;active:boolean};
export type Schedule={id:string;employee:string;days:number[];start:string;end:string;grace:number};
export type Request={id:string;employee:string;session:string;date:string;kind:'Correction'|'Overtime';start:string;end:string;reason:string;status:'Pending'|'Approved'|'Rejected';reviewNote:string;reviewer:string;reviewedAt:string;previous?:{start:string;end:string;status:string}};
export type Attendance={locations:Location[];schedules:Schedule[];requests:Request[];verification:{id:string;method:string;required:boolean}[]};
export const initialAttendance=():Attendance=>({locations:[{id:'office',name:'Durban office (demo)',kind:'Office',address:'Fictional workplace',active:true},{id:'remote',name:'Approved remote work (demo)',kind:'Remote',address:'Approved arrangement required',active:true},{id:'client',name:'Client site (demo)',kind:'Client site',address:'Approved site required',active:true}],schedules:[],requests:[],verification:['GPS geofence','Dynamic QR','Office network','Attendance device','Remote approval'].map(method=>({id:method,method,required:false}))});
export const attendance=(s:Workforce)=>s.attendance??initialAttendance();
export const localDay=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export const clockTime=(s:string)=>s?new Date(s).toLocaleTimeString('en-ZA',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
export const duration=(s:{start:string;end:string})=>s.end?Math.max(0,(Date.parse(s.end)-Date.parse(s.start))/3600000):0;
export const currentStaff=(people:RecordRow[],date:string)=>people.filter(p=>p.status!=='Exited'&&p.values[5]<=date);
export const onLeave=(s:Workforce,id:string,date:string)=>s.leave.some(l=>l.employee===id&&l.status==='Approved'&&l.start<=date&&l.end>=date);
export const scheduleFor=(s:Workforce,id:string)=>attendance(s).schedules.find(x=>x.employee===id);
export const scheduled=(s:Workforce,id:string,date:string)=>scheduleFor(s,id)?.days.includes(new Date(date+'T12:00:00Z').getUTCDay());
export function clock(s:Workforce,people:RecordRow[],employee:string,location:string,now=new Date(),evidence='Not checked'):Workforce{
 const date=localDay(now),stamp=now.toISOString(),open=s.sessions.find(x=>x.employee===employee&&x.status==='Open');
 if(open){if(Date.parse(stamp)<=Date.parse(open.start))throw Error('Clock-out must follow clock-in.');return {...s,sessions:s.sessions.map(x=>x.id===open.id?{...x,end:stamp,status:'Pending review'}:x)}}
 if(!currentStaff(people,date).some(p=>p.id===employee))throw Error('Select a current employee.');
 if(onLeave(s,employee,date))throw Error('Approved leave exists for this date.');
 const loc=attendance(s).locations.find(l=>l.id===location&&l.active);
 if(!loc)throw Error('Select an active work location.');
 if(s.sessions.some(x=>x.employee===employee&&x.status!=='Rejected'&&Date.parse(x.start)<=Date.parse(stamp)&&(!x.end||Date.parse(x.end)>Date.parse(stamp))))throw Error('Attendance overlaps an existing session.');
 return {...s,sessions:[...s.sessions,{id:crypto.randomUUID(),employee,date,start:stamp,end:'',place:loc.kind,status:'Open',location:loc.name,evidence}]};
}
export function exceptions(s:Workforce,id:string,date:string):string[]{
 const rows=s.sessions.filter(x=>x.employee===id&&x.date===date&&x.status!=='Rejected').sort((a,b)=>a.start.localeCompare(b.start));
 const sch=scheduleFor(s,id),out:string[]=[];
 if(onLeave(s,id,date)){if(rows.length)out.push('Attendance overlaps approved leave');return out;}
 if(!rows.length){if(scheduled(s,id,date)&&date<localDay())out.push('Missing clock-in');return out;}
 if(rows.some(x=>x.status==='Open')&&date<localDay())out.push('Missing clock-out');
 if(rows.some(x=>x.evidence!=='Simulated match'))out.push('Unverified attendance');
 if(sch&&scheduled(s,id,date)){const mins=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5));if(mins(clockTime(rows[0].start))>mins(sch.start)+sch.grace)out.push('Late arrival');const last=rows[rows.length-1];if(last.end&&mins(clockTime(last.end))<mins(sch.end))out.push('Early departure');}
 return out;
}
export function submitRequest(s:Workforce,people:RecordRow[],input:Omit<Request,'id'|'status'|'reviewNote'|'reviewer'|'reviewedAt'|'previous'>):Workforce{
 const {employee,date,start,end,session,kind}=input;
 if(!currentStaff(people,date).some(p=>p.id===employee)||!date||date>localDay()||!input.reason.trim())throw Error('Choose an eligible employee, past or current date and reason.');
 if(!start||!end||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start)||localDay(new Date(start))!==date||Date.parse(end)>Date.now())throw Error('Enter valid completed hours on the selected date.');
 const existing=s.sessions.find(x=>x.id===session);
 if(session&&(!existing||existing.employee!==employee||existing.date!==date||existing.status==='Rejected'))throw Error('Choose a matching attendance record.');
 if(kind==='Correction'&&onLeave(s,employee,date))throw Error('Resolve approved leave before correcting attendance.');
 if(kind==='Overtime'&&(!existing||existing.status!=='Approved'||!existing.end||Date.parse(start)<Date.parse(existing.start)||Date.parse(end)>Date.parse(existing.end)))throw Error('Overtime must fall within a reviewed attendance session.');
 if(kind==='Overtime'){const sch=scheduleFor(s,employee);if(!sch)throw Error('Configure a schedule before requesting overtime.');if(scheduled(s,employee,date)&&Date.parse(start)<Date.parse(date+'T'+sch.end+':00+02:00')&&Date.parse(end)>Date.parse(date+'T'+sch.start+':00+02:00'))throw Error('Overtime must be outside scheduled hours.');}
 if(attendance(s).requests.some(x=>x.employee===employee&&x.kind===kind&&x.status!=='Rejected'&&(kind==='Correction'?x.status==='Pending'&&x.date===date&&x.session===session:Date.parse(x.start)<Date.parse(end)&&Date.parse(x.end)>Date.parse(start))))throw Error('An overlapping request already exists.');
 if(kind==='Correction'&&s.sessions.some(x=>x.id!==session&&x.employee===employee&&x.status!=='Rejected'&&Date.parse(x.start)<Date.parse(end)&&(!x.end||Date.parse(x.end)>Date.parse(start))))throw Error('Correction overlaps another attendance session.');
 return {...s,attendance:{...attendance(s),requests:[...attendance(s).requests,{...input,reason:input.reason.trim(),id:crypto.randomUUID(),status:'Pending',reviewNote:'',reviewer:'',reviewedAt:''}]}};
}
export function decide(s:Workforce,id:string,status:'Approved'|'Rejected',note:string,reviewer:string):Workforce{
 const a=attendance(s),r=a.requests.find(x=>x.id===id);
 if(!r||r.status!=='Pending'||!note.trim()||!reviewer.trim())throw Error('Pending request, reviewer and decision reason required.');
 let sessions=s.sessions;const old=sessions.find(x=>x.id===r.session);
 if(status==='Approved'&&r.kind==='Correction'){
 if(onLeave(s,r.employee,r.date)||sessions.some(x=>x.id!==r.session&&x.employee===r.employee&&x.status!=='Rejected'&&Date.parse(x.start)<Date.parse(r.end)&&(!x.end||Date.parse(x.end)>Date.parse(r.start))))throw Error('Attendance or leave changed; resolve the conflict first.');
 if(r.session&&(!old||old.status==='Rejected'))throw Error('Original record is no longer eligible.');
 if(a.requests.some(x=>x.kind==='Overtime'&&x.session===r.session&&x.status!=='Rejected'))throw Error('Resolve linked overtime requests before correcting this session.');
 const corrected={id:old?.id??crypto.randomUUID(),employee:r.employee,date:r.date,start:r.start,end:r.end,place:old?.place??'Unspecified',status:'Approved' as const,location:old?.location,evidence:'Manual correction — not verified'};
 sessions=old?sessions.map(x=>x.id===old.id?corrected:x):[...sessions,corrected];
 }
 if(status==='Approved'&&r.kind==='Overtime'&&(!old||old.status!=='Approved'||Date.parse(r.start)<Date.parse(old.start)||Date.parse(r.end)>Date.parse(old.end)))throw Error('Attendance changed; review the linked record.');
 return {...s,sessions,attendance:{...a,requests:a.requests.map(x=>x.id===id?{...x,status,reviewNote:note.trim(),reviewer,reviewedAt:new Date().toISOString(),previous:old?{start:old.start,end:old.end,status:old.status}:undefined}:x)}};
}
export const approvedOvertime=(s:Workforce,employee:string,from:string,to:string)=>attendance(s).requests.filter(x=>x.employee===employee&&x.kind==='Overtime'&&x.status==='Approved'&&x.date>=from&&x.date<=to&&s.sessions.some(y=>y.id===x.session&&y.status==='Approved')).reduce((n,x)=>n+duration(x),0);
