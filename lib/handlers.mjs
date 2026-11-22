import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const json = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const error = (msg, status=400) => json({ok:false,error:msg},status);
// V10: each question accepts an explicitly selected 0–100 response, in 0.1 steps.
const validScore = x => typeof x==='number' && Number.isFinite(x) && x>=0 && x<=100 && Math.abs(x*10-Math.round(x*10))<1e-7;
const validAnswers = arr => Array.isArray(arr) && arr.length===9 && arr.every(x=>x===null||validScore(x));
const fullPressure = arr => arr.slice(0,3).every(validScore);
const answered = a => a.filter(validScore);
const concealmentAverage = arr => mean(answered(arr.slice(3,6)));
const digest = token => createHash('sha256').update('seam-once-v10.1:'+token).digest('hex');
const equal = (a,b) => typeof a==='string' && typeof b==='string' && b.length>=12 && timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
const headers = {'cache-control':'no-store','x-content-type-options':'nosniff'};
const isRecord = r => r && r.type==='participant' && r.survey_version==='V10.1' && /^\d{3}$/.test(r.id||'') && validAnswers(r.answers) && typeof r.created_at==='string';
const fmtId = x => String(x).padStart(3,'0');
const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
const median = a => {if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);const n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2};
const safeNumber = n => n==null?null:Math.round(n*1000)/1000;
const corr=(a,b)=>{if(a.length<5)return null;const ma=mean(a),mb=mean(b);let xy=0,xx=0,yy=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;xy+=x*y;xx+=x*x;yy+=y*y}return xx>0&&yy>0?safeNumber(xy/Math.sqrt(xx*yy)):null};
const FIELDS=['Family expectations','Financial obligations','Academic evaluation','Did not ask a question','Presented a decision as settled','Delayed feedback','Privacy made interaction easier','Privacy made task harder','Discussed unfinished idea'];
// If any spatial axis was skipped, do not mistake absence for a zero score.
export const point = r => {const a=r.answers;if(!fullPressure(a))return null;const t=i=>a[i]/100;const vertices=[[0,150],[-132,-75],[132,-75]];const x=vertices.reduce((sum,v,i)=>sum+v[0]*t(i),0)/3;const y=vertices.reduce((sum,v,i)=>sum+v[1]*t(i),0)/3;const total=a[0]+a[1]+a[2];return {x:safeNumber(x),y:safeNumber(y),z:safeNumber(total/300*205),total:safeNumber(total)};};
export function summarize(rows){
 const n=rows.length;
 const dimensions=FIELDS.map((name,j)=>{
  const vals=answered(rows.map(r=>r.answers[j]));
  const counts=[0,1,2,3].map(k=>vals.filter(x=>x>=k*25&&(k===3?x<=100:x<(k+1)*25)).length);
  return {name,question:`Q${j+1}`,mean:safeNumber(mean(vals)),median:median(vals),counts,
   answered_count:vals.length,skipped_count:n-vals.length,
   frequent_pct:vals.length?safeNumber(100*(counts[2]+counts[3])/vals.length):null};
 });
 const complete=rows.filter(r=>fullPressure(r.answers));
 const totals=complete.map(r=>r.answers[0]+r.answers[1]+r.answers[2]);
 const concealment=answered(rows.map(r=>concealmentAverage(r.answers)));
 const paired=rows.filter(r=>fullPressure(r.answers)&&r.answers.slice(3,6).every(validScore));
 const pairedTotals=paired.map(r=>r.answers[0]+r.answers[1]+r.answers[2]);
 const pairedConcealment=paired.map(r=>mean(r.answers.slice(3,6)));
 const leader={family:0,financial:0,evaluation:0,tied:0};
 complete.forEach(r=>{const arr=r.answers.slice(0,3);const mx=Math.max(...arr);const ids=arr.flatMap((a,i)=>a===mx?[i]:[]);if(ids.length===1)leader[['family','financial','evaluation'][ids[0]]]++;else leader.tied++});
 const pressure=dimensions.slice(0,3),validMeans=pressure.map(d=>d.mean).filter(x=>x!==null);
 const topMean=validMeans.length?Math.max(...validMeans):null;
 const leaders=topMean===null?[]:pressure.filter(d=>d.mean!==null&&Math.abs(d.mean-topMean)<0.0005).map(d=>d.name);
 return {count:n,plotted_count:complete.length,updated_at:new Date().toISOString(),
  pressure:{mean:safeNumber(mean(totals)),median:median(totals),min:totals.length?Math.min(...totals):null,max:totals.length?Math.max(...totals):null,valid_count:totals.length},
  dimensions,leading_pressure:leader,concealment_mean:safeNumber(mean(concealment)),relationship:corr(pairedTotals,pairedConcealment),
  highest_mean_pressure:leaders.length?leaders.length===1?leaders[0]:leaders.join(', ')+' (tied)':null,
  method_note:'THE SEAM V10.1: nine exploratory statements about the prior four weeks, rated for perceived applicability from 0 (not at all true of my experience) to 100 (completely true of my experience), in 0.1 increments. Ratings are not event frequencies, percentages of decisions, or objectively measured forces. Skipped entries remain blank, never zero. A 3D point and pressure total require all Q1–Q3 answers. Per-question means exclude skips. Q4–Q6 mean uses answered items; correlation uses complete Q1–Q6 cases. Descriptive associations are not causal; this is not a validated psychological scale.'};
}
async function rows(store){const {blobs}=await store.list({prefix:'entry/'});const rs=await Promise.all(blobs.map(async ({key})=>{try{return await store.get(key,{type:'json',consistency:'strong'})}catch{return null}}));return rs.filter(isRecord).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));}
async function tryId(store,tokenHash,answers){
 const created_at=new Date().toISOString();
 const start=randomBytes(2).readUInt16BE(0)%900;
 for(let offset=0;offset<900;offset++){
  const id=fmtId(100+((start+offset*37)%900));
  const r={type:'participant',survey_version:'V10.1',id,answers,created_at,token_hash:tokenHash};
  const result=await store.setJSON('entry/'+id,r,{onlyIfNew:true});
  if(result?.modified)return r;
 }
 return null;
}
const allowedPublic=r=>({answers:r.answers.slice(0,3)});
const validToken=t=>typeof t==='string'&&/^[a-zA-Z0-9_-]{24,128}$/.test(t);
async function recoverSubmission(store,tokenHash){
 const claim=await store.get('claim/'+tokenHash,{type:'json',consistency:'strong'});
 if(!claim)return null;
 if(claim.id){const r=await store.get('entry/'+claim.id,{type:'json',consistency:'strong'});if(isRecord(r)&&r.token_hash===tokenHash)return r;}
 // If the network failed between the two writes, recover without generating a second record.
 const existing=await rows(store);return existing.find(r=>r.token_hash===tokenHash)||null;
}

