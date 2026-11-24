import type {Workforce} from '../Workforce';
import {duration,clockTime,scheduleFor,scheduled,approvedOvertime} from '../attendance/model';
import {config} from '../hrworkforce/model';
export const shiftDay=(date:string,days:number)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
export function employeeDashboardData(state:Workforce,employee:string,date:string,started=''){
 const month=date.slice(0,7)+'-01',day=new Date(date+'T12:00:00Z').getUTCDay(),week=shiftDay(date,-((day+6)%7)),schedule=scheduleFor(state,employee),sessions=state.sessions.filter(s=>s.employee===employee&&s.status!=='Rejected'),today=sessions.filter(s=>s.date===date).sort((a,b)=>a.start.localeCompare(b.start));
 const hours=(from:string)=>sessions.filter(s=>s.date>=from&&s.date<=date&&s.status==='Approved').reduce((n,s)=>n+duration(s),0);
 const target=(from:string)=>{if(!schedule)return null;const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3)),length=(minutes(schedule.end)-minutes(schedule.start)+1440)%1440/60;let total=0;for(let d=from;d<=date;d=shiftDay(d,1))if(d>=started&&scheduled(state,employee,d)&&!config(state).holidays.some(h=>h.date===d))total+=length;return total;};
 const distribution=[{label:'On time',n:0,color:'#2b5060'},{label:'Late arrival',n:0,color:'#bf6864'},{label:'Remote work',n:0,color:'#d89c66'},{label:'Other recorded',n:0,color:'#a0acbd'}];
 const dates=[...new Set(sessions.filter(s=>s.date>=month&&s.date<=date).map(s=>s.date))];
 for(const d of dates){const rows=sessions.filter(s=>s.date===d).sort((a,b)=>a.start.localeCompare(b.start)),first=rows[0];const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3));if(rows.some(s=>s.place==='Remote'))distribution[2].n++;else if(schedule&&scheduled(state,employee,d)&&!config(state).holidays.some(h=>h.date===d)){distribution[minutes(clockTime(first.start))>minutes(schedule.start)+schedule.grace?1:0].n++;}else distribution[3].n++;}
 return {today,distribution,recordedDays:dates.length,dayHours:hours(date),weekHours:hours(week),monthHours:hours(month),dayTarget:target(date),weekTarget:target(week),monthTarget:target(month),overtime:approvedOvertime(state,employee,month,date),pending:state.leave.filter(l=>l.employee===employee&&l.status==='Pending').length,month,week};
}
