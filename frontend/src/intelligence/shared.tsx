import {useSearchParams} from 'react-router-dom';
import {type IntelligenceData,type ReportScope,defaultScope} from './model';
import {today} from '../operations/model';
export function useReportScope(){
 const [params,setParams]=useSearchParams();
 const defaults=defaultScope();
 const scope:ReportScope={start:params.get('start')??defaults.start,end:params.get('end')??defaults.end,department:params.get('department')??''};
 const change=(patch:Partial<ReportScope>)=>setParams({...scope,...patch},{replace:true});
 return {scope,change};
}
export function ScopeControls({scope,change,employees,snapshot=false}:{scope:ReportScope;change:(patch:Partial<ReportScope>)=>void;employees:IntelligenceData['employees'];snapshot?:boolean}){
 const preset=scope.end===today()&&scope.start===today(-6)?'7':scope.end===today()&&scope.start===today(-29)?'30':scope.end===today()&&scope.start===today(-89)?'90':scope.start===today()&&scope.end===today(29)?'next':'custom';
 return <div className="intel-filters"><label>Reporting period<select value={preset} disabled={snapshot} onChange={e=>{const value=e.target.value;if(value==='custom')return;if(value==='next')change({start:today(),end:today(29)});else change({start:today(1-Number(value)),end:today()})}}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="next">Next 30 days</option><option value="custom" disabled>Custom dates</option></select></label><label>From<input type="date" disabled={snapshot} value={scope.start} onChange={e=>change({start:e.target.value})}/></label><label>To<input type="date" disabled={snapshot} value={scope.end} onChange={e=>change({end:e.target.value})}/></label><label>Department<select value={scope.department} onChange={e=>change({department:e.target.value})}><option value="">All departments</option>{[...new Set(employees.map(e=>e.values[2]))].sort().map(d=><option key={d}>{d}</option>)}</select></label></div>;
}
export function scopeQuery(scope:ReportScope){return new URLSearchParams({...scope}).toString();}
