const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{transformSync}=require('esbuild');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(transformSync(fs.readFileSync(file,'utf8'),{loader:ext.slice(1),format:'cjs',jsx:'automatic'}).code,file);
const m=require('../src/organisation/model.ts'),{initialWorkspace,workspaceReducer,changeAction}=require('../src/administration/workspace.ts');

test('free arrangement saves exact coordinates and connectors without changing employment relationships',()=>{
 const before=initialWorkspace(),original=m.chartLayout(before.org,before.store.employees),next=m.moveChartPerson(before.org,before.store.employees,'employees-1',{x:433,y:722});
 const layout=m.chartLayout(next,before.store.employees);assert.equal(layout.nodes.find(n=>n.id==='employees-1').x,433);assert.equal(layout.nodes.find(n=>n.id==='employees-1').y,722);assert.deepEqual(next.assignments,before.org.assignments);
 assert.notEqual(layout.edges.find(e=>e.to==='employees-1').path,original.edges.find(e=>e.to==='employees-1').path);
 const saved=workspaceReducer(before,changeAction('org',next));assert.equal(saved.core.history.length,0);assert.equal(saved.audit.length,1);assert.equal(saved.audit[0].reference,'Chart arrangement');assert.deepEqual(saved.store.employees,before.store.employees);
});

test('moving a whole team preserves relative offsets, clamps the group to the canvas, and supports grid snapping',()=>{
 const state=initialWorkspace(),before=m.chartLayout(state.org,state.store.employees),root=before.nodes.find(n=>n.id==='employees-2');
 const moved=m.moveChartPerson(state.org,state.store.employees,root.id,{x:root.x+200,y:root.y+150},true),after=m.chartLayout(moved,state.store.employees);
 for(const node of before.nodes){const next=after.nodes.find(n=>n.id===node.id);assert.equal(next.x-node.x,200);assert.equal(next.y-node.y,150);}
 const clamped=m.chartLayout(m.moveChartPerson(state.org,state.store.employees,root.id,{x:-1000,y:-1000},true),state.store.employees);assert(clamped.nodes.every(n=>n.x>=16&&n.y>=16));
 const snapped=m.chartLayout(m.moveChartPerson(state.org,state.store.employees,'employees-1',{x:431,y:727},false,20),state.store.employees).nodes.find(n=>n.id==='employees-1');assert.equal(snapped.x,440);assert.equal(snapped.y,720);
});

test('manual positions survive filtered views, SVG export and undo without touching job definitions',()=>{
 const state=initialWorkspace(),before=m.chartUndoSnapshot(state.org),moved=m.moveChartPerson(state.org,state.store.employees,'employees-1',{x:843,y:911}),filtered=m.chartLayout(moved,state.store.employees,{query:'Alex'});
 assert.equal(filtered.nodes.find(n=>n.id==='employees-1').x,843);assert(m.chartSvg(filtered,'Demo').includes('x="843"'));
 const restored=m.restoreChartEdit({...moved,positions:[...moved.positions,{id:'extra',name:'Extra job',department:'d1'}]},before);assert.equal(restored.chartLayout,undefined);assert.equal(restored.positions.at(-1).id,'extra');assert.deepEqual(restored.assignments,state.org.assignments);
});

test('pointer conversion accounts for canvas scrolling and zoom, and drop hit testing excludes the dragged card',()=>{
 assert.deepEqual(m.pointerToChart({x:350,y:230},{left:100,top:80,scrollLeft:50,scrollTop:30},.5),{x:600,y:360});
 assert.throws(()=>m.pointerToChart({x:0,y:0},{left:0,top:0,scrollLeft:0,scrollTop:0},0));
 const state=initialWorkspace(),layout=m.chartLayout(state.org,state.store.employees),node=layout.nodes.find(n=>n.id==='employees-1');
 assert.equal(m.chartDropTarget(layout,{x:node.x+10,y:node.y+10}),'employees-1');assert.notEqual(m.chartDropTarget(layout,{x:node.x+10,y:node.y+10},'employees-1'),'employees-1');
 assert.equal(m.chartDropTarget(layout,{x:layout.company.x+10,y:layout.company.y+10}),'company');
});

