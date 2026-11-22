import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSeamRequest,summarize,point} from '../lib/handlers.mjs';

class MemoryStore {
 constructor(){this.data=new Map()}
 async setJSON(key,val,opts={}){if(opts.onlyIfNew&&this.data.has(key))return {modified:false};this.data.set(key,structuredClone(val));return {modified:true}}
 async get(key){return structuredClone(this.data.get(key)??null)}
 async list({prefix=''}){return {blobs:Array.from(this.data.keys()).filter(k=>k.startsWith(prefix)).map(key=>({key})),directories:[]}}
 async delete(key){this.data.delete(key)}
}
const store=new MemoryStore();
const factory=()=>store;
const secret='a-dedicated-researcher-password';
const token=i=>('device-token-'+String(i).padStart(4,'0')+'-abcdefghijklmno0123456789').slice(0,65);
const req=(action,method='GET',body=null,headers={})=>new Request('https://the-seam-survey.netlify.app/api/'+action,{method,headers:{...(body?{'content-type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
const call=(action,method='GET',body=null,headers={})=>handleSeamRequest(req(action,method,body,headers),factory,{password:secret});
const post=i=>call('submit','POST',{consent:true,answers:[i*10,i*10+0.5,100-i*10,0,25.5,50,74.5,99.9,100],device_token:token(i)});

test('health and report access require authentication',async()=>{
 const h=await call('health');assert.equal((await h.json()).ok,true);
 const bad=await call('research');assert.equal(bad.status,401);
 const map=await call('map');assert.equal(map.status,403);
});
test('independent participants accumulate unique 3-digit IDs',async()=>{
 const res=await Promise.all(Array.from({length:7},(_,i)=>post(i)));
 const data=await Promise.all(res.map(r=>r.json()));
 assert.ok(data.every(d=>d.ok));
 assert.equal(new Set(data.map(d=>d.record.id)).size,7);
 assert.ok(data.every(d=>/^\d{3}$/.test(d.record.id)));
 const priv=await call('research','GET',null,{authorization:'Bearer '+secret});
 const body=await priv.json();assert.equal(body.records.length,7);
 assert.equal(body.summary.count,7);
 assert.ok(body.records.every(d=>d.survey_version==='V10'&&Array.isArray(d.answers)&&d.answers.length===9));
 assert.equal(body.summary.dimensions.length,9);
 assert.equal(body.summary.dimensions[0].counts.reduce((a,b)=>a+b,0),7);
});
test('repeat submission recovers the same ID without creating another record',async()=>{
 const a=await (await post(0)).json();assert.equal(a.recovered,true);
 const r=await (await call('research','GET',null,{authorization:'Bearer '+secret})).json();
 assert.equal(r.records.length,7); assert.equal(r.records.some(x=>x.id===a.record.id),true);
});
test('only submitted browser may receive group data, and other IDs are not leaked',async()=>{
 const miss=await call('map','GET',null,{'x-seam-token':token(13)});assert.equal(miss.status,403);
 const good=await call('map','GET',null,{'x-seam-token':token(0)});assert.equal(good.status,200);
 const map=await good.json();assert.equal(map.count,7);assert.equal(map.points.length,6);
 assert.ok(map.points.every(p=>Object.keys(p).join(',')==='answers'&&p.answers.length===3));
});
test('report CSV includes nine scores and Eastern timestamps',async()=>{
 const res=await call('export','GET',null,{authorization:'Bearer '+secret});assert.equal(res.status,200);
 const body=await res.text();assert.equal(body.trim().split('\r\n').length,8);
 assert.match(body,/submitted_at_eastern/);
 assert.match(body,/EST|EDT/);
 assert.match(body,/survey_version/);
 assert.match(body,/99.9/);
});
test('descriptive report does not claim causality and preserves empty dataset',()=>{
 const s=summarize([]);assert.equal(s.count,0);assert.equal(s.pressure.mean,null);assert.match(s.method_note,/not causal/);
});

test('equal primary-axis means are called out as a tie',()=>{
 const r={type:'participant',id:'100',survey_version:'V10',answers:[80,80,80,20,30,30,20,20,20],created_at:new Date().toISOString()};
 const stats=summarize([r]);assert.match(stats.highest_mean_pressure,/tied/);
});
test('insufficient group size does not disclose other points',async()=>{
 const isolated=new MemoryStore();
 await isolated.setJSON('claim/fake',{state:'completed',id:'100'});
 const res=await handleSeamRequest(req('map','GET',null,{'x-seam-token':token(0)}),()=>isolated,{password:secret});
 assert.equal(res.status,403);
});

test('storage context is safely isolated for all nonproduction deploys', async () => {
 const {storageScopeFor} = await import('../lib/deploy-safety.mjs');
 assert.equal(storageScopeFor({deploy:{context:'production'}}),'site-wide-production');
 for(const kind of ['deploy-preview','branch-deploy','preview-server','dev']) {
  assert.equal(storageScopeFor({deploy:{context:kind}}),'deploy-specific-preview');
 }
 assert.equal(storageScopeFor({}), 'unverified');
 assert.equal(storageScopeFor({deploy:{context:'unknown'}}), 'unverified');
});


test('V10 zero is a valid intentional answer and 100 is the maximum', async () => {
 const fresh=new MemoryStore();
 const request=req('submit','POST',{consent:true,answers:[0,0,0,0,0,0,0,0,0],device_token:token(301)});
 const res=await handleSeamRequest(request,()=>fresh,{password:secret});
 assert.equal(res.status,201);
 const row=(await res.json()).record;
 assert.equal(row.survey_version,'V10');
 assert.deepEqual(point(row),{x:0,y:0,z:0,total:0});
 const max=point({answers:[100,100,100]});
 assert.equal(max.z,205);assert.equal(max.total,300);
 assert.equal(max.x,0);assert.equal(max.y,0);
 const decimal=point({answers:[0,100,50]});
 assert.equal(decimal.total,150);
 assert.equal(decimal.x,-22);
 assert.equal(decimal.z,102.5);
});
test('one decimal place allowed, invalid values rejected', async () => {
 const fresh=new MemoryStore();
 const invalid=[[0,0,0,0,0,0,0,0,100.01],[0,0,0,0,0,0,0,0,101],[0,0,0,0,0,0,0,0,-0.1],[0,0,0,0,0,0,0,0,null],[0,0,0,0,0,0,0,0,1.234],[0,0,0,0,0,0,0,0,'30']];
 for(let i=0;i<invalid.length;i++){
   const res=await handleSeamRequest(req('submit','POST',{consent:true,answers:invalid[i],device_token:token(401+i)}),()=>fresh,{password:secret});
   assert.equal(res.status,400);
 }
 assert.equal((await fresh.list({prefix:'entry/'})).blobs.length,0);
 const ok=await handleSeamRequest(req('submit','POST',{consent:true,answers:[0,0.1,25,50.5,75,99.9,100,0,100],device_token:token(450)}),()=>fresh,{password:secret});
 assert.equal(ok.status,201);
});
test('V9 records are excluded from V10 summaries by version', async () => {
 const fresh=new MemoryStore();
 await fresh.setJSON('entry/101',{type:'participant',id:'101',answers:Array(9).fill(1),created_at:new Date().toISOString()});
 const body=await (await handleSeamRequest(req('research','GET',null,{authorization:'Bearer '+secret}),()=>fresh,{password:secret})).json();
 assert.equal(body.summary.count,0);assert.equal(body.records.length,0);
});
