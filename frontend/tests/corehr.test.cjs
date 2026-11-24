const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),Module=require('node:module'),{transformSync}=require('esbuild');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(transformSync(fs.readFileSync(file,'utf8'),{loader:ext.slice(1),format:'cjs',jsx:'automatic'}).code,file);
const m=require('../src/corehr/model.ts'),{today}=require('../src/operations/model.ts');
const {initialWorkspace,workspaceReducer,changeAction}=require('../src/administration/workspace.ts');
function blankContract(employee='employees-3'){return {...m.newContract(employee),reference:'TEST-001',type:'Fixed term',start:today(1),end:today(100)};}
function doc(employee='employees-3',overrides={}){const file=new File(['fictional text'],'signed.pdf',{type:'application/pdf'});return {id:m.id(),employee,series:m.id(),version:1,title:'Test signed contract',category:'Signed contract',file,fileName:file.name,size:file.size,added:new Date().toISOString(),expires:'',visibility:'HR only',status:'Pending review',reviewer:'',reviewNote:'',...overrides};}
function change(state,employee='employees-1',overrides={}){const row=state.store.employees.find(e=>e.id===employee);return {id:m.id(),employee,kind:'Transfer',effective:today(),recorded:'',reason:'Team transfer reference',before:m.snapshot(row,state.org),after:{...m.snapshot(row,state.org),positionId:'p4',position:'Project Coordinator',department:'Operations',manager:'employees-2'},applied:false,...overrides};}

test('contract drafts validate dates and unique references without mutating prior state',()=>{
 const before=m.initialCoreHR(),contract=blankContract();
 assert.throws(()=>m.saveContract(before,{...contract,end:''}));
 assert.throws(()=>m.saveContract(before,{...contract,end:today(-1)}));
 const core=m.saveContract(before,contract);
 assert.equal(core.contracts.at(-1).stage,'Draft');assert.equal(before.contracts.length,2);
 assert.throws(()=>m.saveContract(core,{...blankContract(),reference:contract.reference}));
});

test('contract workflow requires review and signed evidence; recorded signatures are not automatic signing',()=>{
 const contract=blankContract(),document=doc();let core=m.addDocument(m.initialCoreHR(),document);core=m.saveContract(core,{...contract,documentId:document.id});
 assert.throws(()=>m.moveContract(core,contract.id,'Signed'));
 core=m.moveContract(core,contract.id,'In review');
 assert.throws(()=>m.moveContract(core,contract.id,'Approved'));
 core=m.moveContract(core,contract.id,'Approved',{reviewer:'employees-2',reviewNote:'Reviewed sample terms.'});
 assert.throws(()=>m.saveContract(core,{...contract,type:'Permanent'}));
 core=m.moveContract(core,contract.id,'Awaiting signature');
 assert.throws(()=>m.moveContract(core,contract.id,'Signed',{employeeSigned:today(),employerSigned:today()}));
 core=m.reviewDocument(core,document.id,'Verified','employees-2','Signed copy reviewed');
 core=m.moveContract(core,contract.id,'Signed',{documentId:document.id,employeeSigned:today(),employerSigned:today(),employerSigner:'Demo signatory',signatureReference:'DEMO-SIGN',reference:'OVERRIDE'});
 const signed=core.contracts.find(c=>c.id===contract.id);
 assert.equal(signed.stage,'Signed');assert.equal(signed.reference,'TEST-001');assert.equal(m.contractStatus(signed),'Scheduled');
 assert.equal(m.contractStatus({...signed,start:today(-1)}),'Active');
});