test('dropping onto a manager reconnects reporting lines and places the branch clear of existing cards',()=>{
 const state=initialWorkspace(),base={...state.org,chartLayout:m.arrangementSnapshot(state.org,state.store.employees)};
 const next=m.placeUnderManager(base,state.store.employees,'employees-1','p1','employees-6'),layout=m.chartLayout(next,state.store.employees),source=layout.nodes.find(n=>n.id==='employees-1'),parent=layout.nodes.find(n=>n.id==='employees-6');
 assert.equal(next.assignments.find(a=>a.employee==='employees-1').manager,'employees-6');assert(source.y>=parent.y+m.CARD_HEIGHT);
 for(const other of layout.nodes.filter(n=>n.id!==source.id))assert(!(source.x<other.x+m.CARD_WIDTH&&source.x+m.CARD_WIDTH>other.x&&source.y<other.y+m.CARD_HEIGHT&&source.y+m.CARD_HEIGHT>other.y));
 assert.throws(()=>m.placeUnderManager(base,state.store.employees,'employees-2','p2','employees-1'));
});

// Exercise the real pointer handlers using a small hook host and browser API
// stubs. No drag algorithm is duplicated here; the handlers under test perform
// coordinate conversion, validation, preview, drop and cancellation themselves.
function dragHost({mode='Arrange cards',zoom=1,unassigned=false,unknownRole=false,width=4000}={}){
 const state=initialWorkspace();let org=unassigned?{...state.org,assignments:state.org.assignments.filter(a=>a.employee!=='employees-3')}:state.org;
 if(unknownRole)state.store.employees=state.store.employees.map(e=>e.id==='employees-3'?{...e,values:e.values.map((v,i)=>i===3?'Unconfigured specialist':v)}:e);
 const slots=[],cleanups=[];let index=0,rafId=0,api;
 const frames=new Map(),oldRaf=global.requestAnimationFrame,oldCancel=global.cancelAnimationFrame;
 global.requestAnimationFrame=callback=>{const id=++rafId;frames.set(id,callback);return id;};global.cancelAnimationFrame=id=>frames.delete(id);
 const hooks={useRef(value){const i=index++;if(!slots[i])slots[i]={current:value};return slots[i];},useState(value){const i=index++;if(!slots[i])slots[i]={value:typeof value==='function'?value():value};return [slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];},useEffect(callback){const i=index++;if(!slots[i]){slots[i]={ran:true};const cleanup=callback();if(cleanup)cleanups.push(cleanup);}}};
 const filename=path.resolve(__dirname,'../src/organisation/useChartDrag.ts'),mod=new Module(filename,module),baseRequire=Module.createRequire(filename);mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=name=>name==='react'?hooks:baseRequire(name);mod._compile(transformSync(fs.readFileSync(filename,'utf8'),{loader:'ts',format:'cjs'}).code,filename);
 const captures=new Set(),element={setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
 const canvas={scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:100,top:80,right:100+width,bottom:3080,width,height:3000})},saved=[],pending=[],messages=[],errors=[];
 function render(){index=0;api=mod.exports.useChartDrag({org,employees:state.store.employees,layout:m.chartLayout(org,state.store.employees),canvas:{current:canvas},zoom,mode,moveTeam:false,snap:false,onSave:(next,before)=>{saved.push({next,before});org=next;},onNeedPosition:value=>pending.push(value),onMessage:value=>messages.push(value),onError:value=>errors.push(value)});return api;}
 const event=(x,y)=>({button:0,pointerId:1,currentTarget:element,clientX:x,clientY:y,stopPropagation(){},preventDefault(){}});
 function client(point){return {x:100+point.x*zoom-canvas.scrollLeft,y:80+point.y*zoom-canvas.scrollTop};}
 function down(employee,source='card'){const node=m.chartLayout(org,state.store.employees).nodes.find(n=>n.id===employee),point=source==='card'?client({x:node.x+20,y:node.y+30}):{x:100+width+100,y:300};api.start(event(point.x,point.y),employee,source);return point;}
 function moveTo(point){const screen=client(point);api.move(event(screen.x,screen.y));render();return screen;}
 function up(point){const screen=client(point);api.finish(event(screen.x,screen.y));render();}
 render();return {get api(){return api;},get org(){return org;},employees:state.store.employees,canvas,saved,pending,messages,errors,captures,down,moveTo,up,render,event,frames,tick(){const [id,callback]=frames.entries().next().value??[];if(callback){frames.delete(id);callback(0);render();}},dispose(){for(const cleanup of cleanups)cleanup();global.requestAnimationFrame=oldRaf;global.cancelAnimationFrame=oldCancel;}};
}

