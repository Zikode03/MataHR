import type {Workforce} from '../Workforce';
import type {RecordRow} from '../data';
export type Props={configurationAllowed?:boolean;state:Workforce;update:(s:Workforce,actor?:string)=>void;employees:RecordRow[];managers?:Record<string,string>;employeeOnly?:string};
export const personName=(people:RecordRow[],id:string)=>people.find(p=>p.id===id)?.values[1]??id;
export function PersonSelect({people,value,onChange}:{people:RecordRow[];value:string;onChange:(v:string)=>void}){return <label>Employee<select required value={value} onChange={e=>onChange(e.target.value)}><option value="">Select employee</option>{people.filter(p=>p.status!=='Exited').map(p=><option key={p.id} value={p.id}>{p.values[1]} · {p.values[0]}</option>)}</select></label>}
export function Tabs({items,value,onChange}:{items:string[];value:string;onChange:(s:string)=>void}){return <div className="life-nav" style={{flexWrap:'wrap'}}>{items.map(t=><button key={t} className={t===value?'active':''} aria-pressed={t===value} onClick={()=>onChange(t)}>{t}</button>)}</div>}
export function downloadCsv(filename:string,rows:(string|number)[][]){const q=(v:string|number)=>'"'+String(v).replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"';const url=URL.createObjectURL(new Blob([rows.map(r=>r.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function downloadFile(file:File){const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export const money=(n:number)=>n.toLocaleString('en-ZA',{style:'currency',currency:'ZAR'});
