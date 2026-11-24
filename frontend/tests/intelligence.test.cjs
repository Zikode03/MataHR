const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),Module=require('node:module');
const {transformSync}=require('esbuild');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(transformSync(fs.readFileSync(file,'utf8'),{loader:ext.slice(1),format:'cjs',jsx:'automatic'}).code,file);
const {buildReport,dateRange,weekdays,answerQuestion,csvText,exportRows}=require('../src/intelligence/model.ts');
const {initialOperations,today}=require('../src/operations/model.ts');
const {initialWorkforce}=require('../src/Workforce.tsx');
const {initialRecords}=require('../src/data.ts');
function source(){return {employees:initialRecords().employees,workforce:initialWorkforce(),operations:initialOperations()};}
const scope={start:'2026-11-23',end:'2026-11-27',department:''};

test('date ranges reject invalid, reversed or excessively long periods',()=>{
 assert.equal(dateRange('2026-11-23','2026-11-27').length,5);
 assert.equal(dateRange('2026-11-27','2026-11-23').length,0);
 assert.equal(dateRange('2026-02-30','2026-03-02').length,0);
 assert.equal(dateRange('','2026-11-27').length,0);
 assert.equal(dateRange('2026-01-01','2026-12-31').length,0);
 assert.equal(dateRange('2024-02-29','2024-02-29').length,1);
});

test('attendance deduplicates people and days while approved hours use only valid closed sessions',()=>{
 const data=source();
 const session={id:'one',employee:'employees-1',date:'2026-11-24',start:'2026-11-24T08:00:00+02:00',end:'2026-11-24T10:00:00+02:00',place:'Office',status:'Approved'};
 data.workforce.sessions=[session,{...session,id:'two',start:'2026-11-24T11:00:00+02:00',end:'2026-11-24T12:00:00+02:00'}, {...session,id:'open',end:'',status:'Open'}, {...session,id:'review',employee:'employees-2',status:'Pending review'}, {...session,id:'rejected',employee:'employees-3',status:'Rejected'}, {...session,id:'outside',date:'2026-11-28'}, {...session,id:'bad',end:'2026-11-24T07:00:00+02:00'}];
 const report=buildReport(data,scope);
 assert.equal(report.recordedPeople,2);
 assert.equal(report.employeeDays,2);
 assert.equal(report.hours,3);
 assert.equal(report.pendingAttendance.length,1);
 assert.equal(report.daily.find(d=>d.date==='2026-11-24').people,2);
 assert.equal(report.sessions.length,6);
 assert.equal(report.daily.find(d=>d.date==='2026-11-23').people,0);
 const technology=buildReport(data,{...scope,department:'Technology'});
 assert.equal(technology.recordedPeople,1);
 assert.equal(technology.pendingAttendance.length,0);
});

test('approved leave is clipped to the period, weekdays only and deduplicated by employee/day',()=>{
 const data=source();
 const leave={id:'l1',employee:'employees-1',type:'Annual',start:'2026-11-20',end:'2026-11-25',status:'Approved',reason:''};
 data.workforce.leave=[leave,{...leave,id:'l2',start:'2026-11-24',end:'2026-11-27'}, {...leave,id:'pending',employee:'employees-2',status:'Pending'}, {...leave,id:'rejected',employee:'employees-3',status:'Rejected'}, {...leave,id:'outside',start:'2026-12-01',end:'2026-12-02'}];
 const report=buildReport(data,scope);
 assert.equal(report.leaveDays,5);
 assert.equal(report.pendingLeave.length,1);
 assert.equal(report.leave.length,4);
 assert.equal(report.leaveTypes[0].days,5);
 assert.equal(weekdays('2026-11-20','2026-11-25',scope).length,3);
 assert.equal(weekdays('2026-11-21','2026-11-22',{...scope,start:'2026-11-20',end:'2026-11-23'}).length,0);
});

