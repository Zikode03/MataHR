import {useState} from 'react';
import type {RecordRow} from '../data';
import type {CoreHR} from './model';
export type PanelProps={employee:RecordRow;employees:RecordRow[];core:CoreHR;update:(value:CoreHR)=>void};
export function ReviewerOptions({employees}:{employees:RecordRow[]}){return <><option value="">Choose reviewer</option>{employees.filter(e=>e.status!=='Exited').map(e=><option key={e.id} value={e.id}>{e.values[1]}</option>)}</>;}
export function useCoreActions(core:CoreHR,update:(value:CoreHR)=>void){const [error,setError]=useState(''),[message,setMessage]=useState('');function run(change:(core:CoreHR)=>CoreHR,success:string){try{const next=change(core);update(next);setError('');setMessage(success);return true;}catch(problem){setError(problem instanceof Error?problem.message:'Unable to save this record.');setMessage('');return false;}}return {run,error,message,setError,setMessage};}
export function Feedback({error,message}:{error:string;message:string}){return <>{error&&<p className="admin-error" role="alert">{error}</p>}{message&&<p className="admin-message" role="status">{message}</p>}</>;}