const privateRecord=r=>({type:'participant',survey_version:'V10.1',id:r.id,answers:r.answers,created_at:r.created_at,coords:point(r)});
const reportAuth=(req,password)=>{const h=req.headers.get('authorization')||'';return h.startsWith('Bearer ')&&equal(h.slice(7),password)};
const csvEscape=(v)=>'"'+String(v??'').replaceAll('"','""').replace(/^[=+@\-\t\r]/,'\u200b$&')+'"';
const csvFromRows=(rows)=>{
 const head=['participant_id','survey_version','submitted_at_utc','submitted_at_eastern',...FIELDS.map((_,i)=>'Q'+(i+1)), 'pressure_total','pressure_mean','concealment_mean','x','y','z'];
 const dt=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'});
 return [head, ...rows.map(r=>{const p=point(r);return [r.id,r.survey_version,r.created_at,dt.format(new Date(r.created_at)),...r.answers,p?.total??null,p?safeNumber(p.total/3):null,safeNumber(concealmentAverage(r.answers)),p?.x??null,p?.y??null,p?.z??null]})].map(a=>a.map(csvEscape).join(',')).join('\r\n')+'\r\n';
};
const binary=(bytes,contentType,filename)=>new Response(bytes,{headers:{...headers,'content-type':contentType,'content-disposition':`attachment; filename="${filename}"`}});
export async function handleSeamRequest(request,storeFactory,options={}){
 const action=new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
 const method=request.method.toUpperCase();
 const password=options.password??process.env.SEAM_RESEARCHER_PASSWORD;
 if(action==='health' && method==='GET'){
  try{await storeFactory().list({prefix:'entry/'});return json({ok:true,shared_storage:true,study:'THE SEAM V10.1',response_meaning:'statement_applicability',response_scale:'0–100',step:0.1,id_range:'100–999'})}
  catch(e){console.error('health',e);return error('The shared survey database is unavailable.',503)}
 }
 if(action==='submit' && method==='POST'){
  const origin=request.headers.get('origin');if(origin&&new URL(origin).host!==new URL(request.url).host)return error('Origin not allowed.',403);
  if(Number(request.headers.get('content-length')||0)>4000)return error('Submission too large.',413);
  let body;try{body=await request.json()}catch{return error('Invalid submission.')}
  if(!body||JSON.stringify(body).length>2500||body.consent!==true||!validAnswers(body.answers))return error('Provide nine numeric responses or skipped (null) values, and consent.');
  if(!validToken(body.device_token))return error('Anonymous browser token is invalid.');
  const tokenHash=digest(body.device_token),store=storeFactory();
  const claimKey='claim/'+tokenHash;
  try{
   const claim=await store.setJSON(claimKey,{created_at:new Date().toISOString(),state:'allocating'},{onlyIfNew:true});
   if(!claim?.modified){
    const prior=await recoverSubmission(store,tokenHash);
    if(prior)return json({ok:true,recovered:true,record:privateRecord(prior)},200);
    return error('A previous submission from this browser is being verified. Ask the researcher before retrying.',409);
   }
   const r=await tryId(store,tokenHash,body.answers.slice());
   if(!r){await store.delete(claimKey).catch(()=>{});return error('All 900 anonymous three-digit participant IDs have been assigned. Please contact the researcher.',507)}
   try{await store.setJSON(claimKey,{state:'completed',id:r.id,created_at:r.created_at})}catch(e){console.error('claim finalization after successful entry',e)}
   return json({ok:true,record:privateRecord(r)},201);
  }catch(e){console.error('submit',e);return error('Could not confirm the submission. Contact the researcher before attempting again.',503)}
 }

 // Same-browser withdrawal: proof of ownership requires the private browser token AND assigned ID.
 if(action==='withdraw'&&method==='POST'){
  const origin=request.headers.get('origin');if(origin&&new URL(origin).host!==new URL(request.url).host)return error('Origin not allowed.',403);
  let body;try{body=await request.json()}catch{return error('Invalid withdrawal request.')}
  if(!validToken(body?.device_token)||!/^\d{3}$/.test(body?.id||''))return error('Invalid withdrawal receipt.',400);
  const hash=digest(body.device_token),store=storeFactory();
  try{
   const own=await recoverSubmission(store,hash);
   if(!own||own.id!==body.id)return error('Could not verify this submission from this browser.',403);
   await store.delete('entry/'+own.id);
   await store.delete('claim/'+hash);
   return json({ok:true,withdrawn:true,id:own.id});
  }catch(e){console.error('withdraw',e);return error('Withdrawal could not be confirmed. Please contact the researcher.',503)}
 }
 // A password-authenticated researcher can honor an identified response-removal request.
 if(action==='remove-record'&&method==='POST'){
  if(!password||password.length<12||!reportAuth(request,password))return error('Invalid researcher password.',401);
  let body;try{body=await request.json()}catch{return error('Invalid removal request.')}
  if(!/^\d{3}$/.test(body?.id||''))return error('Invalid participant ID.');
  try{
   const store=storeFactory(),r=await store.get('entry/'+body.id,{type:'json',consistency:'strong'});
   if(!isRecord(r))return error('Participant record not found.',404);
   await store.delete('entry/'+r.id);
   if(r.token_hash)await store.delete('claim/'+r.token_hash);
   return json({ok:true,removed:true,id:r.id});
  }catch(e){console.error('remove-record',e);return error('Could not confirm the record was removed.',503)}
 }
 if(action==='map'&&method==='GET'){
  const token=request.headers.get('x-seam-token');
  if(!validToken(token))return error('Complete the survey before viewing the group map.',403);
  try{
   const store=storeFactory(), own=await recoverSubmission(store,digest(token));
   if(!own)return error('Complete the survey before viewing the group map.',403);
   const all=await rows(store);
   const plotted=all.filter(r=>point(r)!==null);return json({ok:true,count:all.length,plotted_count:plotted.length,minimum_visible:5,points:plotted.length>=5?plotted.filter(r=>r.id!==own.id).map(allowedPublic):[]});
  }
  catch(e){console.error('map',e);return error('Could not load the group diagram.',503)}
 }
 if(['report','research','export','workbook'].includes(action)&&method==='GET'){
  if(!password||password.length<12)return error('Research access is not configured.',503);
  if(!reportAuth(request,password))return error('Invalid researcher password.',401);
  let all;try{all=await rows(storeFactory())}catch(e){console.error('report',e);return error('Could not load saved responses.',503)}
  const s=summarize(all);
  if(action==='research'||action==='report')return json({ok:true,summary:s,records:all.map(privateRecord)});
  if(action==='export')return binary(csvFromRows(all),'text/csv; charset=utf-8','THE_SEAM_V10_responses.csv');
  // ExcelJS is only loaded when the researcher asks for the workbook.
  try{
   const {makeWorkbook}=await import('./workbook.mjs');
   const data=await makeWorkbook(all,s);
   return binary(data,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','THE_SEAM_V10_research_report.xlsx');
  }catch(e){console.error('xlsx generation failed',e);return error('The Excel report could not be generated; CSV export is still available.',503)}
 }
 return error('Unknown survey endpoint.',404);
}
