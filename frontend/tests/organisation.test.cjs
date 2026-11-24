const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),Module=require('node:module'),{transformSync}=require('esbuild');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(transformSync(fs.readFileSync(file,'utf8'),{loader:ext.slice(1),format:'cjs',jsx:'automatic'}).code,file);
const m=require('../src/organisation/model.ts');
const {initialWorkspace,workspaceReducer,changeAction}=require('../src/administration/workspace.ts');
function fixture(){
 const entries=[['ceo','Alex Director','Executive','Managing Director','exec'],['tech','Thandi Lead','Technology','Technology Lead','technology'],['dev1','James Developer','Technology','Developer','technology'],['dev2','Naledi Analyst','Technology','Analyst','technology'],['ops','Lerato Lead','Operations','Operations Lead','operations'],['staff','Sipho Coordinator','Operations','Coordinator','operations'],['new','Amelia New','Operations','Coordinator','operations']];
 const employees=entries.map(([id,name,department,title],i)=>({id,values:['EMP'+i,name,department,title,'Permanent','2025-01-01'],status:'Active'}));
 const org={branches:[{id:'b1',name:'Durban',address:'Demo office'}],departments:[{id:'exec',name:'Executive',branch:'b1'},{id:'technology',name:'Technology',branch:'b1'},{id:'operations',name:'Operations',branch:'b1'}],positions:entries.map(([id,,,title,department])=>({id:'p-'+id,name:title,department})),assignments:[{employee:'ceo',position:'p-ceo',manager:''},{employee:'tech',position:'p-tech',manager:'ceo'},{employee:'dev1',position:'p-dev1',manager:'tech'},{employee:'dev2',position:'p-dev2',manager:'tech'},{employee:'ops',position:'p-ops',manager:'ceo'},{employee:'staff',position:'p-staff',manager:'ops'}]};
 return {org,employees};
}

test('chart layout places manager cards above reports with no overlapping employee cards',()=>{
 const {org,employees}=fixture(),layout=m.chartLayout(org,employees);
 assert.equal(layout.nodes.length,6);assert.equal(layout.edges.length,6);assert.deepEqual(layout.roots,['ceo']);
 for(const node of layout.nodes){assert(node.x>=0);assert(node.x+m.CARD_WIDTH<=layout.width);assert(node.y+m.CARD_HEIGHT<=layout.height);const manager=layout.nodes.find(n=>n.id===node.manager);if(manager)assert(node.y>manager.y+m.CARD_HEIGHT);}
 for(const a of layout.nodes)for(const b of layout.nodes)if(a.id!==b.id){const overlap=a.x<b.x+m.CARD_WIDTH&&a.x+m.CARD_WIDTH>b.x&&a.y<b.y+m.CARD_HEIGHT&&a.y+m.CARD_HEIGHT>b.y;assert.equal(overlap,false,`${a.id} overlaps ${b.id}`);}
});

test('department search retains the actual management chain and marks context cards',()=>{
 const {org,employees}=fixture(),layout=m.chartLayout(org,employees,{department:'technology'});
 assert.deepEqual(layout.nodes.map(n=>n.id).sort(),['ceo','dev1','dev2','tech']);assert.equal(layout.nodes.find(n=>n.id==='ceo').context,true);assert.equal(layout.nodes.find(n=>n.id==='tech').manager,'ceo');assert.equal(layout.matching,3);
 const found=m.chartLayout(org,employees,{query:'James Developer'});assert.deepEqual(found.nodes.map(n=>n.id).sort(),['ceo','dev1','tech']);
 assert.equal(m.chartLayout(org,employees,{query:'not present'}).nodes.length,0);
});

test('collapsing a team hides its descendants while search still reveals relevant results',()=>{
 const {org,employees}=fixture();
 const collapsed=m.chartLayout(org,employees,{collapsed:new Set(['tech'])});assert(!collapsed.nodes.some(n=>n.id==='dev1'));assert(collapsed.nodes.some(n=>n.id==='staff'));assert.equal(collapsed.nodes.find(n=>n.id==='tech').reports,2);
 const search=m.chartLayout(org,employees,{collapsed:new Set(['tech']),query:'James'});assert(search.nodes.some(n=>n.id==='dev1'));
});

test('focusing on a team shows its descendants plus management context',()=>{
 const {org,employees}=fixture(),layout=m.chartLayout(org,employees,{focus:'tech'});
 assert.deepEqual(layout.nodes.map(n=>n.id).sort(),['ceo','dev1','dev2','tech']);assert.equal(layout.nodes.find(n=>n.id==='ceo').context,true);assert(!layout.nodes.find(n=>n.id==='ops'));
});

test('HR can place an employee, change a manager and move a whole team without changing descendant links',()=>{
 const {org,employees}=fixture();const placed=m.assignPerson(org,employees,'new','p-new','ops');assert.equal(placed.assignments.length,7);assert.equal(m.chartLayout(placed,employees).unassigned.length,0);assert.equal(org.assignments.length,6);
 const moved=m.assignPerson(placed,employees,'tech','p-tech','ops');assert.equal(moved.assignments.find(a=>a.employee==='dev1').manager,'tech');assert.equal(moved.assignments.find(a=>a.employee==='tech').manager,'ops');assert(m.chartLayout(moved,employees).nodes.find(n=>n.id==='tech').y>m.chartLayout(moved,employees).nodes.find(n=>n.id==='ops').y);
});

