/* tracker.js — A level PLC tracker report engine (multi-spec, multi-tab).
   Each workbook has a "Class list" tab plus one tab per chapter. Skills run
   across each chapter tab; pupils down column A. Scores 1/2/3. Builds an
   on-screen RAG report + downloadable PDF, entirely in the browser.
   The page sets window.TRACKER_KEY to choose which spec applies. */
(function () {
  "use strict";

  var TRACKERS = window.TRACKERS || {};
  var RAG = { green:"#1B998B", amber:"#F4A93F", red:"#C0392B", grey:"#9AA7B4" };

  function spec() {
    var key = window.TRACKER_KEY;
    return TRACKERS[key] || null;
  }
  function bandOf(v){ return v===1?"red":v===2?"amber":v===3?"green":"grey"; }
  function pct(n,d){ return d?Math.round(n/d*100)+"%":"—"; }

  /* ---------- parse multi-tab workbook ---------- */
  function parseWorkbook(wb) {
    var sp = spec();
    if (!sp) throw new Error("No spec configured for this page.");
    var SKILLS = sp.skills;

    // 1) read names from "Class list" tab (col B, from the 'Pupil name' header)
    var clName = wb.SheetNames.filter(function(n){return /class\s*list/i.test(n);})[0];
    var names = [];
    if (clName) {
      var cl = XLSX.utils.sheet_to_json(wb.Sheets[clName],{header:1,raw:true,defval:""});
      var h=-1;
      for (var i=0;i<cl.length;i++){ if(String(cl[i][1]||"").trim().toLowerCase()==="pupil name"){h=i;break;} }
      if (h>-1) for (var r=h+1;r<cl.length;r++){ var nm=String(cl[r][1]||"").trim(); if(nm) names.push(nm); }
    }

    // 2) for each chapter sheet, map columns -> skill codes, read scores per row
    var scoresByName = {}; // name -> {code: v}
    function ensure(n){ if(!scoresByName[n]) scoresByName[n]={}; return scoresByName[n]; }

    wb.SheetNames.forEach(function(sn){
      if (/class\s*list/i.test(sn)) return;
      var grid = XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:""});
      var hdr=-1;
      for (var i=0;i<grid.length;i++){ if(String(grid[i][0]||"").trim().toLowerCase()==="pupil name"){hdr=i;break;} }
      if (hdr===-1) return;
      var colCode={};
      var hrow=grid[hdr];
      for (var c=1;c<hrow.length;c++){
        var m=String(hrow[c]||"").trim().match(/^(\d+\.\d+)/);
        if(!m) continue;
        if (SKILLS.some(function(s){return s.code===m[1];})) colCode[c]=m[1];
      }
      // Match rows to pupils by POSITION (row hdr+1 = names[0], etc.).
      // Names on chapter tabs are live formulas pulling from Class list, which
      // may not have a cached value when read here — so we index by row order.
      var pos = 0;
      for (var r=hdr+1;r<grid.length;r++){
        var row=grid[r]; if(!row) continue;
        // stop if this row has neither a name nor any score (end of table)
        var hasAny = false;
        for (var k=1;k<row.length;k++){ if(row[k]!=="" && row[k]!=null){ hasAny=true; break; } }
        var nmCell=String(row[0]||"").trim();
        if(!nmCell && !hasAny) continue;
        var nm = nmCell || names[pos] || null;
        pos++;
        if(!nm) continue;
        var bag=ensure(nm);
        Object.keys(colCode).forEach(function(ci){
          var v=Number(row[ci]);
          if(v===1||v===2||v===3) bag[colCode[ci]]=v;
        });
      }
    });

    // 3) assemble student list — prefer Class list order, then any extras found
    var order = names.slice();
    Object.keys(scoresByName).forEach(function(n){ if(order.indexOf(n)===-1) order.push(n); });
    var students = order.map(function(n){ return { name:n, scores: scoresByName[n]||{} }; });
    if (!students.length) throw new Error("No pupils found. Add names on the Class list tab and score some skills.");

    return { students: students, skills: SKILLS, topics: sp.topics, title: sp.title };
  }

  /* ---------- analysis ---------- */
  function summarise(scores, SKILLS){ var c={green:0,amber:0,red:0,grey:0}; SKILLS.forEach(function(s){c[bandOf(scores[s.code])]++;}); return c; }
  function confidence(scores, SKILLS){ var seen=0,sum=0,green=0; SKILLS.forEach(function(s){var v=scores[s.code]; if(v){seen++;sum+=v;if(v===3)green++;}}); return {seen:seen,total:SKILLS.length,avg:seen?sum/seen:null,greenPct:seen?green/seen:null}; }
  function topicBreakdown(scores, SKILLS, TOPICS){ return TOPICS.map(function(t){ var sks=SKILLS.filter(function(s){return s.topicCode===t.code;}); var seen=0,sum=0; sks.forEach(function(s){var v=scores[s.code]; if(v){seen++;sum+=v;}}); return {code:t.code,name:t.name,n:sks.length,seen:seen,avg:seen?sum/seen:null}; }); }
  function weakest(scores, SKILLS){ return SKILLS.filter(function(s){return scores[s.code]===1;}).slice(0,14); }
  function classAverages(students, SKILLS){ return SKILLS.map(function(sk){ var vals=[]; students.forEach(function(st){var v=st.scores[sk.code]; if(v)vals.push(v);}); var avg=vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:null; return {code:sk.code,desc:sk.desc,topic:sk.topic,avg:avg,band:avg===null?"grey":(avg>=2.5?"green":avg>=1.5?"amber":"red")}; }); }

  /* ---------- donut ---------- */
  function drawDonut(canvas, counts){
    var ctx=canvas.getContext("2d"),W=canvas.width,H=canvas.height; ctx.clearRect(0,0,W,H);
    var cx=W/2,cy=H/2,rO=Math.min(W,H)/2-3,rI=rO*0.58;
    var total=counts.green+counts.amber+counts.red+counts.grey, start=-Math.PI/2;
    if(!total){ctx.beginPath();ctx.arc(cx,cy,rO,0,Math.PI*2);ctx.fillStyle="#E4E9EF";ctx.fill();}
    else ["green","amber","red","grey"].forEach(function(k){var v=counts[k];if(!v)return;var a=v/total*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,rO,start,start+a);ctx.closePath();ctx.fillStyle=RAG[k];ctx.fill();start+=a;});
    ctx.globalCompositeOperation="destination-out";ctx.beginPath();ctx.arc(cx,cy,rI,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation="source-over";
    var seen=counts.green+counts.amber+counts.red;
    ctx.fillStyle="#12233A";ctx.font="700 22px Inter,Arial,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(total?Math.round(seen/total*100)+"%":"0%",cx,cy-8);
    ctx.font="600 10px 'Space Mono',monospace";ctx.fillStyle="#63748A";ctx.fillText("SEEN",cx,cy+13);
  }

  /* ---------- DOM ---------- */
  function legend(counts){ var order=[["green","Confident"],["amber","Partial"],["red","Needs work"],["grey","Not seen"]]; var total=counts.green+counts.amber+counts.red+counts.grey;
    return '<div class="rag-legend">'+order.map(function(p){return '<span class="rag-chip"><i style="background:'+RAG[p[0]]+'"></i>'+p[1]+' '+counts[p[0]]+' ('+pct(counts[p[0]],total)+')</span>';}).join("")+'</div>'; }
  function chipRow(skills,color){ if(!skills.length)return '<p class="chip-empty">None</p>';
    return '<div class="chip-grid">'+skills.map(function(s){return '<div class="topic-chip" style="border-left:3px solid '+color+'"><span class="chip-code">'+s.code+'</span><span class="chip-desc">'+s.desc+'</span></div>';}).join("")+'</div>'; }

  function renderStudentCard(st,idx,SKILLS){
    var counts=summarise(st.scores,SKILLS), conf=confidence(st.scores,SKILLS), reds=weakest(st.scores,SKILLS);
    var el=document.createElement("div"); el.className="report-card";
    el.innerHTML='<div class="report-card-main"><h3>'+st.name+'</h3>'+
      '<div class="box-panel box-panel-red"><h4>Priorities — needs work <span>'+counts.red+'</span></h4>'+chipRow(reds,RAG.red)+'</div></div>'+
      '<div class="report-card-side"><canvas class="donut" width="150" height="150" data-role="donut" data-idx="'+idx+'"></canvas>'+legend(counts)+
      '<div class="grade-badge-wrap"><div class="grade-badge">'+(conf.greenPct!==null?Math.round(conf.greenPct*100)+"%":"—")+'</div>'+
      '<div class="grade-label">Confidence (green)'+(conf.avg!==null?" · avg "+conf.avg.toFixed(1)+"/3":"")+'</div></div></div>';
    return el;
  }
  function renderClassCard(students,SKILLS){
    var agg={green:0,amber:0,red:0,grey:0}; students.forEach(function(st){var c=summarise(st.scores,SKILLS);agg.green+=c.green;agg.amber+=c.amber;agg.red+=c.red;agg.grey+=c.grey;});
    var avgs=classAverages(students,SKILLS); var weak=avgs.filter(function(a){return a.band==="red";}).slice(0,14); var strong=avgs.filter(function(a){return a.band==="green";}).slice(0,14);
    var el=document.createElement("div"); el.className="report-card";
    el.innerHTML='<div class="report-card-main"><h3>Whole class</h3>'+
      '<div class="box-panel box-panel-red"><h4>Class needs work <span>'+weak.length+'</span></h4>'+chipRow(weak,RAG.red)+'</div>'+
      '<div class="box-panel box-panel-green"><h4>Class confident <span>'+strong.length+'</span></h4>'+chipRow(strong,RAG.green)+'</div></div>'+
      '<div class="report-card-side"><canvas class="donut" width="150" height="150" data-role="class-donut"></canvas>'+legend(agg)+
      '<div class="details-panel"><div><strong>'+students.length+'</strong> pupil'+(students.length===1?"":"s")+'</div></div></div>';
    return {el:el,agg:agg};
  }

  /* ---------- PDF ---------- */
  function buildPDF(data, classUrl, studentUrls){
    var SKILLS=data.skills, TOPICS=data.topics, students=data.students;
    var doc=new window.jspdf.jsPDF({unit:"pt",format:"a4",orientation:"landscape"});
    var pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight(),margin=36;
    function rgb(h){h=h.replace("#","");return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];}
    function foot(){doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(150,158,170);doc.text(data.title+" PLC report · generated locally in your browser",margin,pageH-16);}
    function head(){doc.setFont("helvetica","bold");doc.setFontSize(9);var lbl="WINCHMORE MATHS";var tw=doc.getStringUnitWidth(lbl)*9/doc.internal.scaleFactor;doc.setTextColor(18,35,58);doc.text(lbl,pageW-margin-tw,margin-3);}
    head();
    doc.setFont("helvetica","bold");doc.setFontSize(18);doc.setTextColor(18,35,58);doc.text(data.title+" — Class PLC Report",margin,margin+8);
    doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(99,116,138);doc.text(new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}),margin,margin+24);
    doc.addImage(classUrl,"PNG",margin,margin+40,140,140);
    var avgs=classAverages(students,SKILLS);
    function bandList(band,title,color,x,y){var items=avgs.filter(function(a){return a.band===band;});doc.setFont("helvetica","bold");doc.setFontSize(11);var c=rgb(color);doc.setTextColor(c[0],c[1],c[2]);doc.text(title+" ("+items.length+")",x,y);y+=14;doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(40,50,65);items.slice(0,20).forEach(function(a){doc.text(doc.splitTextToSize(a.code+"  "+a.desc,290)[0],x,y);y+=12;});return y;}
    bandList("red","Class needs work",RAG.red,margin+170,margin+56);
    bandList("green","Class confident",RAG.green,margin+470,margin+56);
    foot();
    students.forEach(function(st,idx){
      doc.addPage("a4","landscape");head();
      doc.setFont("helvetica","bold");doc.setFontSize(20);doc.setTextColor(18,35,58);doc.text(st.name||"(unnamed)",margin,margin+10);
      doc.addImage(studentUrls[idx],"PNG",margin,margin+26,140,140);
      var conf=confidence(st.scores,SKILLS);
      doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(27,153,139);
      doc.text((conf.greenPct!==null?Math.round(conf.greenPct*100)+"% green":"—")+(conf.avg!==null?"   ·   avg "+conf.avg.toFixed(1)+"/3":""),margin,margin+184);
      var bd=topicBreakdown(st.scores,SKILLS,TOPICS),x=margin+180,y=margin+40;
      doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(18,35,58);doc.text("Confidence by chapter",x,y);y+=16;
      bd.forEach(function(t){var c=rgb(t.avg===null?RAG.grey:(t.avg>=2.5?RAG.green:t.avg>=1.5?RAG.amber:RAG.red));doc.setFillColor(c[0],c[1],c[2]);doc.rect(x,y-8,10,10,"F");doc.setFont("helvetica","normal");doc.setFontSize(9.5);doc.setTextColor(40,50,65);doc.text(t.code+"  "+t.name+"   "+(t.avg===null?"not seen":t.avg.toFixed(1)+"/3  ("+t.seen+"/"+t.n+")"),x+16,y);y+=15;});
      foot();
    });
    doc.save(data.title.replace(/[^\w]+/g,"_")+"_PLC_Report.pdf");
  }

  /* ---------- wiring ---------- */
  document.addEventListener("DOMContentLoaded",function(){
    var dz=document.getElementById("dropzone"),fi=document.getElementById("file-input"),status=document.getElementById("tool-status"),
        preview=document.getElementById("report-preview"),classCard=document.getElementById("class-summary-card"),
        studentCards=document.getElementById("student-cards"),dlBtn=document.getElementById("download-pdf");
    if(!dz)return;
    dz.addEventListener("click",function(){fi.click();});
    dz.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" ")fi.click();});
    ["dragover","dragenter"].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.add("dragover");});});
    ["dragleave","drop"].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.remove("dragover");});});
    dz.addEventListener("drop",function(e){if(e.dataTransfer.files&&e.dataTransfer.files.length)handle(e.dataTransfer.files[0]);});
    fi.addEventListener("change",function(e){if(e.target.files&&e.target.files.length)handle(e.target.files[0]);});
    function setStatus(m,cls){status.textContent=m||"";status.className="tool-status"+(cls?" "+cls:"");}
    function handle(file){
      setStatus("Reading "+file.name+"\u2026");preview.hidden=true;
      var reader=new FileReader();
      reader.onload=function(e){try{var wb=XLSX.read(new Uint8Array(e.target.result),{type:"array"});var data=parseWorkbook(wb);render(data);setStatus("Loaded "+data.students.length+" pupil(s). Report ready below.","ok");}catch(err){setStatus(err.message||"Couldn't read that file.","err");}};
      reader.onerror=function(){setStatus("Couldn't read that file — please try again.","err");};
      reader.readAsArrayBuffer(file);
    }
    function render(data){
      classCard.innerHTML="";studentCards.innerHTML="";
      var cls=renderClassCard(data.students,data.skills);classCard.appendChild(cls.el);
      data.students.forEach(function(st,idx){studentCards.appendChild(renderStudentCard(st,idx,data.skills));});
      preview.hidden=false;
      var classDonut=classCard.querySelector('[data-role="class-donut"]');drawDonut(classDonut,cls.agg);
      var donuts=studentCards.querySelectorAll('[data-role="donut"]');
      data.students.forEach(function(st,idx){drawDonut(donuts[idx],summarise(st.scores,data.skills));});
      dlBtn.onclick=function(){setStatus("Building PDF\u2026");setTimeout(function(){try{var cu=classDonut.toDataURL("image/png"),su=[];donuts.forEach(function(c){su.push(c.toDataURL("image/png"));});buildPDF(data,cu,su);setStatus("PDF downloaded.","ok");}catch(err){setStatus("Couldn't build the PDF: "+err.message,"err");}},30);};
    }
  });
})();
