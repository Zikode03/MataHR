import {type Dispatch,type SetStateAction,type ReactNode} from 'react';
import type {RecordRow} from '../data';
import type {Operations} from './model';
export type OpsProps={state:Operations;update:Dispatch<SetStateAction<Operations>>;employees:RecordRow[]};
export function employeeName(employees:RecordRow[],id:string){return employees.find(e=>e.id===id)?.values[1]??'Unassigned';}
export function EmployeeOptions({employees}:{employees:RecordRow[]}){return <><option value="">Choose employee</option>{employees.filter(e=>e.status!=='Exited').map(e=><option key={e.id} value={e.id}>{e.values[1]}</option>)}</>;}
export function PageHeading({title,description,action,children}:{title:string;description:string;action?:ReactNode;children?:ReactNode}){return <><div className="eyebrow">HR OPERATIONS</div><div className="page-head"><div><h1>{title}</h1><p>{description}</p></div>{action}</div><div className="life-demo">Demo workspace · Fictional records · Changes reset on reload.{children}</div></>;}
export function SectionTabs({items,value,onChange}:{items:string[];value:string;onChange:(value:string)=>void}){return <div className="life-nav" aria-label="Page sections">{items.map(item=><button key={item} className={value===item?'active':''} aria-pressed={value===item} onClick={()=>onChange(item)}>{item}</button>)}</div>;}
export function Empty({children}:{children:ReactNode}){return <div className="ops-empty">{children}</div>;}
export function Editor({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){return <section className="card ops-editor" aria-label={title}><div className="section-head"><h2>{title}</h2><button className="secondary" onClick={onClose}>Cancel</button></div>{children}</section>;}
export function DetailHeading({title,subtitle,onClose}:{title:string;subtitle:string;onClose:()=>void}){return <div className="ops-detail-heading"><div><small>{subtitle}</small><h2>{title}</h2></div><button className="ops-close" aria-label="Close details" onClick={onClose}>×</button></div>;}
export function DateLabel({value}:{value:string}){return <time dateTime={value}>{new Date(value.length===10?value+'T12:00:00':value).toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'})}</time>;}
