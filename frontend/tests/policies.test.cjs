const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),Module=require('node:module'),{transformSync}=require('esbuild');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(transformSync(fs.readFileSync(file,'utf8'),{loader:ext.slice(1),format:'cjs',jsx:'automatic'}).code,file);
const p=require('../src/operations/policies/model.ts'),{initialWorkspace,workspaceReducer,changeAction}=require('../src/administration/workspace.ts'),{today}=require('../src/operations/model.ts');
function draft(state,base){return {...p.newPolicy('employees-2',base),title:'Test policy',content:'Policy body sentinel. Staff must read the current version and contact HR with questions.',reference:'SPRINTO-TEST-001',changeSummary:base?'Revised responsibilities.':'Initial draft.'};}
function approved(workspace,base){const row=draft(workspace.operations,base);let ops=p.savePolicy(workspace.operations,row);ops=p.reviewPolicy(ops,row.id,'In review');ops=p.reviewPolicy(ops,row.id,'Approved','employees-2','Reviewed and approved for the demo.');return {ops,row:ops.policies.find(v=>v.id===row.id)};}

test('HR writes policy text with Sprinto references and valid external links',()=>{
 const workspace=initialWorkspace(),row=draft(workspace.operations);
 assert.throws(()=>p.savePolicy(workspace.operations,{...row,content:' '}));
 assert.throws(()=>p.savePolicy(workspace.operations,{...row,reference:''}));
 assert.throws(()=>p.savePolicy(workspace.operations,{...row,sourceUrl:'javascript:alert(1)'}));
 assert.throws(()=>p.savePolicy(workspace.operations,{...row,sourceUrl:'https://user:secret@example.invalid/policy'}));
 const ops=p.savePolicy(workspace.operations,{...row,sourceUrl:'https://example.invalid/sprinto/policy'});
 assert.equal(ops.policies.at(-1).source,'Sprinto');assert.equal(ops.policies.at(-1).status,'Draft');assert.equal(workspace.operations.policies.length,2);
});

test('approval requires a review and publication requires actual current recipients',()=>{
 const workspace=initialWorkspace(),row=draft(workspace.operations);let ops=p.savePolicy(workspace.operations,row);
 assert.throws(()=>p.reviewPolicy(ops,row.id,'Approved','employees-2','Notes'));
 assert.throws(()=>p.publishPolicy(ops,row.id,['employees-1'],today(7),workspace.store.employees));
 ops=p.reviewPolicy(ops,row.id,'In review');assert.throws(()=>p.reviewPolicy(ops,row.id,'Approved'));
 ops=p.reviewPolicy(ops,row.id,'Approved','employees-2','Approved');
 assert.throws(()=>p.publishPolicy(ops,row.id,[],today(7),workspace.store.employees));
 assert.throws(()=>p.publishPolicy(ops,row.id,['employees-8'],today(7),workspace.store.employees));
 assert.throws(()=>p.publishPolicy(ops,row.id,['employees-1'],today(-1),workspace.store.employees));
 const published=p.publishPolicy(ops,row.id,['employees-1','employees-1','employees-3'],today(7),workspace.store.employees);
 assert.equal(published.policies.find(v=>v.id===row.id).status,'Published');assert.equal(published.policyDeliveries.filter(d=>d.policyId===row.id).length,2);
 assert(published.policyDeliveries.filter(d=>d.policyId===row.id).every(d=>d.issuedAt&&!d.openedAt&&!d.acknowledgedAt));
 assert.throws(()=>p.savePolicy(published,{...row,content:'Edited after publication'}));
});