test('current headcount excludes exited and future-start profiles and does not pretend to be historical',()=>{
 const data=source();
 data.employees.push({id:'future',values:['EMP999','Future Employee','Technology','Developer','Permanent',today(30)],status:'Active'});
 const report=buildReport(data,{start:today(-29),end:today(31),department:''});
 assert.equal(report.current.length,7);
 assert.equal(report.people.length,9);
 assert(report.joiners.some(e=>e.id==='future'));
 assert.equal(report.departments.reduce((n,d)=>n+d.count,0),7);
 assert.equal(buildReport(data,{...scope,department:'Nonexistent'}).current.length,0);
});

test('operational snapshots use current state and department ownership, not reporting dates',()=>{
 const data=source();
 const all=buildReport(data,scope),otherDates=buildReport(data,{...scope,start:'2026-01-01',end:'2026-01-02'});
 assert.equal(all.overdueObligations.length,otherDates.overdueObligations.length);
 assert.equal(all.overdueAssets.length,otherDates.overdueAssets.length);
 const technology=buildReport(data,{...scope,department:'Technology'});
 assert(technology.assets.every(a=>a.employee&&data.employees.find(e=>e.id===a.employee).values[2]==='Technology'));
 assert.equal(technology.cases.length,1);
 assert.equal(technology.assets.length,1);
 assert.equal(buildReport(data,{...scope,department:'Operations'}).overdueAssets.length,1);
});

test('reports reflect source changes without cached fabricated history',()=>{
 const data=source(),range={start:today(-29),end:today(29),department:''};
 const before=buildReport(data,range);
 data.workforce.leave=data.workforce.leave.map(l=>l.status==='Pending'?{...l,status:'Approved'}:l);
 const after=buildReport(data,range);
 assert.equal(after.pendingLeave.length,0);
 assert(after.approvedLeave.length>before.approvedLeave.length);
 assert(after.leaveDays>before.leaveDays);
});

test('assistant answers carry explicit sources and distinguish policy from record summaries',()=>{
 const data=source(),range={start:today(-29),end:today(29),department:''};
 const leave=answerQuestion('How many leave requests overlap my period?',data,range);
 assert.equal(leave.href,'/leave');
 assert.equal(leave.facts.find(f=>f.label==='Pending requests').value,2);
 assert(leave.basis.includes('No entitlement'));
 const policy=answerQuestion('How much leave am I entitled to?',data,range);
 assert.equal(policy.facts.length,0);
 assert.equal(policy.href,'/self-service');
 assert(policy.text.includes('does not interpret policy text'));
 const cases=answerQuestion('Summarise employee cases',data,range);
 assert.equal(cases.href,'/relations');
 assert(!JSON.stringify(cases).includes('Working arrangement concern'));
 assert.equal(answerQuestion('What will next year look like?',data,range).facts.length,0);
 assert.equal(answerQuestion('Attendance',data,{...range,start:''}).title,'Check your reporting dates');
});

test('exports include scope, human names and CSV formula protection',()=>{
 const data=source(),range={start:today(-29),end:today(),department:''},report=buildReport(data,range);
 const rows=exportRows(report,range,'Attendance');
 assert(rows.some(r=>r.includes('Alex Morgan')));
 assert(rows.some(r=>r[0]==='Department'&&r[1]==='All departments'));
 const csv=csvText([['=1+1',' @SUM(A1)','a"b','line\nbreak']]);
 assert(csv.includes('"\'=1+1"'));
 assert(csv.includes('"\' @SUM(A1)"'));
 assert(csv.includes('"a""b"'));
 assert(csv.includes('"line\nbreak"'));
});

test('analytics and assistant render distinct report and conversational entry screens',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom');
 const {HRAnalytics}=require('../src/intelligence/HRAnalytics.tsx'),{HRAssistant}=require('../src/intelligence/HRAssistant.tsx');
 const render=C=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(C,source())));
 const analytics=render(HRAnalytics),assistant=render(HRAssistant);
 assert(analytics.includes('Workforce by department'));
 assert(analytics.includes('Employee source records'));
 assert(!analytics.includes('Module activity'));
 assert(assistant.includes('What would you like to understand?'));
 assert(assistant.includes('No connected AI'));
 assert(!assistant.includes('intel-summary'));
});