test('self reporting, descendant managers and unplaced managers are rejected',()=>{
 const {org,employees}=fixture();
 assert.throws(()=>m.assignPerson(org,employees,'tech','p-tech','tech'));
 assert.throws(()=>m.assignPerson(org,employees,'tech','p-tech','dev1'));
 assert.throws(()=>m.assignPerson(org,employees,'dev1','p-dev1','new'),/Place the reporting manager/);
 assert.throws(()=>m.assignPerson(org,employees,'dev1','missing','ceo'));
});

test('removing a manager retains employee records and explicitly reparents direct reports',()=>{
 const {org,employees}=fixture(),next=m.removePerson(org,employees,'tech','ops');
 assert(!next.assignments.some(a=>a.employee==='tech'));assert.equal(next.assignments.find(a=>a.employee==='dev1').manager,'ops');assert.equal(next.assignments.find(a=>a.employee==='dev2').manager,'ops');assert.equal(employees.length,7);assert(m.chartLayout(next,employees).unassigned.some(e=>e.id==='tech'));
 assert.throws(()=>m.removePerson(org,employees,'tech','dev1'));
});

test('top-level structures and unavailable managers remain inspectable without inventing reporting lines',()=>{
 const {org,employees}=fixture(),multiple={...org,assignments:org.assignments.map(a=>a.employee==='ops'?{...a,manager:''}:a)};
 assert.equal(m.chartLayout(multiple,employees).roots.length,2);
 const missing={...org,assignments:org.assignments.map(a=>a.employee==='tech'?{...a,manager:'not-current'}:a)},layout=m.chartLayout(missing,employees);
 assert(layout.issues.length);assert.equal(layout.nodes.find(n=>n.id==='tech').needsManager,true);assert.equal(layout.nodes.find(n=>n.id==='tech').manager,'');
});

test('invalid imported cycles do not hang or hide the organisation',()=>{
 const {org,employees}=fixture(),cyclic={...org,assignments:org.assignments.map(a=>a.employee==='ceo'?{...a,manager:'dev1'}:a)},layout=m.chartLayout(cyclic,employees);
 assert.equal(layout.nodes.length,6);assert(layout.issues.some(issue=>issue.includes('circular')));assert(layout.nodes.some(n=>n.needsManager));
 const fixed=m.assignPerson(cyclic,employees,'ceo','p-ceo','');assert.equal(m.chartLayout(fixed,employees).issues.length,0);
});

test('new positions belong to a real department and duplicate job titles are prevented',()=>{
 const {org}=fixture(),result=m.createChartPosition(org,'  HR Officer  ','operations');assert.equal(result.position.name,'HR Officer');assert.equal(result.org.positions.length,org.positions.length+1);
 assert.throws(()=>m.createChartPosition(result.org,'hr officer','operations'));assert.throws(()=>m.createChartPosition(org,'Role','missing'));
});

test('exited people are excluded and broken assignments appear in the placement queue',()=>{
 const {org,employees}=fixture();employees.find(e=>e.id==='staff').status='Exited';const invalid={...org,assignments:org.assignments.map(a=>a.employee==='dev1'?{...a,position:'missing'}:a)},layout=m.chartLayout(invalid,employees);
 assert(!layout.nodes.some(n=>n.id==='staff'));assert(!layout.unassigned.some(n=>n.id==='staff'));assert(layout.unassigned.some(n=>n.id==='dev1'));assert(layout.unassigned.some(n=>n.id==='new'));assert(layout.issues.length);
});

test('SVG exports use visible chart geometry and escape employee/company text',()=>{
 const {org,employees}=fixture();employees[0].values[1]='Name <script>alert(1)</script>';
 const layout=m.chartLayout(org,employees,{department:'technology'}),svg=m.chartSvg(layout,'Company <script>bad</script> & Partners');
 assert(svg.includes('&lt;script&gt;'));assert(!svg.includes('<script>'));assert(svg.includes('&amp; Partners'));assert(svg.includes('James Developer'));assert(!svg.includes('Sipho Coordinator'));assert(svg.includes(layout.edges[0].path));
});

test('chart saves reconcile employee profiles, employment history and audit records in one update',()=>{
 const state=initialWorkspace(),org=m.assignPerson(state.org,state.store.employees,'employees-1','p4','employees-6'),next=workspaceReducer(state,changeAction('org',org));
 assert.equal(next.store.employees.find(e=>e.id==='employees-1').values[2],'Operations');assert.equal(next.core.history.filter(h=>h.employee==='employees-1').length,1);assert.equal(next.core.history[0].after.manager,'employees-6');assert(next.audit.some(e=>e.module==='Organisation'));assert(next.audit.some(e=>e.module==='Employment History'));
});

test('organisation opens the visual builder with an HR guide and retains metadata editing tabs',()=>{
 const {createElement}=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom'),{Organisation}=require('../src/Organisation.tsx');const state=initialWorkspace();
 const render=path=>renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:[path]},createElement(Organisation,{org:state.org,setOrg:()=>{},employees:state.store.employees,companyName:'Matateni Technologies'})));
 const html=render('/organisation');assert(html.includes('org-chart-connections'));assert(html.includes('Add reporting line'));assert(html.includes('HR builds the structure'));assert(html.includes('Needs placement'));assert(html.includes('Matateni Technologies'));assert(!html.includes('class="metrics'));
 assert(render('/organisation?tab=positions').includes('Add position'));assert(render('/organisation?tab=departments').includes('Add department'));
});
