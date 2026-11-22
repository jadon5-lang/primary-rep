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
 assert.ok(body.records.every(d=>d.survey_version==='V10.2'&&Array.isArray(d.answers)&&d.answers.length===9));
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
 const r={type:'participant',id:'100',survey_version:'V10.2',answers:[80,80,80,20,30,30,20,20,20],created_at:new Date().toISOString()};
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
 assert.equal(row.survey_version,'V10.2');
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
 const invalid=[[0,0,0,0,0,0,0,0,100.01],[0,0,0,0,0,0,0,0,101],[0,0,0,0,0,0,0,0,-0.1],[0,0,0,0,0,0,0,0,1.234],[0,0,0,0,0,0,0,0,'30']];
 for(let i=0;i<invalid.length;i++){
   const res=await handleSeamRequest(req('submit','POST',{consent:true,answers:invalid[i],device_token:token(401+i)}),()=>fresh,{password:secret});
   assert.equal(res.status,400,'Invalid score input '+JSON.stringify(invalid[i])+' received status '+res.status);
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

test('participants can skip any question without equating a skip to zero', async () => {
 const fresh=new MemoryStore();
 const answers=[0,null,55.5,null,25,50,null,0,null];
 const r=await handleSeamRequest(req('submit','POST',{consent:true,answers,device_token:token(500)}),()=>fresh,{password:secret});
 assert.equal(r.status,201);
 const body=await r.json();assert.equal(body.record.coords,null);
 assert.deepEqual(body.record.answers,answers);
 const report=await (await handleSeamRequest(req('research','GET',null,{authorization:'Bearer '+secret}),()=>fresh,{password:secret})).json();
 assert.equal(report.summary.count,1);assert.equal(report.summary.plotted_count,0);
 assert.equal(report.summary.pressure.mean,null);
 assert.equal(report.summary.dimensions[0].mean,0);
 assert.equal(report.summary.dimensions[1].mean,null);
 assert.equal(report.summary.dimensions[1].skipped_count,1);
 assert.equal(report.summary.dimensions[5].mean,50);
 assert.equal(report.summary.dimensions[6].answered_count,0);
 assert.equal(report.summary.concealment_mean,37.5);
});
test('only complete pressure records appear in public 3D diagram', async () => {
 const fresh=new MemoryStore();
 const postTo=(i,a)=>handleSeamRequest(req('submit','POST',{consent:true,answers:a,device_token:token(i)}),()=>fresh,{password:secret});
 for(let i=0;i<5;i++)assert.equal((await postTo(600+i,[20+i,30+i,40+i,0,0,0,0,0,0])).status,201);
 const skip=await postTo(620,[null,100,100,0,0,0,0,0,0]);assert.equal(skip.status,201);
 const map=await (await handleSeamRequest(req('map','GET',null,{'x-seam-token':token(620)}),()=>fresh,{password:secret})).json();
 assert.equal(map.count,6);assert.equal(map.plotted_count,5);
 assert.equal(map.points.length,5);
 assert.ok(map.points.every(p=>p.answers.length===3&&p.answers.every(x=>typeof x==='number')));
});
test('same-browser withdrawal deletes both response and claim, but another browser cannot delete it', async () => {
 const fresh=new MemoryStore(), t=token(701),alien=token(702);
 const submitted=await (await handleSeamRequest(req('submit','POST',{consent:true,answers:Array(9).fill(30),device_token:t}),()=>fresh,{password:secret})).json();
 const id=submitted.record.id;
 const bad=await handleSeamRequest(req('withdraw','POST',{id,device_token:alien}),()=>fresh,{password:secret});
 assert.equal(bad.status,403);
 const ok=await handleSeamRequest(req('withdraw','POST',{id,device_token:t}),()=>fresh,{password:secret});
 assert.equal(ok.status,200);assert.equal((await ok.json()).withdrawn,true);
 const rem=await (await handleSeamRequest(req('research','GET',null,{authorization:'Bearer '+secret}),()=>fresh,{password:secret})).json();
 assert.equal(rem.summary.count,0);
 assert.equal((await fresh.list({prefix:'claim/'})).blobs.length,0);
});
test('password-protected researcher can honor removal request', async () => {
 const fresh=new MemoryStore();
 const created=await (await handleSeamRequest(req('submit','POST',{consent:true,answers:Array(9).fill(80),device_token:token(801)}),()=>fresh,{password:secret})).json();
 const id=created.record.id;
 const rejected=await handleSeamRequest(req('remove-record','POST',{id}),()=>fresh,{password:secret});assert.equal(rejected.status,401);
 const removed=await handleSeamRequest(req('remove-record','POST',{id},{authorization:'Bearer '+secret}),()=>fresh,{password:secret});
 assert.equal(removed.status,200);
 assert.equal((await fresh.list({prefix:'entry/'})).blobs.length,0);
});
test('Excel preserves blanks for skipped questions and safe formulas for missing pressure', async () => {
 const {makeWorkbook}=await import('../lib/workbook.mjs');
 const ExcelJS=(await import('exceljs')).default;
 const now=new Date().toISOString();
 const rows=[
  {id:'110',type:'participant',survey_version:'V10.2',created_at:now,answers:[0,100,50,20,30,40,50,60,70]},
  {id:'111',type:'participant',survey_version:'V10.2',created_at:now,answers:[null,100,50,null,30,40,50,60,70]}
 ];
 const wbytes=await makeWorkbook(rows,summarize(rows));const wb=new ExcelJS.Workbook();
 await wb.xlsx.load(wbytes);
 const sh=wb.getWorksheet('Anonymous Responses');
 assert.equal(sh.getCell('D2').value,0);
 assert.equal(sh.getCell('D3').value,null);
 assert.equal(sh.getCell('M2').value.result,150);
 assert.ok(sh.getCell('M3').value.result==null||sh.getCell('M3').value.result==='');
 assert.match(sh.getCell('P3').value.formula,/COUNT\(D3:F3\)=3/);
 assert.equal(wb.getWorksheet('Findings Summary').getCell('J15').value,0);
});

test('V10.2 presents all nine survey items with appropriate question-specific slider anchors', async () => {
 const fs=await import('node:fs/promises');
 const html=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const questionMatch=html.match(/const QUESTIONS=(\[[^\n]*\]);/);
 const scalesMatch=html.match(/const SCALES=(\[[^\n]*\]);/);
 assert.ok(questionMatch&&scalesMatch,'Questions and scales must be present in the UI');
 const questions=JSON.parse(questionMatch[1]),scales=JSON.parse(scalesMatch[1]);
 assert.equal(questions.length,9);
 assert.equal(scales.length,9);
 assert.deepEqual(scales.map(s=>s.kind),['Influence','Dependency','Influence','Frequency','Frequency','Frequency','Immediate relief','Delayed difficulty','Willingness']);
 assert.deepEqual(scales.map(s=>s.low),['No influence','Not dependent','No influence','Never','Never','Never','No relief','No difficulty','Not willing']);
 assert.deepEqual(scales.map(s=>s.high),['Decisive influence','Completely dependent','Decisive influence','Very often','Very often','Very often','Substantial relief','Severe difficulty','Fully willing']);
 assert.ok(questions.slice(3,6).every(q=>q.startsWith('How often')));
 assert.ok(questions.slice(6,8).every(q=>q.startsWith('When you kept an uncertainty private')));
 assert.match(html,/ends\.className='slider-labels'/);
 assert.match(html,/\['0 · '\+scale\.low,'100 · '\+scale\.high\]/);
 assert.match(html,/meta\.textContent=scale.kind/);
 assert.match(html,/Your responses are saved/);
 assert.match(html,/id="studentResult"[^>]*hidden/);
 assert.match(html,/id="successBackdrop"[^>]*hidden/);
 assert.match(html,/The diagram remains hidden until after you submit/);
 assert.match(html,/data.study!=='THE SEAM V10.2'/);
});
test('V10.2 research documents clarify that frequency sliders are not identical to pressure measures', async () => {
 const {makeWorkbook}=await import('../lib/workbook.mjs');
 const ExcelJS=(await import('exceljs')).default;
 const rows=[{id:'110',survey_version:'V10.2',answers:[80,90,70,35,50,75,20,60,100],created_at:new Date().toISOString()}];
 const b=await makeWorkbook(rows,summarize(rows));const wb=new ExcelJS.Workbook();await wb.xlsx.load(b);
 const q=wb.getWorksheet('Question Key');
 assert.match(q.getCell('C2').value,/Influence/);
 assert.match(q.getCell('C3').value,/Dependency/);
 assert.match(q.getCell('C5').value,/Frequency/);
 assert.match(q.getCell('C8').value,/Immediate relief/);
 assert.match(q.getCell('C9').value,/Delayed difficulty/);
 assert.match(q.getCell('C10').value,/Willingness/);
 assert.equal(wb.getWorksheet('Anonymous Responses').getCell('S2').value,'V10.2');
 const stats=summarize(rows);
 assert.match(stats.method_note,/question-specific anchors/);
 assert.match(stats.method_note,/not percentages/);
});

test('V10.2 architectural slider shows a 50 preview with gold-left ghost-right track, no intermediate ticks', async () => {
 const fs=await import('node:fs/promises');
 const html=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(html,/\.question-text\{[^}]*color:#143d33/);
 assert.match(html,/\.slider-input\{[^}]*background:linear-gradient\(90deg,#b28b52/);
 assert.match(html,/rgba\(176,172,161,\.23\)/);
 assert.match(html,/\.slider-input::-webkit-slider-thumb\{[^}]*width:31px;height:38px/);
 assert.match(html,/\.slider-float\.preview/);
 assert.match(html,/slider\.value=answers\[i\]\?\?50/);
 assert.match(html,/readout\.textContent=skipped\[i\]\?'Skipped':answers\[i\]===null\?'50'/);
 assert.match(html,/const width=rail\.clientWidth/);
 assert.match(html,/slider\.style\.setProperty\('--fill',value\+'%'\)/);
 assert.doesNotMatch(html,/className='slider-scale'/);
 assert.doesNotMatch(html,/ticks\.innerHTML/);
 assert.match(html,/id="studentResult"[^>]*hidden/);
});

test('release compatibility: V9 researcher interface controls and structure are preserved', async () => {
 const {readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const from=html.indexOf('<div id="researchScreen"');
 const to=html.indexOf('<div id="successBackdrop"',from);
 assert.ok(from>=0&&to>from);
 const page=html.slice(from,to);
 for(const id of ['researchScreen','researcherLogin','researcherAuthForm','researcherPassword','researchCanvas','researchTools','researchOverview','researchUpdated','statCount','statFamily','statFinancial','statAcademic','statTotal','inspectHead','dashboardFootnote','distributionTable','responsesTable','btnExport','btnExcel','btnPrint','btnReset']){
  assert.match(page,new RegExp('id="'+id+'"'),id+' researcher element missing');
 }
 assert.match(page,/Unlock the findings report/);
 assert.match(page,/Research findings and analysis/);
 assert.match(page,/3D triangular pressure diagram/);
 assert.match(page,/Question-by-question distribution/);
 assert.match(page,/Participant dataset/);
 assert.doesNotMatch(page,/id="btnRemoveSelected"/,'No new visible researcher controls should be added');
 const distribution=page.match(/<table class="report-table" id="distributionTable">([\s\S]*?)<\/table>/)?.[1];
 assert.ok(distribution);
 assert.equal((distribution.match(/<th>/g)||[]).length,7,'Preserve original seven-column research distribution layout');
 assert.match(html,/new URLSearchParams\(location.search\).get\('report'\)==='1'/,'Keep existing researcher URL mechanism');
 assert.match(html,/\$\('tabResearch'\)\.hidden=!IS_RESEARCHER/);
 assert.ok(html.includes("fetch(API+'/research'"),'Research endpoint wiring must remain intact');
 assert.ok(html.includes("fetch(API+'/export'"));
 assert.match(html,/downloadPrivate\('workbook'/);
});
test('release integration: participant submissions remain linked to the private research page and exports', async () => {
 const fresh=new MemoryStore();
 const tk=token(990);
 const response=[62.5,81,43.7,20.5,44,89.9,11.1,78.5,90];
 const submitted=await handleSeamRequest(req('submit','POST',{consent:true,answers:response,device_token:tk}),()=>fresh,{password:secret});
 assert.equal(submitted.status,201);
 const record=(await submitted.json()).record;
 assert.equal(record.survey_version,'V10.2');
 assert.deepEqual(record.answers,response);
 assert.ok(/^\d{3}$/.test(record.id));
 assert.match(record.created_at,/^\d{4}-\d{2}-\d{2}T/);
 const unauthorized=await handleSeamRequest(req('research'),()=>fresh,{password:secret});
 assert.equal(unauthorized.status,401);
 const report=await handleSeamRequest(req('research','GET',null,{authorization:'Bearer '+secret}),()=>fresh,{password:secret});
 assert.equal(report.status,200);
 const data=await report.json();
 assert.equal(data.summary.count,1);
 assert.equal(data.summary.plotted_count,1);
 assert.equal(data.records[0].id,record.id);
 assert.equal(data.records[0].answers[1],81);
 assert.ok(data.records[0].coords);
 assert.equal(data.summary.dimensions[3].mean,20.5);
 const map=await handleSeamRequest(req('map','GET',null,{'x-seam-token':tk}),()=>fresh,{password:secret});
 assert.equal(map.status,200);
 assert.equal((await map.json()).count,1);
 const csv=await handleSeamRequest(req('export','GET',null,{authorization:'Bearer '+secret}),()=>fresh,{password:secret});
 assert.equal(csv.status,200);
 const csvData=await csv.text();
 assert.match(csvData,/62\.5/);
 assert.match(csvData,/81/);
 assert.match(csvData,/V10\.2/);
 const workbook=await handleSeamRequest(req('workbook','GET',null,{authorization:'Bearer '+secret}),()=>fresh,{password:secret});
 assert.equal(workbook.status,200);
 assert.match(workbook.headers.get('content-type'),/spreadsheetml/);
});
test('release safety: new V10.2 submissions cannot touch the original V9 production blob namespace', async () => {
 const {readFile}=await import('node:fs/promises');
 const body=await readFile(new URL('../netlify/functions/api.mjs',import.meta.url),'utf8');
 assert.match(body,/getStore\(\{ name: 'the-seam-verified-responses-v10-2'/);
 assert.match(body,/getDeployStore\(\{ name: 'the-seam-verified-responses-v10-2-preview'/);
 assert.doesNotMatch(body,/getStore\(\{ name: 'the-seam-verified-responses-v8'/);
 const {storageScopeFor}=await import('../lib/deploy-safety.mjs');
 assert.equal(storageScopeFor({deploy:{context:'production'}}),'site-wide-production');
 assert.equal(storageScopeFor({deploy:{context:'branch-deploy'}}),'deploy-specific-preview');
});