test('renewals keep prior versions and overlapping signed terms are rejected',()=>{
 let core=m.initialCoreHR(),base=core.contracts.find(c=>c.employee==='employees-4');
 const renewal={...m.newContract(base.employee,base),reference:'RENEW-004',end:today(200)};
 core=m.saveContract(core,renewal);assert.equal(core.contracts.find(c=>c.id===renewal.id).version,2);assert.equal(base.stage,'Signed');
 let overlap={...blankContract(base.employee),start:today(),reference:'OVERLAP-004'};const signedDoc=doc(base.employee);core=m.addDocument(core,signedDoc);overlap.documentId=signedDoc.id;core=m.saveContract(core,overlap);core=m.moveContract(core,overlap.id,'In review');core=m.moveContract(core,overlap.id,'Approved',{reviewer:'employees-2',reviewNote:'Notes'});core=m.moveContract(core,overlap.id,'Awaiting signature');core=m.reviewDocument(core,signedDoc.id,'Verified','employees-2','Reviewed');
 assert.throws(()=>m.moveContract(core,overlap.id,'Signed',{documentId:signedDoc.id,employeeSigned:today(),employerSigned:today(),employerSigner:'Demo signatory',signatureReference:'DEMO'}),/overlap/);
 const ended=m.terminateContract(core,base.id,today(),'Recorded evidence');assert.equal(m.contractStatus(ended.contracts.find(c=>c.id===base.id)),'Terminated');assert.equal(core.contracts.find(c=>c.id===base.id).terminationDate,'');
});

test('file controls reject empty, unsupported and oversized attachments',()=>{
 assert(m.fileError({name:'page.html',type:'text/html',size:50}));
 assert(m.fileError({name:'fake.png',type:'text/html',size:50}));
 assert(m.fileError({name:'empty.pdf',type:'application/pdf',size:0}));
 assert(m.fileError({name:'big.pdf',type:'application/pdf',size:11*1024*1024}));
 assert.equal(m.fileError({name:'valid.pdf',type:'application/pdf',size:100}),'');
});

test('document versions preserve files and latest unverified evidence reopens collection requirements',()=>{
 let core=m.initialCoreHR(),first=doc('employees-1');core=m.addDocument(core,first);
 const requirement=core.requirements.find(r=>r.employee==='employees-1');assert.equal(m.requirementMet(core,requirement),false);
 core=m.reviewDocument(core,first.id,'Verified','employees-2','Copy reviewed');assert.equal(m.requirementMet(core,requirement),true);
 const second=doc('employees-1',{series:first.series,title:'Replacement'});core=m.addDocument(core,second);
 assert.equal(core.documents.find(d=>d.id===second.id).version,2);assert.equal(m.latestDocuments(core,'employees-1').length,1);assert.equal(m.requirementMet(core,requirement),false);
 assert.equal(core.documents.find(d=>d.id===first.id).file,first.file);
 core=m.reviewDocument(core,second.id,'Verified','employees-2','Replacement reviewed');assert.equal(m.requirementMet(core,requirement),true);
 core={...core,documents:core.documents.map(d=>d.id===second.id?{...d,expires:today(-1)}:d)};assert.equal(m.requirementMet(core,requirement),false);
});

test('effective-dated transfers update employee and organisation records together and record one history event',()=>{
 const before=initialWorkspace(),event=change(before),next=m.planEmploymentChange(before,event);
 const result=workspaceReducer(before,{type:'change',id:'apply-1',at:new Date().toISOString(),actor:'Demo HR user',apply:()=>next});
 assert.equal(result.store.employees.find(e=>e.id===event.employee).values[2],'Operations');
 assert.equal(result.org.assignments.find(a=>a.employee===event.employee).position,'p4');
 assert.equal(result.core.history.filter(h=>h.employee===event.employee).length,1);
 assert(result.audit.some(e=>e.module==='Employment History'));assert(result.audit.some(e=>e.module==='Employees'));
 assert.equal(before.store.employees[0].values[2],'Technology');
});

test('future changes cannot apply early; cancellation preserves history and blocks application',()=>{
 const state=initialWorkspace(),event=change(state,'employees-1',{effective:today(10)}),planned=m.planEmploymentChange(state,event);
 assert.equal(planned.store.employees[0].values[2],'Technology');assert.equal(planned.core.history[0].applied,false);
 assert.throws(()=>m.applyEmploymentChange(planned,event.id));
 assert.throws(()=>m.planEmploymentChange(planned,change(state)));
 const due={...planned,core:{...planned.core,history:planned.core.history.map(h=>({...h,effective:today()}))}};
 assert.equal(m.applyEmploymentChange(due,event.id).core.history[0].applied,true);
 assert.throws(()=>m.applyEmploymentChange({...due,core:{...due.core,history:due.core.history.map(h=>({...h,cancelled:true}))}},event.id));
});

