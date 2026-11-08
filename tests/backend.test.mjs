import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSeamRequest,summarize} from '../lib/handlers.mjs';

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
const post=i=>call('submit','POST',{consent:true,answers:[1+(i%4),1+((i+1)%4),1+((i+2)%4),2,3,4,1,2,3],device_token:token(i)});

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
 assert.ok(body.records.every(d=>Array.isArray(d.answers)&&d.answers.length===9));
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
});
test('descriptive report does not claim causality and preserves empty dataset',()=>{
 const s=summarize([]);assert.equal(s.count,0);assert.equal(s.pressure.mean,null);assert.match(s.method_note,/not causal/);
});

test('equal primary-axis means are called out as a tie',()=>{
 const r={type:'participant',id:'100',answers:[4,4,4,2,3,3,2,2,2],created_at:new Date().toISOString()};
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
