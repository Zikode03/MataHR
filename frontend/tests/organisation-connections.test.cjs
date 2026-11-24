const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),Module=require('node:module'),{transformSync}=require('esbuild');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(transformSync(fs.readFileSync(file,'utf8'),{loader:ext.slice(1),format:'cjs',jsx:'automatic'}).code,file);
const m=require('../src/organisation/model.ts'),{initialWorkspace,workspaceReducer,changeAction}=require('../src/administration/workspace.ts');
test('drawing a reporting line preserves every card position and reconciles employment history',()=>{
 const state=initialWorkspace(),before=m.chartLayout(state.org,state.store.employees),next=m.connectChartPeople(state.org,state.store.employees,'employees-6','employees-1'),after=m.chartLayout(next,state.store.employees);
 assert.equal(next.assignments.find(a=>a.employee==='employees-1').manager,'employees-6');
 for(const n of before.nodes){const moved=after.nodes.find(a=>a.id===n.id);assert.equal(moved.x,n.x);assert.equal(moved.y,n.y);}
 const saved=workspaceReducer(state,changeAction('org',next));assert(saved.core.history.length>0);assert(saved.audit.some(a=>a.module==='Organisation'));
 assert.throws(()=>m.connectChartPeople(next,state.store.employees,'employees-1','employees-6'),/team|cycle/);
 assert.throws(()=>m.connectChartPeople(next,state.store.employees,'employees-1','employees-1'),/themselves/);
 const disconnected=m.connectChartPeople(next,state.store.employees,'company','employees-1');assert.equal(disconnected.assignments.find(a=>a.employee==='employees-1').manager,'');assert.equal(m.chartLayout(disconnected,state.store.employees).edges.find(e=>e.to==='employees-1').from,'company');
});
test('moving line bends saves and exports the route, preserves it across card moves and supports reset and undo',()=>{
 const state=initialWorkspace(),before=m.chartUndoSnapshot(state.org),next=m.routeChartLine(state.org,state.store.employees,'employees-1',{x:901,y:702}),layout=m.chartLayout(next,state.store.employees),edge=layout.edges.find(e=>e.to==='employees-1');
 assert.deepEqual(edge.bend,{x:901,y:702});assert(edge.path.includes('V 702 H 901'));assert(m.chartSvg(layout,'Company').includes(edge.path));assert.deepEqual(next.assignments,state.org.assignments);
 const moved=m.moveChartPerson(next,state.store.employees,'employees-1',{x:400,y:800});assert.deepEqual(m.chartLayout(moved,state.store.employees).edges.find(e=>e.to==='employees-1').bend,edge.bend);
 const saved=workspaceReducer(state,changeAction('org',next));assert.equal(saved.core.history.length,0);assert(saved.audit.some(a=>a.reference==='Chart arrangement'));
 const reset=m.routeChartLine(next,state.store.employees,'employees-1',null);assert.equal(reset.chartLayout.routes['employees-1'],undefined);assert.notEqual(m.chartLayout(reset,state.store.employees).edges.find(e=>e.to==='employees-1').path,edge.path);
 assert.deepEqual(m.restoreChartEdit(next,before).chartLayout,state.org.chartLayout);
 const snapshot=m.chartUndoSnapshot(next);snapshot.chartLayout.routes['employees-1'].point.x=1;assert.equal(next.chartLayout.routes['employees-1'].point.x,901);
 assert.throws(()=>m.routeChartLine(next,state.store.employees,'employees-1',{x:NaN,y:10}),/valid/);
});
test('routing belongs to the current manager and hidden employee lines stay hidden',()=>{
 const state=initialWorkspace(),routed=m.routeChartLine(state.org,state.store.employees,'employees-1',{x:901,y:702}),connected=m.connectChartPeople(routed,state.store.employees,'employees-6','employees-1');
 assert.notDeepEqual(m.chartLayout(connected,state.store.employees).edges.find(e=>e.to==='employees-1').bend,{x:901,y:702});
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{ChartConnections}=require('../src/organisation/ChartConnections.tsx'),layout=m.chartLayout(routed,state.store.employees,{query:'Alex'});
 const html=renderToStaticMarkup(React.createElement(ChartConnections,{org:routed,employees:state.store.employees,layout,canvas:{current:null},zoom:1,width:layout.width,height:layout.height,onSave(){},onMessage(){},onError(){}}));
 assert(html.includes('Draw reporting line from Alex'));assert(html.includes('Move line bend for Alex'));assert.equal((html.match(/class="org-line-hit"/g)||[]).length,layout.edges.length);
});
function connectionHost(zoom=1){
 const path=require('node:path'),filename=path.resolve(__dirname,'../src/organisation/ChartConnections.tsx'),mod=new Module(filename,module),baseRequire=Module.createRequire(filename),slots=[];let index=0,org=initialWorkspace().org,tree;const employees=initialWorkspace().store.employees,saved=[],errors=[];
 const hooks={useRef(value){const i=index++;return slots[i]??(slots[i]={current:value});},useState(value){const i=index++;slots[i]??={value};return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];}};
 mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=name=>name==='react'?hooks:baseRequire(name);mod._compile(transformSync(fs.readFileSync(filename,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,filename);
 const canvas={scrollLeft:20,scrollTop:40,getBoundingClientRect:()=>({left:100,top:50,right:5100,bottom:3050})},capture=new Set(),element={setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id)};
 function render(){index=0;const layout=m.chartLayout(org,employees);tree=mod.exports.ChartConnections({org,employees,layout,canvas:{current:canvas},zoom,width:layout.width,height:layout.height,onSave:next=>{saved.push(next);org=next;},onMessage(){},onError:value=>errors.push(value)});}
 function all(value=tree,result=[]){if(Array.isArray(value))for(const item of value)all(item,result);else if(value&&typeof value==='object'&&value.props){result.push(value);if(value.props.children!==undefined)all(value.props.children,result);}return result;}
 function find(label){const found=all().find(e=>e.props['aria-label']===label);assert(found,'Missing '+label);return found;}
 function event(p){return {button:0,pointerId:1,currentTarget:element,clientX:100+p.x*zoom-canvas.scrollLeft,clientY:50+p.y*zoom-canvas.scrollTop,stopPropagation(){},preventDefault(){}};}
 render();return {find,event,render,saved,errors,get org(){return org;},get tree(){return tree;},get layout(){return m.chartLayout(org,employees);}};
}
for(const zoom of [.5,1,1.5])test(`connection handles draw reporting lines at ${zoom*100}% zoom`,()=>{
 const host=connectionHost(zoom),port=host.find('Draw reporting line from '+host.layout.nodes.find(n=>n.id==='employees-6').name+' to a direct report'),target=host.layout.nodes.find(n=>n.id==='employees-1');
 port.props.onPointerDown(host.event({x:port.props.cx,y:port.props.cy}));host.render();const p={x:target.x+118,y:target.y};port.props.onPointerMove(host.event(p));host.render();port.props.onPointerUp(host.event(p));host.render();assert.equal(host.saved.length,1);assert.equal(host.org.assignments.find(a=>a.employee==='employees-1').manager,'employees-6');
});
test('line bend gestures preview without saving, then commit on release; Escape cancels',()=>{
 const host=connectionHost(),name=host.layout.nodes.find(n=>n.id==='employees-1').name,label='Move line bend for '+name;let bend=host.find(label),edge=host.layout.edges.find(e=>e.to==='employees-1');
 bend.props.onPointerDown(host.event(edge.bend));host.render();bend.props.onPointerMove(host.event({x:700,y:800}));host.render();assert.equal(host.saved.length,0);assert.equal(host.find(label).props.cx,700);
 bend.props.onPointerUp(host.event({x:700,y:800}));host.render();assert.deepEqual(host.org.chartLayout.routes['employees-1'].point,{x:700,y:800});
 bend=host.find(label);bend.props.onPointerDown(host.event({x:700,y:800}));bend.props.onPointerMove(host.event({x:900,y:1000}));host.render();host.find('Reporting line editor').props.onKeyDown({key:'Escape',stopPropagation(){}});host.render();bend.props.onPointerUp(host.event({x:900,y:1000}));assert.equal(host.saved.length,1);
});
test('click-to-connect supports keyboard users and invalid connections do not save',()=>{
 const host=connectionHost(),root=host.layout.nodes.find(n=>n.id==='employees-2'),child=host.layout.nodes.find(n=>n.id==='employees-1'),press={key:'Enter',preventDefault(){}};
 host.find('Draw reporting line from '+child.name+' to a direct report').props.onKeyDown(press);host.render();host.find('Connect '+root.name+' to selected manager').props.onKeyDown(press);host.render();assert.equal(host.saved.length,0);assert(host.errors.at(-1).includes('own team'));
 host.find('Draw reporting line from company to a direct report').props.onKeyDown(press);host.render();host.find('Connect '+child.name+' to selected manager').props.onKeyDown(press);host.render();assert.equal(host.saved.length,1);assert.equal(host.org.assignments.find(a=>a.employee===child.id).manager,'');
});
