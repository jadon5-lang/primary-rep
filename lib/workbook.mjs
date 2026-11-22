import ExcelJS from 'exceljs';

const questionNames = [
 'Family/supporter expectations influencing which academic choices felt possible',
 'Financial responsibilities influencing academic opportunities or directions',
 'Anticipated grading/critique influencing disclosure of developing ideas',
 'Unasked questions due to concern about how asking might be perceived',
 'Presenting an undecided academic direction as settled',
 'Postponing feedback until prepared to explain or defend an approach',
 'Privacy of uncertainty making an interaction easier in the moment',
 'Unspoken uncertainty becoming more difficult to address later',
 'Sharing an unfinished idea before knowing whether it would work'];
const nfmt=v=>v==null?'':v;
const zone = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'});
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
function decorateHeader(sheet,last){sheet.getRow(1).height=34;sheet.getRow(1).eachCell({includeEmpty:true},(cell)=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF143432'}};cell.font={bold:true,color:{argb:'FFFFFFFF'},size:11,name:'Georgia'};cell.alignment={vertical:'middle'}});for(let i=1;i<=last;i++)sheet.getColumn(i).width=i===1?19:16;sheet.views=[{state:'frozen',ySplit:1}];}
export async function makeWorkbook(rows,summary){
 const w=new ExcelJS.Workbook();w.creator='THE SEAM';w.subject='Anonymous higher education student pressure survey';w.title='THE SEAM | Live research report';w.created=new Date();
 const overview=w.addWorksheet('Findings Summary',{views:[{state:'frozen',ySplit:2}]});
 overview.mergeCells('A1:J1');overview.getCell('A1').value='THE SEAM  |  FINDINGS REPORT';overview.getCell('A1').font={name:'Georgia',bold:true,size:19,color:{argb:'FFFFFFFF'}};overview.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF143432'}};overview.getRow(1).height=39;
 overview.getColumn('A').width=32;overview.getColumn('B').width=21;overview.getColumn('C').width=19;overview.getColumn('D').width=19;overview.getColumn('E').width=19;overview.getColumn('F').width=19;
 const lines=[['Created (UTC)',new Date().toISOString()],['Completed participants',summary.count],['Plotted participants (Q1–Q3 complete)',summary.plotted_count],['Mean total pressure (0–300)',nfmt(summary.pressure.mean)],['Median total pressure',nfmt(summary.pressure.median)],['Mean concealment Q4–Q6',nfmt(summary.concealment_mean)],['Pressure/concealment correlation',nfmt(summary.relationship)],['Most frequently top-rated domain',nfmt(summary.highest_mean_pressure)]];
 lines.forEach((line,i)=>{overview.getCell(`A${i+3}`).value=line[0];overview.getCell(`B${i+3}`).value=line[1]});
 overview.getCell('A12').value='QUESTION-LEVEL FINDINGS';overview.getCell('A12').font={bold:true,color:{argb:'FFAC864C'}};
 overview.getRow(13).values=['Measure','Mean','Median','0–24.9','25–49.9','50–74.9','75–100','50–100 (%)','Answered','Skipped'];
 for(let i=0;i<9;i++){const d=summary.dimensions[i];overview.getRow(14+i).values=[`Q${i+1} · ${d.name}`,nfmt(d.mean),nfmt(d.median),...d.counts,nfmt(d.frequent_pct),d.answered_count,d.skipped_count]}
 overview.getCell('A25').value='Interpretation note';overview.getCell('B25').value=summary.method_note;overview.mergeCells('B25:J26');overview.getCell('B25').alignment={wrapText:true,vertical:'top'};
 overview.getRow(13).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFECE4D5'}};c.font={bold:true,color:{argb:'FF143432'}}});
 overview.getColumn('A').width=43;overview.getColumn('F').width=19;overview.getColumn('G').width=19;overview.getColumn('H').width=22;overview.getColumn('I').width=14;overview.getColumn('J').width=14;
 const sheet=w.addWorksheet('Anonymous Responses');
 const heads=['Participant ID','Submitted (UTC)','Submitted (Eastern)', ...Array.from({length:9},(_,i)=>`Q${i+1}`),'Pressure total','Pressure mean','Concealment mean','Centroid X','Centroid Y','Height Z','Survey version'];
 sheet.addRow(heads);decorateHeader(sheet,heads.length);sheet.getColumn(2).width=26;sheet.getColumn(3).width=29;sheet.getColumn(1).width=19;
 rows.forEach((r,k)=>{
  const i=k+2,a=r.answers;
  const complete=a.slice(0,3).every(x=>typeof x==='number'&&Number.isFinite(x));
  const t=complete?a[0]+a[1]+a[2]:null;
  const p=complete?(-132*a[1]+132*a[2])/300:null;
  const q=complete?(150*a[0]-75*a[1]-75*a[2])/300:null;
  const conceal=a.slice(3,6).filter(x=>typeof x==='number');
  const cm=conceal.length?avg(conceal):null;
  const row=sheet.addRow([r.id,r.created_at,zone.format(new Date(r.created_at)),...a,
   {formula:`IF(COUNT(D${i}:F${i})=3,SUM(D${i}:F${i}),"")`,result:complete?t:''},
   {formula:`IF(COUNT(D${i}:F${i})=3,AVERAGE(D${i}:F${i}),"")`,result:complete?t/3:''},
   {formula:`IF(COUNT(G${i}:I${i})>0,AVERAGE(G${i}:I${i}),"")`,result:cm??''},
   {formula:`IF(COUNT(D${i}:F${i})=3,(-132*E${i}/100+132*F${i}/100)/3,"")`,result:p??''},
   {formula:`IF(COUNT(D${i}:F${i})=3,(150*D${i}/100-75*E${i}/100-75*F${i}/100)/3,"")`,result:q??''},
   {formula:`IF(COUNT(D${i}:F${i})=3,M${i}/300*205,"")`,result:complete?t/300*205:''},
   'V10.1']);
  row.getCell(1).numFmt='@';
  for(let j=4;j<=12;j++)row.getCell(j).numFmt='0.0';
  for(let j=13;j<=18;j++)row.getCell(j).numFmt='0.00';
  if(k%2===1)row.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF7F3EC'}});
 });
 if(rows.length){sheet.autoFilter={from:'A1',to:`S${rows.length+1}`};}
 const legend=w.addWorksheet('Question Key');legend.getColumn('A').width=13;legend.getColumn('B').width=87;legend.getColumn('C').width=35;legend.addRow(['Question','Survey measure','Scale']);decorateHeader(legend,3);questionNames.forEach((q,i)=>legend.addRow([`Q${i+1}`,q,'V10.1 · 0 not at all true / 100 completely true; 0.1 steps']));legend.getCell('A13').value='IDs';legend.getCell('B13').value='Anonymous three-digit codes (100–999) assigned by the server. Not student IDs.';
 legend.getCell('A15').value='Limit';legend.getCell('B15').value='900 unique participant codes per study. Extend ID digits for larger cohorts.';
 legend.getCell('A16').value='Version';legend.getCell('B16').value='V10.1 responses use a statement-applicability scale. Do not combine with earlier frequency-scale pilot responses.';legend.getCell('A17').value='Skips';legend.getCell('B17').value='Questions skipped by choice are blank (not zero). A plotted point requires Q1, Q2 and Q3.';legend.getCell('A18').value='Caution';legend.getCell('B18').value='Ratings indicate subjective statement applicability, not event frequency or percentage. Exploratory only; not causal.';
 const buffer=await w.xlsx.writeBuffer();return new Uint8Array(buffer);
}
