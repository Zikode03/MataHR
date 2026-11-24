const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Module=require('node:module');
const {transformSync}=require('esbuild');
// Compile local TS/TSX in memory; no additional test-runner dependency.
for(const extension of ['.ts','.tsx']){
 Module._extensions[extension]=(module,filename)=>module._compile(transformSync(fs.readFileSync(filename,'utf8'),{loader:extension.slice(1),format:'cjs',jsx:'automatic'}).code,filename);
}
const model=require('../src/operations/model.ts');
const {initialRecords}=require('../src/data.ts');
const {createElement}=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

test('equipment custody follows allocation, damaged return and repair stock rules',()=>{
 const original=model.initialOperations().assets.find(a=>a.status==='Available');
 const allocated=model.allocateAsset(original,'employees-3',model.today(30),'Charger included');
 assert.equal(allocated.employee,'employees-3');
 assert.equal(allocated.status,'Allocated');
 assert.equal(allocated.history.at(-1).note,'Charger included');
 assert.equal(original.status,'Available');
 assert.throws(()=>model.allocateAsset(allocated,'employees-4',model.today(30),''));
 assert.throws(()=>model.allocateAsset(original,'',model.today(30),''));
 assert.throws(()=>model.allocateAsset(original,'employees-3',model.today(-1),''));
 const returned=model.returnAsset(allocated,'Needs repair','Screen damaged');
 assert.equal(returned.status,'Repair');
 assert.equal(returned.employee,'');
 assert.equal(returned.returnDate,'');
 assert.equal(returned.history.at(-1).employee,'employees-3');
 assert.throws(()=>model.allocateAsset(returned,'employees-4',model.today(30),''));
 const usable=model.returnAsset(allocated,'Good','All accessories returned');
 assert.equal(usable.status,'Available');
 assert.equal(usable.history.length,allocated.history.length+1);
 assert.throws(()=>model.returnAsset(original,'Good',''));
});

test('compliance completion requires evidence and every review task, and overdue is derived',()=>{
 const row=model.initialOperations().obligations[1];
 assert.equal(model.obligationStatus(row),'Overdue');
 assert.equal(model.canComplete(row),false);
 const checked={...row,checklist:row.checklist.map(t=>({...t,done:true}))};
 assert.equal(model.canComplete(checked),false);
 const evidenced={...checked,evidence:[{id:'e',title:'Minutes',reference:'REF-1',added:model.today()}]};
 assert.equal(model.canComplete(evidenced),true);
 assert.equal(model.obligationStatus({...evidenced,status:'Compliant'}),'Compliant');
 assert.equal(model.canComplete({...evidenced,checklist:[...evidenced.checklist,{id:'new',label:'New task',done:false}]}),false);
});

test('case resolution requires an outcome and preserves chronology',()=>{
 const row=model.initialOperations().cases[0];
 assert.throws(()=>model.resolveCase(row,'   '));
 const resolved=model.resolveCase(row,'  Follow-up plan agreed.  ');
 assert.equal(resolved.stage,'Resolved');
 assert.equal(resolved.resolution,'Follow-up plan agreed.');
 assert.equal(resolved.nextDate,'');
 assert.equal(resolved.nextAction,'');
 assert.equal(resolved.notes.length,row.notes.length+1);
 assert.equal(resolved.notes.at(-1).kind,'Resolution');
 assert.equal(row.stage,'In review');
 assert.throws(()=>model.resolveCase({...row,stage:'Closed'},'Another outcome'));
});

test('polls record one valid vote and reject repeat, expired and closed submissions',()=>{
 const poll=model.initialOperations().polls[0],option=poll.options[0].id;
 const voted=model.voteInPoll(poll,option);
 assert.equal(voted.vote,option);
 assert.equal(voted.options[0].votes,1);
 assert.equal(poll.options[0].votes,0);
 assert.throws(()=>model.voteInPoll(voted,option));
 assert.throws(()=>model.voteInPoll(poll,'invalid-option'));
 assert.throws(()=>model.voteInPoll({...poll,closed:true},option));
 assert.throws(()=>model.voteInPoll({...poll,closes:model.today(-1)},option));
});

test('new sessions do not share mutable operation records',()=>{
 const first=model.initialOperations(),second=model.initialOperations();
 first.obligations[0].checklist[0].done=false;
 first.assets[0].history.push({id:'new'});
 assert.equal(second.obligations[0].checklist[0].done,true);
 assert.equal(second.assets[0].history.length,1);
});

const screens=[
 ['Compliance','Compliance','Obligation register','Supporting evidence'],
 ['EmployeeRelations','EmployeeRelations','Case register','Case chronology'],
 ['AssetManagement','AssetManagement','Equipment inventory','Select an asset to manage custody'],
 ['EmployeeEngagement','EmployeeEngagement','People &amp; Culture','Mark as read'],
];
for(const [file,exportName,primary,secondary] of screens){
 test(`${exportName} renders its own task workflow without dashboard cards`,()=>{
  const Component=require(`../src/operations/${file}.tsx`)[exportName];
  const html=renderToStaticMarkup(createElement(require('react-router-dom').MemoryRouter,null,createElement(Component,{state:model.initialOperations(),update:()=>{},employees:initialRecords().employees})));
  assert(html.includes(primary),primary);
  assert(html.includes(secondary),secondary);
  assert(!html.includes('class="metrics'));
  assert(!html.includes('wf-hero'));
  assert(!html.includes('New record'));
 });
}
