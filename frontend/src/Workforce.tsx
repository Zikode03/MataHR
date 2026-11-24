import { LeaveWorkspace } from './hrworkforce/LeaveWorkspace';
import { PayrollWorkspace } from './hrworkforce/PayrollWorkspace';
import { initialHRConfig, type HRConfig } from './hrworkforce/model';
import { RegisterWorkspace } from './attendance/RegisterWorkspace';
import { initialAttendance, approvedOvertime, type Attendance } from './attendance/model';
import { Status } from './Status';
import {useState,type FormEvent} from 'react';
import {Plug,Download,FileText,ShieldCheck} from 'lucide-react';
import {Link} from 'react-router-dom';
import type {RecordRow} from './data';
type Staff=RecordRow[];
type Connection={mode:'internal'|'external';provider:string;reference:string};
export type Leave={id:string;employee:string;type:string;start:string;end:string;reason:string;status:'Pending'|'Approved'|'Rejected';days?:number;stage?:string;approval?:string;manager?:string;paid?:boolean;evidence?:string;history?:{reviewer:string;note:string;decision:string;stage:string;at:string}[]};
type Session={id:string;employee:string;date:string;start:string;end:string;place:string;location?:string;evidence?:string;status:'Open'|'Pending review'|'Approved'|'Rejected'};
export type Pay={id:string;employee:string;period:string;basic:number;allowance:number;deduction:number;status:'Draft'|'Reviewed'|'Approved';benefitEmployer?:number;benefitEmployee?:number;hours?:number;overtime?:number;unpaid?:number;pending?:number};
export type Workforce={leave:Leave[];sessions:Session[];pay:Pay[];leaveConnection:Connection;payConnection:Connection;attendance?:Attendance;hrConfig?:HRConfig};
const local:Connection={mode:'internal',provider:'',reference:''};
export function initialWorkforce():Workforce {
 const today=day();
 const offset=(n:number)=>{const d=new Date();d.setDate(d.getDate()+n);return day(d)};
 return {leave:[
  {id:'leave-demo-1',employee:'employees-3',type:'Annual',start:offset(3),end:offset(5),reason:'Family trip',status:'Pending'},
  {id:'leave-demo-2',employee:'employees-4',type:'Annual',start:offset(7),end:offset(9),reason:'Personal time',status:'Pending'},
  {id:'leave-demo-3',employee:'employees-6',type:'Annual',start:today,end:today,reason:'Scheduled leave',status:'Approved'},
 ],sessions:[
  {id:'session-demo-1',employee:'employees-1',date:today,start:today+'T08:00:00+02:00',end:today+'T16:30:00+02:00',place:'Office',status:'Approved'},
  {id:'session-demo-2',employee:'employees-2',date:today,start:today+'T08:00:00+02:00',end:today+'T16:00:00+02:00',place:'Office',status:'Pending review'},
  {id:'session-demo-3',employee:'employees-7',date:today,start:today+'T08:30:00+02:00',end:today+'T16:30:00+02:00',place:'Remote',status:'Approved'},
 ],pay:[],leaveConnection:{...local},payConnection:{...local},attendance:initialAttendance(),hrConfig:initialHRConfig()};
}
type Props={state:Workforce;update:(s:Workforce)=>void;employees:Staff};
const uid=()=>crypto.randomUUID();
const day=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const name=(es:Staff,id:string)=>es.find(e=>e.id===id)?.values[1]??'Unknown employee';
const active=(es:Staff)=>es.filter(e=>e.status!=='Exited');
const hours=(s:Session)=>s.end?Math.max(0,(Date.parse(s.end)-Date.parse(s.start))/3600000):0;
const fmt=(v:number)=>v.toLocaleString('en-ZA',{style:'currency',currency:'ZAR'});
const time=(v:string)=>v?new Date(v).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}):'—';
function csv(filename:string,rows:(string|number)[][]){const safe=(v:string|number)=>{let s=String(v);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};const url=URL.createObjectURL(new Blob([rows.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function Header({title,description}:{title:string;description:string}){return <><div className="eyebrow">WORKFORCE MANAGEMENT</div><div className="page-head"><div><h1>{title}</h1><p>{description}</p></div></div><div className="life-demo">Demo workspace · Fictional data · Changes reset on reload.</div></>}
function Tabs({items,value,onChange}:{items:string[];value:string;onChange:(s:string)=>void}){return <div className="life-nav">{items.map(x=><button key={x} className={value===x?'active':''} aria-pressed={value===x} onClick={()=>onChange(x)}>{x}</button>)}</div>}
function EmployeeSelect({employees,value,onChange,id='wf-person'}:{employees:Staff;value:string;onChange:(v:string)=>void;id?:string}){return <><label htmlFor={id}>Employee (demo)</label><select id={id} required value={value} onChange={e=>onChange(e.target.value)}><option value="">Select employee</option>{active(employees).map(e=><option key={e.id} value={e.id}>{e.values[1]}</option>)}</select></>}
function ConnectionPanel({kind,value,save}:{kind:'leave'|'payroll';value:Connection;save:(c:Connection)=>void}){const [draft,setDraft]=useState(value),[message,setMessage]=useState('');return <section className="card"><div className="section-head"><h2><Plug size={19}/> Integration configuration</h2><span className="status">Not connected</span></div><p>Choose whether MataHR owns records or an external system is the source of truth. This saves a demo configuration only. No credentials are collected.</p><form onSubmit={e=>{e.preventDefault();save(draft);setMessage('Configuration saved for this demo. No connection established.')}}><div className="form-grid"><div><label htmlFor="connection-mode">Operating mode</label><select id="connection-mode" value={draft.mode} onChange={e=>{setDraft({...draft,mode:e.target.value as Connection['mode']});setMessage('')}}><option value="internal">Manage in MataHR</option><option value="external">External system manages records</option></select></div>{draft.mode==='external'&&<><div><label htmlFor="connection-provider">Provider</label><select id="connection-provider" required value={draft.provider} onChange={e=>setDraft({...draft,provider:e.target.value})}><option value="">Select provider</option>{(kind==='leave'?['Matateni eLeave','Sage','Custom API / file exchange']:['Sage Payroll','PaySpace / Deel Local Payroll','Custom API / file exchange']).map(p=><option key={p}>{p}</option>)}</select></div><div><label htmlFor="connection-ref">Organisation reference (non-secret)</label><input id="connection-ref" value={draft.reference} onChange={e=>setDraft({...draft,reference:e.target.value})}/></div></>}</div><button className="primary">Save configuration</button><p role="status">{message}</p></form><div className="wf-info"><ShieldCheck size={21}/><div><strong>Integration contract</strong><p>{kind==='leave'?'Employee identifiers, approved leave, dates, leave types and balances. External mode disables local submissions and approval changes.':'Employee identifiers, approved attendance totals, approved leave dates and payroll inputs. External mode disables local payroll editing. Results and payslips will be retrieved from the provider once connected.'} Backend authentication, mappings, validation, sync history and conflict handling are still required.</p></div></div></section>}
export function DigitalRegister(props:Props & {managers?:Record<string,string>}){return <RegisterWorkspace {...props}/>}
export function LeaveManagement(props:Props & {managers?:Record<string,string>}){return <LeaveWorkspace {...props}/>}
export function Payroll(props:Props){return <PayrollWorkspace {...props}/>}