test('availability, opening and explicit acknowledgement are distinct per-recipient records',()=>{
 const workspace=initialWorkspace(),{ops,row}=approved(workspace);
 const issued=p.publishPolicy(ops,row.id,['employees-1','employees-3'],today(7),workspace.store.employees),delivery=issued.policyDeliveries.find(d=>d.policyId===row.id&&d.employee==='employees-1');
 assert.equal(p.receiptStatus(delivery),'Available');
 assert.throws(()=>p.acknowledgePolicy(issued,delivery.id,'employees-1',true));
 assert.throws(()=>p.openPolicy(issued,delivery.id,'employees-3'));
 const opened=p.openPolicy(issued,delivery.id,'employees-1');assert.equal(p.receiptStatus(opened.policyDeliveries.find(d=>d.id===delivery.id)),'Opened');
 assert.throws(()=>p.acknowledgePolicy(opened,delivery.id,'employees-1',false));
 const ack=p.acknowledgePolicy(opened,delivery.id,'employees-1',true);assert.equal(p.receiptStatus(ack.policyDeliveries.find(d=>d.id===delivery.id)),'Acknowledged');
 assert.equal(ack.policyDeliveries.find(d=>d.policyId===row.id&&d.employee==='employees-3').acknowledgedAt,'');
 assert.throws(()=>p.acknowledgePolicy(ack,delivery.id,'employees-1',true));
 assert.equal(p.openPolicy(ack,delivery.id,'employees-1'),ack);
});

test('reassigning a published version retains prior acknowledgements and adds only new recipients',()=>{
 const workspace=initialWorkspace(),{ops,row}=approved(workspace);let next=p.publishPolicy(ops,row.id,['employees-1'],today(7),workspace.store.employees);
 const delivery=next.policyDeliveries.find(d=>d.policyId===row.id);next=p.openPolicy(next,delivery.id,'employees-1');next=p.acknowledgePolicy(next,delivery.id,'employees-1',true);
 const timestamp=next.policyDeliveries.find(d=>d.id===delivery.id).acknowledgedAt;
 next=p.publishPolicy(next,row.id,['employees-1','employees-3'],today(14),workspace.store.employees);
 assert.equal(next.policyDeliveries.filter(d=>d.policyId===row.id).length,2);assert.equal(next.policyDeliveries.find(d=>d.id===delivery.id).acknowledgedAt,timestamp);
 assert.throws(()=>p.publishPolicy(next,row.id,['employees-1'],today(7),workspace.store.employees));
});

test('new versions require fresh acknowledgement and supersede older outstanding requests only for their recipients',()=>{
 const workspace=initialWorkspace(),{ops,row}=approved(workspace);let next=p.publishPolicy(ops,row.id,['employees-1','employees-3','employees-4'],today(7),workspace.store.employees);
 const one=next.policyDeliveries.find(d=>d.policyId===row.id&&d.employee==='employees-1');next=p.openPolicy(next,one.id,'employees-1');next=p.acknowledgePolicy(next,one.id,'employees-1',true);
 const oldContent=next.policies.find(v=>v.id===row.id).content;
 const version={...p.newPolicy(row.owner,row),content:'Updated policy body for a new acknowledgement.',changeSummary:'Updated requirements.'};
 next=p.savePolicy(next,version);next=p.reviewPolicy(next,version.id,'In review');next=p.reviewPolicy(next,version.id,'Approved','employees-2','Reviewed');next=p.publishPolicy(next,version.id,['employees-1','employees-3'],today(7),workspace.store.employees);
 assert.equal(next.policies.find(v=>v.id===row.id).content,oldContent);
 assert(next.policyDeliveries.find(d=>d.id===one.id).acknowledgedAt);
 assert.equal(next.policyDeliveries.find(d=>d.policyId===row.id&&d.employee==='employees-3').state,'Superseded');
 assert.equal(next.policyDeliveries.find(d=>d.policyId===row.id&&d.employee==='employees-4').state,'Required');
 assert(next.policyDeliveries.filter(d=>d.policyId===version.id).every(d=>!d.acknowledgedAt));
 assert.throws(()=>p.publishPolicy(next,row.id,['employees-2'],today(7),workspace.store.employees));
 const superseded=next.policyDeliveries.find(d=>d.policyId===row.id&&d.employee==='employees-3');assert.throws(()=>p.acknowledgePolicy(next,superseded.id,'employees-3',true));
});

test('in-app reminders do not imply receipt or acknowledgement, and archive retains prior acknowledgements',()=>{
 const workspace=initialWorkspace();let ops=workspace.operations;const delivery=ops.policyDeliveries[0];
 ops=p.remindPolicy(ops,delivery.id);assert.equal(ops.policyDeliveries[0].reminderCount,1);assert.equal(ops.policyDeliveries[0].openedAt,'');assert.equal(ops.policyDeliveries[0].acknowledgedAt,'');
 const withdrawn=p.archivePolicy(ops,delivery.policyId);assert.equal(withdrawn.policyDeliveries[0].state,'Withdrawn');assert.throws(()=>p.remindPolicy(withdrawn,delivery.id));
 ops=p.openPolicy(ops,delivery.id,delivery.employee);ops=p.acknowledgePolicy(ops,delivery.id,delivery.employee,true);const archived=p.archivePolicy(ops,delivery.policyId);assert(archived.policyDeliveries[0].acknowledgedAt);assert.equal(p.employeePolicies(archived,delivery.employee).length,1);
});