for(const zoom of [.5,1,1.5])test(`pointer drag saves the released location at ${zoom*100}% zoom`,()=>{
 const host=dragHost({zoom});try{host.down('employees-1');host.moveTo({x:620,y:930});assert(host.api.visual);assert.equal(host.saved.length,0);host.up({x:620,y:930});const node=m.chartLayout(host.org,host.employees).nodes.find(n=>n.id==='employees-1');assert.equal(node.x,600);assert.equal(node.y,900);assert.equal(host.saved.length,1);assert.equal(host.api.preview,null);assert(host.api.consumeClick());assert.equal(host.captures.size,0);}finally{host.dispose();}
});

test('arranging a card over another employee never silently changes its reporting manager',()=>{
 const host=dragHost();try{const parent=host.org.assignments.find(a=>a.employee==='employees-1').manager,target=m.chartLayout(host.org,host.employees).nodes.find(n=>n.id==='employees-6');host.down('employees-1');host.moveTo({x:target.x+100,y:target.y+70});host.up({x:target.x+100,y:target.y+70});assert.equal(host.org.assignments.find(a=>a.employee==='employees-1').manager,parent);}finally{host.dispose();}
});

test('change-manager drag applies the highlighted target and rejects a descendant target',()=>{
 let host=dragHost({mode:'Change manager'});try{const target=m.chartLayout(host.org,host.employees).nodes.find(n=>n.id==='employees-6');host.down('employees-1');host.moveTo({x:target.x+100,y:target.y+70});assert.equal(host.api.visual.target,'employees-6');host.up({x:target.x+100,y:target.y+70});assert.equal(host.saved.length,1);assert.equal(host.org.assignments.find(a=>a.employee==='employees-1').manager,'employees-6');}finally{host.dispose();}
 host=dragHost({mode:'Change manager'});try{const child=m.chartLayout(host.org,host.employees).nodes.find(n=>n.id==='employees-1');host.down('employees-2');host.moveTo({x:child.x+100,y:child.y+70});assert(host.api.visual.invalid.includes('own team'));host.up({x:child.x+100,y:child.y+70});assert.equal(host.saved.length,0);assert(host.errors.at(-1).includes('own team'));}finally{host.dispose();}
});

test('palette drop places an employee directly when their job position is known',()=>{
 const host=dragHost({unassigned:true});try{host.down('employees-3','palette');host.moveTo({x:718,y:935});host.up({x:718,y:935});const assignment=host.org.assignments.find(a=>a.employee==='employees-3');assert.equal(assignment.position,'p3');assert.equal(assignment.manager,'');const node=m.chartLayout(host.org,host.employees).nodes.find(n=>n.id==='employees-3');assert.equal(node.x,600);assert.equal(node.y,900);assert.equal(host.pending.length,0);}finally{host.dispose();}
});

test('unknown positions request a one-time role choice instead of inventing employment details',()=>{
 const host=dragHost({unassigned:true,unknownRole:true});try{host.down('employees-3','palette');host.moveTo({x:718,y:935});host.up({x:718,y:935});assert.equal(host.saved.length,0);assert.equal(host.pending.length,1);assert.equal(host.pending[0].employee,'employees-3');assert.deepEqual(host.pending[0].point,{x:600,y:900});}finally{host.dispose();}
});

test('Escape, outside drops and small pointer jitter preserve the original chart',()=>{
 let host=dragHost();try{const before=host.org;host.down('employees-1');host.moveTo({x:620,y:930});host.api.cancel();host.render();assert.equal(host.org,before);assert.equal(host.saved.length,0);assert.equal(host.api.preview,null);assert.equal(host.frames.size,0);}finally{host.dispose();}
 host=dragHost();try{host.down('employees-1');host.moveTo({x:620,y:930});host.api.finish(host.event(9000,9000));host.render();assert.equal(host.saved.length,0);}finally{host.dispose();}
 host=dragHost();try{const start=host.down('employees-1');host.api.move(host.event(start.x+1,start.y+1));host.api.finish(host.event(start.x+1,start.y+1));host.render();assert.equal(host.saved.length,0);assert(!host.api.consumeClick());}finally{host.dispose();}
});

test('holding a drag near the edge pans the viewport without committing partial moves',()=>{
 const host=dragHost({width:1000});try{host.down('employees-1');host.api.move(host.event(1090,500));host.render();host.tick();assert(host.canvas.scrollLeft>0);assert.equal(host.saved.length,0);host.api.cancel();host.render();assert.equal(host.frames.size,0);}finally{host.dispose();}
});
