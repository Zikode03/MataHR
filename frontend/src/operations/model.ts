import { initialPolicies, initialPolicyDeliveries, type Policy, type PolicyDelivery } from './policies/model';
export type { Policy, PolicyDelivery } from './policies/model';
export type Evidence = {id:string; title:string; reference:string; added:string};
export type Obligation = {id:string; title:string; category:string; owner:string; due:string; description:string; status:'Open'|'In review'|'Compliant'; evidence:Evidence[]; checklist:{id:string; label:string; done:boolean}[]};
export type CaseNote = {id:string; at:string; kind:string; text:string};
export type EmployeeCase = {id:string; reference:string; employee:string; category:string; subject:string; summary:string; officer:string; priority:'Normal'|'High'; stage:'Open'|'In review'|'Resolved'|'Closed'; opened:string; nextDate:string; nextAction:string; resolution:string; notes:CaseNote[]};
export type AssetEvent = {id:string; at:string; action:string; employee:string; note:string};
export type Asset = {id:string; tag:string; name:string; category:string; serial:string; location:string; condition:string; status:'Available'|'Allocated'|'Repair'; employee:string; returnDate:string; history:AssetEvent[]};
export type Post = {id:string; title:string; body:string; audience:string; category:string; status:'Draft'|'Published'; date:string; acknowledged:boolean};
export type Poll = {id:string; question:string; audience:string; closes:string; options:{id:string; label:string; votes:number}[]; vote:string; closed:boolean};
export type Feedback = {id:string; topic:string; message:string; author:string; date:string; status:'New'|'In review'|'Addressed'; response:string};
export type Operations = {obligations:Obligation[]; policies:Policy[]; policyDeliveries:PolicyDelivery[]; cases:EmployeeCase[]; assets:Asset[]; posts:Post[]; polls:Poll[]; feedback:Feedback[]};
export const uid=()=>crypto.randomUUID();
export function today(offset=0){const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export const stamp=()=>new Date().toISOString();
export function obligationStatus(row:Obligation){return row.status!=='Compliant'&&row.due<today()?'Overdue':row.status;}
export function canComplete(row:Obligation){return row.evidence.length>0&&row.checklist.every(task=>task.done);}
export function allocateAsset(asset:Asset,employee:string,returnDate:string,note:string):Asset{
 if(asset.status!=='Available'||!employee||!returnDate||returnDate<today())throw new Error('Choose an available asset, an employee and a valid return date.');
 return {...asset,status:'Allocated',employee,returnDate,history:[...asset.history,{id:uid(),at:stamp(),action:'Allocated',employee,note}]};
}
export function returnAsset(asset:Asset,condition:string,note:string):Asset{
 if(asset.status!=='Allocated')throw new Error('Only allocated equipment can be returned.');
 return {...asset,status:condition==='Needs repair'?'Repair':'Available',condition,employee:'',returnDate:'',history:[...asset.history,{id:uid(),at:stamp(),action:'Returned',employee:asset.employee,note:note||condition}]};
}
export function resolveCase(row:EmployeeCase,resolution:string):EmployeeCase{
 if(!resolution.trim()||row.stage==='Closed')throw new Error('Record a resolution before resolving an open case.');
 return {...row,stage:'Resolved',resolution:resolution.trim(),nextAction:'',nextDate:'',notes:[...row.notes,{id:uid(),at:stamp(),kind:'Resolution',text:resolution.trim()}]};
}
export function voteInPoll(poll:Poll,option:string):Poll{
 if(poll.closed||poll.closes<today()||poll.vote||!poll.options.some(o=>o.id===option))throw new Error('This poll is not accepting this vote.');
 return {...poll,vote:option,options:poll.options.map(o=>o.id===option?{...o,votes:o.votes+1}:o)};
}
export function initialOperations():Operations{return {
 obligations:[
  {id:'ob-1',title:'Annual policy review',category:'Policy governance',owner:'employees-2',due:today(12),description:'Review the employee handbook, record changes and retain the approval reference.',status:'In review',evidence:[{id:'ev-1',title:'Handbook review notes',reference:'DEMO / HR / REVIEW-01',added:today(-3)}],checklist:[{id:'t1',label:'Review current handbook',done:true},{id:'t2',label:'Record management sign-off',done:false}]},
  {id:'ob-2',title:'Workplace safety briefing',category:'Workplace safety',owner:'employees-4',due:today(-2),description:'Confirm the briefing has taken place and record the attendance reference.',status:'Open',evidence:[],checklist:[{id:'t1',label:'Complete team briefing',done:false},{id:'t2',label:'Attach attendance reference',done:false}]},
  {id:'ob-3',title:'Access review for exited staff',category:'Internal controls',owner:'employees-1',due:today(5),description:'Review access removal against the offboarding checklist.',status:'Open',evidence:[],checklist:[{id:'t1',label:'Confirm account access removed',done:false}]},
 ],policies:initialPolicies(),policyDeliveries:initialPolicyDeliveries(),
 cases:[{id:'case-1',reference:'ER-001',employee:'employees-4',category:'Grievance',subject:'Working arrangement concern',summary:'Fictional case: employee requested a discussion about a change in working arrangements.',officer:'employees-2',priority:'Normal',stage:'In review',opened:today(-4),nextDate:today(2),nextAction:'Hold a follow-up discussion with the employee',resolution:'',notes:[{id:'n1',at:today(-4)+'T09:00:00+02:00',kind:'Case opened',text:'Concern logged for an initial HR review.'},{id:'n2',at:today(-2)+'T10:30:00+02:00',kind:'Meeting note',text:'Initial discussion completed. Follow-up meeting requested.'}]},{id:'case-2',reference:'ER-002',employee:'employees-3',category:'Workplace concern',subject:'Team communication concern',summary:'Fictional case: request for HR support with team communication.',officer:'employees-2',priority:'High',stage:'Open',opened:today(-1),nextDate:today(1),nextAction:'Arrange an initial conversation',resolution:'',notes:[]}],
 assets:[{id:'asset-1',tag:'MAT-L001',name:'Dell Latitude 5440',category:'Laptop',serial:'DEMO-DL-001',location:'Durban',condition:'Good',status:'Allocated',employee:'employees-1',returnDate:today(60),history:[{id:'ah1',at:today(-30)+'T09:00:00+02:00',action:'Allocated',employee:'employees-1',note:'Laptop and charger issued.'}]},{id:'asset-2',tag:'MAT-L002',name:'Lenovo ThinkPad E14',category:'Laptop',serial:'DEMO-LN-002',location:'Durban',condition:'Good',status:'Available',employee:'',returnDate:'',history:[]},{id:'asset-3',tag:'MAT-M003',name:'Dell 24-inch monitor',category:'Monitor',serial:'DEMO-MN-003',location:'Durban',condition:'Needs repair',status:'Repair',employee:'',returnDate:'',history:[{id:'ah3',at:today(-2)+'T14:00:00+02:00',action:'Sent for repair',employee:'',note:'Display fault reported.'}]},{id:'asset-4',tag:'MAT-P004',name:'Samsung Galaxy A35',category:'Phone',serial:'DEMO-PH-004',location:'Durban',condition:'Fair',status:'Allocated',employee:'employees-4',returnDate:today(-1),history:[]}],
 posts:[{id:'post-1',title:'Welcome to the team, Naledi',body:'Please join us in welcoming Naledi to the Technology team. We look forward to working together.',audience:'All staff',category:'People news',status:'Published',date:today(-1),acknowledged:false},{id:'post-2',title:'Team conversation: making handovers better',body:'Bring one practical idea to our next team conversation. We will discuss how to make project handovers clearer for everyone.',audience:'Operations',category:'Team update',status:'Published',date:today(-2),acknowledged:false},{id:'post-3',title:'December team gathering',body:'Draft announcement. Add the confirmed date, venue and RSVP details before publishing.',audience:'All staff',category:'Event',status:'Draft',date:today(),acknowledged:false}],
 polls:[{id:'poll-1',question:'What would make your workday better?',audience:'All staff',closes:today(7),options:[{id:'po1',label:'More focus time',votes:0},{id:'po2',label:'Clearer project handovers',votes:0},{id:'po3',label:'More learning opportunities',votes:0}],vote:'',closed:false}],
 feedback:[{id:'fb-1',topic:'Workplace improvement',message:'Could we create a shared quiet space for focused work?',author:'Demo participant',date:today(-2),status:'New',response:''},{id:'fb-2',topic:'Learning & development',message:'Short knowledge-sharing sessions would help teams learn from each other.',author:'Demo participant',date:today(-3),status:'In review',response:'HR is discussing a monthly session with team leads.'}],
};}
