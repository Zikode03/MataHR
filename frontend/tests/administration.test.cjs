const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),Module=require('node:module'),{transformSync}=require('esbuild');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(transformSync(fs.readFileSync(file,'utf8'),{loader:ext.slice(1),format:'cjs',jsx:'automatic'}).code,file);
const {initialAdministration,createRequest,withdrawRequest,responseTarget,leaveError,weekdayCount,settingsError,eligibleEmployees}=require('../src/administration/model.ts');
const {initialWorkspace,workspaceReducer,changeAction}=require('../src/administration/workspace.ts');
const {filterEvents,auditDate}=require('../src/administration/AuditLogs.tsx');
const {today}=require('../src/operations/model.ts');
const fixed={id:'transaction-1',at:'2026-11-24T23:30:00.000Z',actor:'Employee preview · EMP001'};

test('service requests use enabled catalogue types, unique references and weekday targets',()=>{
 const state=initialAdministration();
 const request=createRequest(state,'employees-1','employment-letter','  Proof of employment  ','Please prepare a letter.');
 assert.equal(request.reference,'HR-0002');assert.equal(request.subject,'Proof of employment');assert.equal(request.status,'Submitted');
 assert.equal(request.target,responseTarget(today(),3));assert.equal(responseTarget('2026-11-27',1),'2026-11-30');
 state.requests.push(request);assert.equal(createRequest(state,'employees-2','hr-enquiry','Question','Please review.').reference,'HR-0003');
 state.settings.services[0].enabled=false;assert.throws(()=>createRequest(state,'employees-1','employment-letter','Title','Text'));
 assert.throws(()=>createRequest(state,'employees-1','hr-enquiry','   ','Text'));
 assert.throws(()=>responseTarget(today(),0));
});

test('employees can withdraw their own submitted request only',()=>{
 const request=createRequest(initialAdministration(),'employees-1','hr-enquiry','Question','Please review.');
 assert.equal(withdrawRequest(request,'employees-1').status,'Withdrawn');
 assert.throws(()=>withdrawRequest(request,'employees-2'));
 assert.throws(()=>withdrawRequest({...request,status:'In review'},'employees-1'));
 assert.throws(()=>withdrawRequest({...request,status:'Completed'},'employees-1'));
 assert.equal(request.status,'Submitted');
});

test('self-service leave validates overlap, weekends and external mode',()=>{
 const workforce=initialWorkspace().workforce;
 const start='2026-11-23',end='2026-11-27';
 workforce.leave=[{id:'one',employee:'employees-1',start,end,status:'Pending',type:'Annual',reason:''}];
 assert(leaveError(workforce,'employees-1',start,end).includes('overlapping'));
 assert.equal(leaveError(workforce,'employees-2',start,end),'');
 assert(leaveError(workforce,'employees-2','2026-11-21','2026-11-22').includes('weekday'));
 assert(leaveError(workforce,'employees-2','2026-02-30',end).includes('valid'));
 assert.equal(weekdayCount('2026-11-20','2026-11-23'),2);
 workforce.leaveConnection.mode='external';assert(leaveError(workforce,'employees-2',start,end).includes('externally'));
});

test('workspace mutations and audit events are applied together without copying request text',()=>{
 const before=initialWorkspace();
 const request=createRequest(before.admin,'employees-1','hr-enquiry','Sensitive subject sentinel','Private request contents sentinel');
 const action=changeAction('admin',s=>({...s,requests:[...s.requests,request]}),'ignored',fixed);
 const after=workspaceReducer(before,action);
 assert.equal(after.admin.requests.length,before.admin.requests.length+1);assert.equal(after.audit.length,1);
 assert.equal(after.audit[0].reference,request.reference);assert.equal(after.audit[0].module,'Self-Service');
 assert.equal(after.audit[0].actor,fixed.actor);assert.equal(after.audit[0].sequence,1);
 assert(!JSON.stringify(after.audit).includes('sentinel'));assert.equal(before.audit.length,0);
 assert.deepEqual(workspaceReducer(before,action).audit,after.audit);
});

test('audit captures workforce status transitions, ignores no-ops and maintains ordered sequences',()=>{
 const before=initialWorkspace();
 assert.equal(workspaceReducer(before,changeAction('workforce',s=>({...s}),'Demo HR user',fixed)),before);
 const first=workspaceReducer(before,changeAction('workforce',s=>({...s,leave:s.leave.map((l,i)=>i===0?{...l,status:'Approved'}:l)}),'Demo HR user',fixed));
 assert.equal(first.audit.length,1);assert.equal(first.audit[0].transition,'Pending → Approved');assert.equal(first.audit[0].module,'Leave Management');
 const second=workspaceReducer(first,changeAction('admin',s=>({...s,settings:{...s.settings,density:'compact'}}),'Demo HR user',{...fixed,id:'transaction-2'}));
 assert.equal(second.audit.length,2);assert.equal(second.audit[1].sequence,2);assert(second.audit[1].fields.includes('Table density'));
 assert.equal(second.admin.settings.density,'compact');
});

