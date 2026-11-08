import ExcelJS from 'exceljs';

const questionNames = ['Family expectations','Financial obligations','Academic evaluation','Avoided asking questions','Presented decision as settled','Delayed requesting feedback','Keeping concern private eased an interaction','Keeping concern private made a task harder','Discussed unfinished idea'];
const nfmt=v=>v==null?'':v;
const zone = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'});
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
function decorateHeader(sheet,last){sheet.getRow(1).height=34;sheet.getRow(1).eachCell({includeEmpty:true},(cell)=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF143432'}};cell.font={bold:true,color:{argb:'FFFFFFFF'},size:11,name:'Georgia'};cell.alignment={vertical:'middle'}});for(let i=1;i<=last;i++)sheet.getColumn(i).width=i===1?19:16;sheet.views=[{state:'frozen',ySplit:1}];}
export async function makeWorkbook(rows,summary){
 const w=new ExcelJS.Workbook();w.creator='THE SEAM';w.subject='Anonymous higher education student pressure survey';w.title='THE SEAM | Live research report';w.created=new Date();
 const overview=w.addWorksheet('Findings Summary',{views:[{state:'frozen',ySplit:2}]});
 overview.mergeCells('A1:F1');overview.getCell('A1').value='THE SEAM  |  FINDINGS REPORT';overview.getCell('A1').font={name:'Georgia',bold:true,size:19,color:{argb:'FFFFFFFF'}};overview.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF143432'}};overview.getRow(1).height=39;
 overview.getColumn('A').width=32;overview.getColumn('B').width=21;overview.getColumn('C').width=19;overview.getColumn('D').width=19;overview.getColumn('E').width=19;overview.getColumn('F').width=19;
 const lines=[['Created (UTC)',new Date().toISOString()],['Completed participants',summary.count],['Mean total pressure (3–12)',nfmt(summary.pressure.mean)],['Median total pressure',nfmt(summary.pressure.median)],['Mean concealment Q4–Q6',nfmt(summary.concealment_mean)],['Pressure/concealment correlation',nfmt(summary.relationship)],['Most frequently top-rated domain',nfmt(summary.highest_mean_pressure)]];
 lines.forEach((line,i)=>{overview.getCell(`A${i+3}`).value=line[0];overview.getCell(`B${i+3}`).value=line[1]});
 overview.getCell('A12').value='QUESTION-LEVEL FINDINGS';overview.getCell('A12').font={bold:true,color:{argb:'FFAC864C'}};
 overview.getRow(13).values=['Measure','Mean','Median','1 • Never','2 • Rarely','3/4 • Sometimes or Often'];
 for(let i=0;i<9;i++){const d=summary.dimensions[i];overview.getRow(14+i).values=[`Q${i+1} · ${d.name}`,nfmt(d.mean),nfmt(d.median),d.counts[0],d.counts[1],nfmt(d.frequent_pct)]}
 overview.getCell('A25').value='Interpretation note';overview.getCell('B25').value=summary.method_note;overview.mergeCells('B25:F26');overview.getCell('B25').alignment={wrapText:true,vertical:'top'};
 overview.getRow(13).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFECE4D5'}};c.font={bold:true,color:{argb:'FF143432'}}});
 overview.getColumn('A').width=43;overview.getColumn('F').width=35;
 const sheet=w.addWorksheet('Anonymous Responses');
 const heads=['Participant ID','Submitted (UTC)','Submitted (Eastern)', ...Array.from({length:9},(_,i)=>`Q${i+1}`),'Pressure total','Pressure mean','Concealment mean','Centroid X','Centroid Y','Height Z'];
 sheet.addRow(heads);decorateHeader(sheet,heads.length);sheet.getColumn(2).width=26;sheet.getColumn(3).width=29;sheet.getColumn(1).width=19;
 rows.forEach((r,k)=>{
  const i=k+2;const a=r.answers;const t=a.slice(0,3).reduce((x,y)=>x+y,0);
  const p=((a[0]-1)/3)*0+((a[1]-1)/3)*(-132)+((a[2]-1)/3)*132;
  const q=((a[0]-1)/3)*150+((a[1]-1)/3)*(-75)+((a[2]-1)/3)*(-75);
  const row=sheet.addRow([r.id,r.created_at,zone.format(new Date(r.created_at)),...a,{formula:`SUM(D${i}:F${i})`,result:t},{formula:`AVERAGE(D${i}:F${i})`,result:t/3},{formula:`AVERAGE(G${i}:I${i})`,result:avg(a.slice(3,6))},{formula:`((-132*(E${i}-1)/3)+(132*(F${i}-1)/3))/3`,result:p/3},{formula:`(150*(D${i}-1)/3-75*(E${i}-1)/3-75*(F${i}-1)/3)/3`,result:q/3},{formula:`(M${i}-3)/9*205`,result:(t-3)/9*205}]);
  row.getCell(1).numFmt='@';
  if(k%2===1)row.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF7F3EC'}});
 });
 if(rows.length){sheet.autoFilter={from:'A1',to:`R${rows.length+1}`};}
 const legend=w.addWorksheet('Question Key');legend.getColumn('A').width=13;legend.getColumn('B').width=72;legend.getColumn('C').width=35;legend.addRow(['Question','Survey measure','Scale']);decorateHeader(legend,3);questionNames.forEach((q,i)=>legend.addRow([`Q${i+1}`,q,'1 Never · 2 Rarely · 3 Sometimes · 4 Often']));legend.getCell('A13').value='IDs';legend.getCell('B13').value='Anonymous three-digit codes (100–999) assigned by the server. Not student IDs.';
 legend.getCell('A15').value='Limit';legend.getCell('B15').value='900 unique participant codes per study. Extend ID digits for larger cohorts.';
 legend.getCell('A17').value='Caution';legend.getCell('B17').value='Exploratory descriptive data only. Does not establish cause and effect.';
 const buffer=await w.xlsx.writeBuffer();return new Uint8Array(buffer);
}
