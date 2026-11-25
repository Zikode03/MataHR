const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),{transformSync}=require('esbuild');
Module._extensions['.ts']=(mod,file)=>mod._compile(transformSync(fs.readFileSync(file,'utf8'),{loader:'ts',format:'cjs'}).code,file);
const {api,ApiError,can}=require('../src/live/api.ts');
test('live API writes use same-origin session cookies, JSON and the required CSRF header',async()=>{
 const original=global.fetch;
 try{global.fetch=async(url,options)=>{assert.equal(url,'/api/leave/requests');assert.equal(options.credentials,'include');assert.equal(options.headers['X-MataHR-Request'],'1');assert.equal(options.headers['Content-Type'],'application/json');assert.deepEqual(JSON.parse(options.body),{policyId:'real-id'});return new Response(JSON.stringify({id:'persisted'}),{status:200});};assert.deepEqual(await api('/leave/requests','POST',{policyId:'real-id'}),{id:'persisted'});}finally{global.fetch=original;}
});
test('expired sessions trigger sign-in and forbidden operations never return demo records',async()=>{
 const original=global.fetch,oldWindow=global.window;let expired=0;global.window={dispatchEvent:event=>{assert.equal(event.type,'matahr:session-expired');expired++;}};
 try{global.fetch=async()=>new Response('',{status:401});await assert.rejects(()=>api('/employees'),error=>error instanceof ApiError&&error.status===401);assert.equal(expired,1);global.fetch=async()=>new Response(JSON.stringify({error:{message:'Access denied'}}),{status:403});await assert.rejects(()=>api('/payroll/salaries'),/Access denied/);assert.equal(expired,1);}finally{global.fetch=original;global.window=oldWindow;}
});
test('validation errors remain actionable and empty successful responses are accepted',async()=>{
 const original=global.fetch;try{global.fetch=async()=>new Response(JSON.stringify({errors:{started:['Use an ISO date.']}}),{status:400});await assert.rejects(()=>api('/employees','POST',{}),/Use an ISO date/);global.fetch=async()=>new Response(null,{status:204});assert.equal(await api('/auth/logout','POST'),undefined);}finally{global.fetch=original;}
});
test('navigation capabilities come from server grants rather than role names',()=>{
 assert.equal(can({roles:['Admin'],permissions:[]},'Payroll.Manage'),false);assert.equal(can({roles:['HR'],permissions:['Workforce.Payroll.Manage']},'Payroll.Manage'),true);
});

test('invalid login and throttled requests give the user an actionable message',async()=>{
 const original=global.fetch;try{global.fetch=async()=>new Response(null,{status:401});await assert.rejects(()=>api('/auth/login','POST',{email:'someone@example.invalid',password:'not-a-real-password'}),/Check your work email/);global.fetch=async()=>new Response(null,{status:429});await assert.rejects(()=>api('/attendance/clock-in','POST',{}),/Wait a minute/);}finally{global.fetch=original;}
});