test('reporting cycles, nonexistent managers and inconsistent exits are rejected',()=>{
 const state=initialWorkspace(),employee=state.store.employees.find(e=>e.id==='employees-2');
 assert.throws(()=>m.saveEmployee(state,employee,'p2','employees-1'),/cycle/);
 assert.throws(()=>m.planEmploymentChange(state,change(state,'employees-1',{after:{...m.snapshot(state.store.employees[0],state.org),manager:'not-real'}})));
 assert.throws(()=>m.planEmploymentChange(state,change(state,'employees-1',{kind:'Exit'})));
 const event=change(state,'employees-1',{kind:'Exit',after:{...m.snapshot(state.store.employees[0],state.org),status:'Exited'}});
 assert.equal(m.planEmploymentChange(state,event).store.employees.find(e=>e.id==='employees-1').status,'Exited');
});

test('organisation position changes synchronise employee profiles and create effective employment history',()=>{
 const state=initialWorkspace();const action=changeAction('org',org=>({...org,assignments:org.assignments.map(a=>a.employee==='employees-1'?{...a,position:'p4'}:a)}));
 const next=workspaceReducer(state,action);assert.equal(next.store.employees[0].values[2],'Operations');assert.equal(next.store.employees[0].values[3],'Project Coordinator');assert.equal(next.core.history.length,1);assert.equal(next.core.history[0].before.department,'Technology');
});

test('probation outcomes validate extension dates and retain human review history',()=>{
 let core=m.initialCoreHR(),row=core.probations[0];
 assert.throws(()=>m.reviewProbation(core,row.id,'Extended','Review notes','employees-2',today(1),today(2)));
 core=m.reviewProbation(core,row.id,'Extended','Additional review period','employees-2',today(60),today(45));assert.equal(core.probations[0].reviews.length,1);assert.equal(core.probations[0].end,today(60));
 core=m.reviewProbation(core,row.id,'Confirmed','Review completed','employees-2');assert.equal(core.probations[0].status,'Confirmed');assert.equal(core.probations[0].reviews.length,2);
 assert(!m.coreReminders(core).some(r=>r.id===row.id));
});

test('core attachments and personal updates are audited without copying file names or emergency contact values',()=>{
 const before=initialWorkspace(),document=doc('employees-1',{fileName:'Private-file-sentinel.pdf'});
 const next=workspaceReducer(before,changeAction('core',core=>({...m.addDocument(core,document),personal:{'employees-1':{address:'Private-address-sentinel',emergencyName:'Private-person-sentinel',emergencyRelationship:'Family',emergencyPhone:'000'}}})));
 assert(next.audit.some(e=>e.module==='Personnel Documents'));assert(next.audit.some(e=>e.fields.includes('Personal information and emergency contact')));assert(!JSON.stringify(next.audit).includes('sentinel'));
});

test('profile tabs expose dedicated contracts, documents, probation, history and personal information views',()=>{
 const {createElement}=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom'),{Employees}=require('../src/Employees.tsx');
 const state=initialWorkspace();const props={rows:state.store.employees,org:state.org,core:state.core,admin:state.admin,save:()=>{},updateCore:()=>{},onPlan:()=>{},onApply:()=>{},savePersonal:()=>{}};
 for(const [tab,expected] of [['Contracts','Employee contracts'],['Documents','Document collection checklist'],['Probation','Probation &amp; confirmation'],['History','Employment history'],['Personal information','emergency contact'],['Employment','Current employment assignment']]){const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/employees?employee=employees-1&tab='+encodeURIComponent(tab)]},createElement(Employees,props)));assert(html.includes(expected),tab);assert(!html.includes('class="metrics'));}
});


test('employee document view excludes HR-only, other employees and prior versions',()=>{
 let core=m.initialCoreHR();const privateDoc=doc('employees-1'),publicDoc=doc('employees-1',{visibility:'Employee'}),otherDoc=doc('employees-2',{visibility:'Employee'});
 for(const record of [privateDoc,publicDoc,otherDoc])core=m.addDocument(core,record);
 assert.deepEqual(m.employeeDocuments(core,'employees-1').map(d=>d.id),[publicDoc.id]);
 const replacement=doc('employees-1',{series:publicDoc.series,visibility:'HR only'});core=m.addDocument(core,replacement);
 assert.equal(m.employeeDocuments(core,'employees-1').length,0);
});