test('audit captures case changes without case narratives and organisation assignments',()=>{
 const before=initialWorkspace();
 const cases=workspaceReducer(before,changeAction('operations',s=>({...s,cases:s.cases.map((c,i)=>i===0?{...c,summary:'Private case sentinel',stage:'Resolved'}:c)}),'Demo HR user',fixed));
 assert.equal(cases.audit[0].module,'Employee Relations');assert.equal(cases.audit[0].transition,'In review → Resolved');assert(!JSON.stringify(cases.audit).includes('Private case sentinel'));
 const org=workspaceReducer(cases,changeAction('org',s=>({...s,assignments:[...s.assignments,{employee:'employees-2',position:'p1',manager:'employees-1'}]}),'Demo HR user',{...fixed,id:'transaction-2'}));
 assert.equal(org.audit.at(-1).module,'Organisation');assert.equal(org.audit.at(-1).reference,'Reporting assignments');
});

test('audit filtering uses Johannesburg calendar dates, newest sequence and full filter scope',()=>{
 const before=initialWorkspace();
 const changed=workspaceReducer(before,changeAction('admin',s=>({...s,settings:{...s.settings,companyName:'Changed company'}}),'Demo HR user',fixed));
 assert.equal(auditDate(fixed.at),'2026-11-25');
 const filters={query:'organisation',module:'Settings',action:'Updated',from:'2026-11-25',to:'2026-11-25'};
 assert.equal(filterEvents(changed.audit,filters).length,1);
 assert.equal(filterEvents(changed.audit,{...filters,to:'2026-11-24'}).length,0);
 assert.equal(filterEvents(changed.audit,{...filters,module:'Assets'}).length,0);
});

test('settings validate configuration and keep new-session state independent',()=>{
 const settings=initialAdministration().settings;
 assert.equal(settingsError(settings),'');assert(settingsError({...settings,companyName:''}));assert(settingsError({...settings,hrEmail:'invalid'}));
 assert(settingsError({...settings,services:settings.services.map((s,i)=>i===0?{...s,targetDays:1.5}:s)}));
 const one=initialWorkspace(),two=initialWorkspace();one.org.departments[0].name='Changed';one.admin.settings.services[0].enabled=false;
 assert.notEqual(two.org.departments[0].name,'Changed');assert.equal(two.admin.settings.services[0].enabled,true);assert.equal(two.audit.length,0);
 assert(eligibleEmployees(two.store.employees).every(e=>e.status!=='Exited'));
});

test('audit export itself creates an event without altering earlier entries',()=>{
 const before=initialWorkspace();
 const next=workspaceReducer(before,{type:'log',...fixed,event:{module:'Audit Logs',action:'Exported',reference:'0 filtered session events',fields:[],transition:''}});
 assert.equal(next.audit.length,1);assert.equal(next.audit[0].action,'Exported');assert.equal(next.admin,before.admin);
});

test('administration screens render dedicated employee, activity and settings layouts',()=>{
 const {createElement}=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom');
 const {SelfService}=require('../src/administration/SelfService.tsx'),{Settings}=require('../src/administration/Settings.tsx'),{AuditLogs}=require('../src/administration/AuditLogs.tsx');
 const state=initialWorkspace();
 const render=(C,p)=>renderToStaticMarkup(createElement(MemoryRouter,null,createElement(C,p)));
 const employee=render(SelfService,{employees:state.store.employees,workforce:state.workforce,operations:state.operations,admin:state.admin,updateAdmin:()=>{},updateWorkforce:()=>{}});
 const settings=render(Settings,{admin:state.admin,update:()=>{},workforce:state.workforce});
 const audit=render(AuditLogs,{events:[],onExport:()=>{}});
 assert(employee.includes('Employee Dashboard'));assert(employee.includes('My equipment'));assert(employee.includes('My requests'));assert(employee.includes('Preview as employee'));
 assert(settings.includes('Self-service requests'));assert(settings.includes('Save changes'));assert(audit.includes('No session activity yet'));assert(audit.includes('not tamper-proof'));
 for(const html of [employee,settings,audit]){assert(!html.includes('class="metrics'));assert(!html.includes('wf-hero'));assert(!html.includes('New record'));}
});


test('employee changes identify the field without copying its personal value',()=>{
 const before=initialWorkspace();
 const after=workspaceReducer(before,changeAction('store',store=>({...store,employees:store.employees.map((e,i)=>i===0?{...e,values:e.values.map((v,j)=>j===1?'Private name sentinel':v)}:e)}),'Demo HR user',fixed));
 assert.deepEqual(after.audit[0].fields,['Name']);
 assert(!JSON.stringify(after.audit).includes('Private name sentinel'));
});
