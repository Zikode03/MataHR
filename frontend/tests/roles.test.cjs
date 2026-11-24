const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),{transformSync}=require('esbuild');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(transformSync(fs.readFileSync(file,'utf8'),{loader:ext.slice(1),format:'cjs',jsx:'automatic'}).code,file);
const a=require('../src/auth/access.ts'),{initialWorkspace,workspaceReducer,changeAction}=require('../src/administration/workspace.ts');
test('role route boundaries keep system administration separate from personnel and payroll',()=>{
 for(const role of a.roles)assert(a.canVisit(role,'/self-service'));
 for(const path of ['/employees','/payroll','/register','/leave','/analytics','/assistant'])assert(!a.canVisit('admin',path),path);
 for(const role of ['employee','manager'])for(const path of ['/users','/permissions','/payroll','/settings','/employees','/audit'])assert(!a.canVisit(role,path),role+path);
 assert(a.canVisit('hr','/payroll'));assert(a.canVisit('hr','/employees'));assert(!a.canVisit('hr','/users'));assert(!a.canVisit('hr','/audit'));assert(a.canVisit('manager','/team/leave'));assert(!a.canVisit('employee','/team/leave'));
});
test('assigned accounts determine roles; unknown and inactive emails never receive a default role',()=>{
 const accounts=a.initialAccounts();assert.equal(a.accountForEmail(accounts,' ADMIN@EXAMPLE.INVALID ').role,'admin');assert.equal(a.accountForEmail(accounts,'someone@example.invalid'),null);accounts[0].active=false;assert.equal(a.accountForEmail(accounts,'admin@example.invalid'),null);
});
test('user management preserves an active admin, validates identities and audits account changes',()=>{
 const state=initialWorkspace(),accounts=state.admin.accounts;assert.throws(()=>a.saveAccount(accounts,{...accounts[0],role:'hr'},accounts[0].id,state.store.employees),/own role/);assert.throws(()=>a.saveAccount(accounts,{...accounts[1],email:accounts[0].email},accounts[0].id,state.store.employees),/already assigned/);
 assert.throws(()=>a.saveAccount(accounts,{...accounts[1],employee:'employees-8'},accounts[0].id,state.store.employees),/current employee/);
 const next=a.saveAccount(accounts,{...accounts[3],active:false},accounts[0].id,state.store.employees),saved=workspaceReducer(state,changeAction('admin',{...state.admin,accounts:next}));assert(saved.audit.some(e=>e.module==='User Access'));assert.equal(a.accountForEmail(next,accounts[3].email),null);assert.equal(state.admin.accounts[3].active,true);
});
function managerState(){const state=initialWorkspace();state.org.assignments=state.org.assignments.map(r=>r.employee==='employees-4'?{...r,manager:'employees-6'}:r);state.workforce.leave=[{id:'team-leave',employee:'employees-4',type:'Unpaid',start:'2026-12-01',end:'2026-12-01',reason:'Sample',status:'Pending',stage:'Manager',approval:'Manager + HR'},{id:'outside',employee:'employees-1',type:'Unpaid',start:'2026-12-01',end:'2026-12-01',reason:'Sample',status:'Pending'}];return state;}
test('manager leave review stays within reporting scope and preserves HR-stage approval',()=>{
 const s=managerState();assert.deepEqual([...a.teamIds(s.org,'employees-6')],['employees-4']);assert.throws(()=>a.managerDecision(s.workforce,s.org,'employees-6','leave','outside','Approved','Reviewed','Manager'),/team/);
 const next=a.managerDecision(s.workforce,s.org,'employees-6','leave','team-leave','Approved','Reviewed','Manager');assert.equal(next.leave[0].stage,'HR');assert.equal(next.leave[0].status,'Pending');assert.throws(()=>a.managerDecision(next,s.org,'employees-6','leave','team-leave','Approved','Again','Manager'),/manager-stage/);assert.equal(next.leave[1].status,'Pending');
});
test('manager attendance and overtime cannot approve own or other teams records',()=>{
 const s=managerState();s.workforce.sessions=[{id:'team',employee:'employees-4',date:'2026-11-24',start:'2026-11-24T06:00:00Z',end:'2026-11-24T15:00:00Z',status:'Pending review',place:'Office'},{id:'own',employee:'employees-6',date:'2026-11-24',start:'2026-11-24T06:00:00Z',end:'2026-11-24T15:00:00Z',status:'Pending review',place:'Office'}];
 assert.throws(()=>a.managerDecision(s.workforce,s.org,'employees-6','attendance','own','Approved','Reviewed','Manager'),/own team/);assert.throws(()=>a.managerDecision(s.workforce,s.org,'employees-6','attendance','team','Approved','','Manager'),/reason/);
 const next=a.managerDecision(s.workforce,s.org,'employees-6','attendance','team','Approved','Hours checked','Manager');assert.equal(next.sessions[0].status,'Approved');assert.equal(next.sessions[0].reviewNote,'Hours checked');assert.equal(next.sessions[1].status,'Pending review');
 s.workforce.attendance.requests=[{id:'ot-own',employee:'employees-6',session:'own',date:'2026-11-24',kind:'Overtime',start:'2026-11-24T15:00:00Z',end:'2026-11-24T16:00:00Z',reason:'Sample',status:'Pending',reviewNote:'',reviewer:'',reviewedAt:''}];assert.throws(()=>a.managerDecision(s.workforce,s.org,'employees-6','overtime','ot-own','Rejected','No','Manager'),/team/);
});
test('role workspaces render only permitted navigation and locked personal identity',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom'),{RoleWorkspace}=require('../src/auth/RoleWorkspace.tsx'),state=managerState();
 const render=(account,path)=>renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[path]},React.createElement(RoleWorkspace,{account,workspace:{state,setAdmin(){},setWorkforce(){},setOperations(){},logExport(){}},onSignOut(){}})));
 const admin=a.initialAccounts()[0],employee=a.initialAccounts()[3],manager={...a.initialAccounts()[2],employee:'employees-6'};
 const adminPage=render(admin,'/admin');assert(adminPage.includes('Users &amp; access'));assert(!adminPage.includes('href="/payroll"'));assert(!adminPage.includes('href="/employees"'));assert(render(admin,'/payroll').includes('outside your role'));
 const team=render(manager,'/team');assert(team.includes('Lerato Mokoena'));assert(!team.includes('Alex Morgan'));assert(!team.includes('DEMO-EMP001'));
 const own=render(employee,'/self-service?employee=employees-2');assert(own.includes('Alex Morgan'));assert(!own.includes('Preview as employee'));assert(!own.includes('<h3>Thandi Dlamini</h3>'));assert(render(employee,'/users').includes('outside your role'));
});