test('overdue assignments remain acknowledgeable and draft policies never appear in employee inboxes',()=>{
 const workspace=initialWorkspace(),delivery=workspace.operations.policyDeliveries[0];let ops={...workspace.operations,policyDeliveries:[{...delivery,due:today(-1)}]};
 assert.equal(p.receiptStatus(ops.policyDeliveries[0]),'Overdue');ops=p.openPolicy(ops,delivery.id,delivery.employee);ops=p.acknowledgePolicy(ops,delivery.id,delivery.employee,true);assert.equal(p.receiptStatus(ops.policyDeliveries[0]),'Acknowledged');
 assert(p.employeePolicies(ops,'employees-1').every(row=>row.policy.status!=='Draft'));assert.equal(p.employeePolicies(ops,'employees-3').length,0);
});

test('policy lifecycle and acknowledgements enter the real session trail without copying body text',()=>{
 const state=initialWorkspace(),{ops,row}=approved(state),published=p.publishPolicy(ops,row.id,['employees-3'],today(7),state.store.employees);
 let next=workspaceReducer(state,changeAction('operations',published));assert(next.audit.some(e=>e.action==='Distributed'));assert(!JSON.stringify(next.audit).includes('Policy body sentinel'));
 const delivery=next.operations.policyDeliveries.find(d=>d.policyId===row.id);next=workspaceReducer(next,changeAction('operations',p.openPolicy(next.operations,delivery.id,'employees-3'),'Employee preview · EMP003'));assert.equal(next.audit.at(-1).action,'Opened');
 next=workspaceReducer(next,changeAction('operations',p.acknowledgePolicy(next.operations,delivery.id,'employees-3',true),'Employee preview · EMP003'));assert.equal(next.audit.at(-1).action,'Acknowledged');assert.equal(next.audit.at(-1).actor,'Employee preview · EMP003');
});

test('HR policy workspace and employee self-service expose separate authoring and acknowledgement flows',()=>{
 const {createElement}=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom');
 const {Compliance}=require('../src/operations/Compliance.tsx'),{SelfService}=require('../src/administration/SelfService.tsx');
 const state=initialWorkspace(),render=(C,props,url)=>renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:[url]},createElement(C,props)));
 const hr=render(Compliance,{state:state.operations,update:()=>{},employees:state.store.employees},'/compliance?tab=Policies');
 assert(hr.includes('Write policy'));assert(hr.includes('Sprinto'));assert(hr.includes('Acknowledgements'));assert(hr.includes('not connected'));
 let writes=0;const employee=render(SelfService,{employees:state.store.employees,operations:state.operations,workforce:state.workforce,admin:state.admin,core:state.core,updateAdmin:()=>{},updateWorkforce:()=>{},updateOperations:()=>writes++},'/self-service?employee=employees-1&section=Policies');
 assert(employee.includes('Read &amp; acknowledge'));assert(employee.includes('Employee handbook'));assert(!employee.includes('Equipment use policy'));assert.equal(writes,0);
 const other=render(SelfService,{employees:state.store.employees,operations:state.operations,workforce:state.workforce,admin:state.admin,updateOperations:()=>{}},'/self-service?employee=employees-3&section=Policies');assert(other.includes('No policies are currently waiting'));
});


test('an ineligible recipient link never silently switches to another employee inbox',()=>{
 const {createElement}=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom'),{SelfService}=require('../src/administration/SelfService.tsx');
 const state=initialWorkspace();
 const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/self-service?employee=employees-8&section=Policies']},createElement(SelfService,{employees:state.store.employees,operations:state.operations,workforce:state.workforce,admin:state.admin,updateOperations:()=>{}})));
 assert(html.includes('This employee is not available in self-service'));
 assert(!html.includes('Employee handbook'));
});
