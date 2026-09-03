/* tracker.js — A level PLC report engine (multi-spec).
   Accepts EITHER the styled .xlsx tracker (Class list + chapter tabs, pupils
   down col A) OR a Google Form responses CSV (one row per pupil, one column
   per skill, headers prefixed with the skill code e.g. "1.1 ...").
   Scores 1/2/3. Builds on-screen report + PDF, all in the browser.
   Report sections per pupil: donut+legend+overall confidence, Confidence by
   chapter, Top-10 green, Priorities (red), Partial (amber).
   window.TRACKER_KEY selects the course. */
(function () {
  "use strict";
  var TRACKERS = window.TRACKERS || {};
  var RAG = { green:"#1B998B", amber:"#F4A93F", red:"#C0392B", grey:"#9AA7B4" };

  function spec(){ return TRACKERS[window.TRACKER_KEY] || null; }
  function bandOf(v){ return v===1?"red":v===2?"amber":v===3?"green":"grey"; }
  function pct(n,d){ return d?Math.round(n/d*100)+"%":"—"; }

  /* ---------- parse .xlsx (multi-tab) ---------- */
  function parseXlsx(wb, SKILLS){
    var clName = wb.SheetNames.filter(function(n){return /class\s*list/i.test(n);})[0];
    var names=[];
    if (clName){
      var cl=XLSX.utils.sheet_to_json(wb.Sheets[clName],{header:1,raw:true,defval:""});
      var h=-1; for(var i=0;i<cl.length;i++){ if(String(cl[i][1]||"").trim().toLowerCase()==="pupil name"){h=i;break;} }
      if(h>-1) for(var r=h+1;r<cl.length;r++){ var nm=String(cl[r][1]||"").trim(); if(nm) names.push(nm); }
    }
    var byName={};
    function ensure(n){ if(!byName[n])byName[n]={}; return byName[n]; }
    wb.SheetNames.forEach(function(sn){
      if(/class\s*list/i.test(sn)) return;
      var grid=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:""});
      var hdr=-1; for(var i=0;i<grid.length;i++){ if(String(grid[i][0]||"").trim().toLowerCase()==="pupil name"){hdr=i;break;} }
      if(hdr===-1) return;
      var colCode={}; var hrow=grid[hdr];
      for(var c=1;c<hrow.length;c++){ var m=String(hrow[c]||"").trim().match(/^(\d+\.\d+)/); if(m && SKILLS.some(function(s){return s.code===m[1];})) colCode[c]=m[1]; }
      var pos=0;
      for(var r=hdr+1;r<grid.length;r++){
        var row=grid[r]; if(!row) continue;
        var hasAny=false; for(var k=1;k<row.length;k++){ if(row[k]!=="" && row[k]!=null){hasAny=true;break;} }
        var nmCell=String(row[0]||"").trim();
        if(!nmCell && !hasAny) continue;
        var nm=nmCell||names[pos]||null; pos++;
        if(!nm) continue;
        var bag=ensure(nm);
        Object.keys(colCode).forEach(function(ci){ var v=Number(row[ci]); if(v===1||v===2||v===3) bag[colCode[ci]]=v; });
      }
    });
    var order=names.slice(); Object.keys(byName).forEach(function(n){ if(order.indexOf(n)===-1) order.push(n); });
    return order.map(function(n){ return {name:n,scores:byName[n]||{}}; });
  }

  /* ---------- parse CSV (Google Form responses) ---------- */
  function parseCsv(text, SKILLS){
    var rows=csvRows(text);
    if(!rows.length) throw new Error("The CSV looks empty.");
    var header=rows[0];
    // map each column to a skill code where the header starts with n.n
    var colCode={}, nameCol=-1, emailCol=-1;
    header.forEach(function(h,idx){
      var t=String(h||"").trim();
      var m=t.match(/(\d+\.\d+)/);
      if(m && SKILLS.some(function(s){return s.code===m[1];})){ colCode[idx]=m[1]; return; }
      var low=t.toLowerCase();
      if(nameCol===-1 && /(name|pupil|student)/.test(low) && !/user|file/.test(low)) nameCol=idx;
      if(emailCol===-1 && /e-?mail/.test(low)) emailCol=idx;
    });
    if(Object.keys(colCode).length===0) throw new Error("Couldn't find skill columns. The Form questions must start with the skill code, e.g. \"1.1 ...\".");
    var students=[];
    for(var r=1;r<rows.length;r++){
      var row=rows[r]; if(!row || !row.length) continue;
      var nm = nameCol>-1 ? String(row[nameCol]||"").trim() : "";
      if(!nm && emailCol>-1) nm = String(row[emailCol]||"").trim();
      if(!nm) nm = "Response "+r;
      var scores={};
      Object.keys(colCode).forEach(function(ci){
        var raw=String(row[ci]||"").trim();
        if(!raw) return;
        var m=raw.match(/[123]/); // accept "3", "3 – Confident", etc.
        if(m){ var v=Number(m[0]); if(v>=1&&v<=3) scores[colCode[ci]]=v; }
      });
      // keep only rows that actually answered something
      if(Object.keys(scores).length) students.push({name:nm,scores:scores});
    }
    if(!students.length) throw new Error("No scored responses found in the CSV.");
    return students;
  }
  // minimal RFC-4180-ish CSV parser (handles quotes, commas, newlines)
  function csvRows(text){
    var rows=[], row=[], cur="", i=0, inQ=false, ch;
    text=text.replace(/\r\n/g,"\n").replace(/\r/g,"\n");
    while(i<text.length){
      ch=text[i];
      if(inQ){
        if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else inQ=false; }
        else cur+=ch;
      } else {
        if(ch==='"') inQ=true;
        else if(ch===","){ row.push(cur); cur=""; }
        else if(ch==="\n"){ row.push(cur); rows.push(row); row=[]; cur=""; }
        else cur+=ch;
      }
      i++;
    }
    if(cur.length||row.length){ row.push(cur); rows.push(row); }
    return rows.filter(function(r){ return r.some(function(c){return String(c).trim()!=="";}); });
  }

  /* ---------- analysis ---------- */
  function summarise(sc,SK){ var c={green:0,amber:0,red:0,grey:0}; SK.forEach(function(s){c[bandOf(sc[s.code])]++;}); return c; }
  function confidence(sc,SK){ var seen=0,sum=0,green=0; SK.forEach(function(s){var v=sc[s.code]; if(v){seen++;sum+=v;if(v===3)green++;}}); return {seen:seen,total:SK.length,avg:seen?sum/seen:null,greenPct:seen?green/seen:null}; }
  function topicBreakdown(sc,SK,TOP){ return TOP.map(function(t){ var sks=SK.filter(function(s){return s.topicCode===t.code;}); var seen=0,sum=0; sks.forEach(function(s){var v=sc[s.code]; if(v){seen++;sum+=v;}}); return {code:t.code,name:t.name,n:sks.length,seen:seen,avg:seen?sum/seen:null}; }); }
  function skillsByBand(sc,SK,band,limit){ var out=SK.filter(function(s){return bandOf(sc[s.code])===band;}); return limit?out.slice(0,limit):out; }
  function classAverages(students,SK){ return SK.map(function(sk){ var vals=[]; students.forEach(function(st){var v=st.scores[sk.code]; if(v)vals.push(v);}); var avg=vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:null; return {code:sk.code,desc:sk.desc,topic:sk.topic,avg:avg,band:avg===null?"grey":(avg>=2.5?"green":avg>=1.5?"amber":"red")}; }); }

  /* ---------- donut ---------- */
  function drawDonut(cv,counts){
    var ctx=cv.getContext("2d"),W=cv.width,H=cv.height; ctx.clearRect(0,0,W,H);
    var cx=W/2,cy=H/2,rO=Math.min(W,H)/2-3,rI=rO*0.58;
    var total=counts.green+counts.amber+counts.red+counts.grey,start=-Math.PI/2;
    if(!total){ctx.beginPath();ctx.arc(cx,cy,rO,0,Math.PI*2);ctx.fillStyle="#E4E9EF";ctx.fill();}
    else ["green","amber","red","grey"].forEach(function(k){var v=counts[k];if(!v)return;var a=v/total*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,rO,start,start+a);ctx.closePath();ctx.fillStyle=RAG[k];ctx.fill();start+=a;});
    ctx.globalCompositeOperation="destination-out";ctx.beginPath();ctx.arc(cx,cy,rI,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation="source-over";
    var seen=counts.green+counts.amber+counts.red;
    ctx.fillStyle="#12233A";ctx.font="700 22px Inter,Arial,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(total?Math.round(seen/total*100)+"%":"0%",cx,cy-8);
    ctx.font="600 10px 'Space Mono',monospace";ctx.fillStyle="#63748A";ctx.fillText("SEEN",cx,cy+13);
  }

  /* ---------- DOM helpers ---------- */
  function legend(counts){ var order=[["green","Confident"],["amber","Partial"],["red","Needs work"],["grey","Not seen"]]; var total=counts.green+counts.amber+counts.red+counts.grey;
    return '<div class="rag-legend">'+order.map(function(p){return '<span class="rag-chip"><i style="background:'+RAG[p[0]]+'"></i>'+p[1]+' '+counts[p[0]]+' ('+pct(counts[p[0]],total)+')</span>';}).join("")+'</div>'; }
  function chips(list,color){ if(!list.length) return '<p class="chip-empty">None yet</p>';
    return '<div class="chip-grid">'+list.map(function(s){return '<div class="topic-chip" style="border-left:3px solid '+color+'"><span class="chip-code">'+s.code+'</span><span class="chip-desc">'+s.desc+'</span></div>';}).join("")+'</div>'; }
  function chapterBars(bd){
    return '<div class="chapter-list">'+bd.map(function(t){
      var col = t.avg===null?RAG.grey:(t.avg>=2.5?RAG.green:t.avg>=1.5?RAG.amber:RAG.red);
      var w = t.avg===null?0:Math.round((t.avg/3)*100);
      var label = t.avg===null?"Not seen":t.avg.toFixed(1)+"/3";
      return '<div class="chapter-row">'+
        '<div class="chapter-name"><span class="chip-code">'+t.code+'</span> '+t.name+'</div>'+
        '<div class="chapter-bar"><div class="chapter-fill" style="width:'+w+'%;background:'+col+'"></div></div>'+
        '<div class="chapter-val" style="color:'+col+'">'+label+'</div>'+
      '</div>';
    }).join("")+'</div>';
  }

  function studentCard(st,idx,sp){
    var SK=sp.skills, TOP=sp.topics;
    var counts=summarise(st.scores,SK), conf=confidence(st.scores,SK);
    var bd=topicBreakdown(st.scores,SK,TOP);
    var green=skillsByBand(st.scores,SK,"green",10);
    var red=skillsByBand(st.scores,SK,"red");
    var amber=skillsByBand(st.scores,SK,"amber");
    var logo = sp.logo ? '<img class="course-logo" src="'+sp.logo+'" alt="">' : '';
    var el=document.createElement("div"); el.className="report-card";
    el.innerHTML=
      '<div class="report-card-head">'+logo+
        '<div><h3>'+st.name+'</h3><p class="rc-sub">'+(sp.year?sp.year+' · ':'')+sp.title+'</p></div>'+
      '</div>'+
      '<div class="report-card-top">'+
        '<div class="rc-donut"><canvas class="donut" width="150" height="150" data-role="donut" data-idx="'+idx+'"></canvas>'+
          legend(counts)+
          '<div class="grade-badge-wrap"><div class="grade-badge">'+(conf.greenPct!==null?Math.round(conf.greenPct*100)+"%":"—")+'</div>'+
          '<div class="grade-label">Overall confidence'+(conf.avg!==null?" · avg "+conf.avg.toFixed(1)+"/3":"")+'<br>'+conf.seen+' of '+conf.total+' skills seen</div></div>'+
        '</div>'+
        '<div class="rc-chapters"><h4 class="sec-title">Confidence by chapter</h4>'+chapterBars(bd)+'</div>'+
      '</div>'+
      '<div class="sec-grid">'+
        '<div class="box-panel box-panel-green"><h4>Top green skills <span>'+green.length+'</span></h4>'+chips(green,RAG.green)+'</div>'+
        '<div class="box-panel box-panel-red"><h4>Priorities — needs work <span>'+red.length+'</span></h4>'+chips(red,RAG.red)+'</div>'+
        '<div class="box-panel box-panel-amber"><h4>Partial — nearly there <span>'+amber.length+'</span></h4>'+chips(amber,RAG.amber)+'</div>'+
      '</div>';
    return el;
  }

  function classCard(students,sp){
    var SK=sp.skills;
    var agg={green:0,amber:0,red:0,grey:0};
    students.forEach(function(st){var c=summarise(st.scores,SK);agg.green+=c.green;agg.amber+=c.amber;agg.red+=c.red;agg.grey+=c.grey;});
    var avgs=classAverages(students,SK);
    var weak=avgs.filter(function(a){return a.band==="red";}).slice(0,12);
    var strong=avgs.filter(function(a){return a.band==="green";}).slice(0,12);
    var bd=(function(){ // class chapter breakdown = average of per-topic averages
      return sp.topics.map(function(t){
        var sks=SK.filter(function(s){return s.topicCode===t.code;});
        var vals=[]; students.forEach(function(st){ sks.forEach(function(s){var v=st.scores[s.code]; if(v)vals.push(v);}); });
        var avg=vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:null;
        return {code:t.code,name:t.name,n:sks.length,seen:vals.length,avg:avg};
      });
    })();
    var el=document.createElement("div"); el.className="report-card";
    el.innerHTML=
      '<div class="report-card-head"><div><h3>Whole class</h3><p class="rc-sub">'+students.length+' pupil'+(students.length===1?"":"s")+' · '+(sp.year?sp.year+' · ':'')+sp.title+'</p></div></div>'+
      '<div class="report-card-top">'+
        '<div class="rc-donut"><canvas class="donut" width="150" height="150" data-role="class-donut"></canvas>'+legend(agg)+'</div>'+
        '<div class="rc-chapters"><h4 class="sec-title">Class confidence by chapter</h4>'+chapterBars(bd)+'</div>'+
      '</div>'+
      '<div class="sec-grid">'+
        '<div class="box-panel box-panel-green"><h4>Class strengths <span>'+strong.length+'</span></h4>'+chips(strong,RAG.green)+'</div>'+
        '<div class="box-panel box-panel-red"><h4>Class priorities <span>'+weak.length+'</span></h4>'+chips(weak,RAG.red)+'</div>'+
      '</div>';
    return {el:el,agg:agg};
  }

  /* ---------- PDF ---------- */
  function buildPDF(students,sp,logoImg,classUrl,studentUrls){
    var SK=sp.skills, TOP=sp.topics;
    var doc=new window.jspdf.jsPDF({unit:"pt",format:"a4",orientation:"landscape"});
    var pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight(),M=36;
    function rgb(h){h=h.replace("#","");return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];}
    function foot(){doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(150,158,170);doc.text(sp.title+" · confidence report · generated locally in your browser",M,pageH-16);}
    function logo(x,y,s){ if(logoImg) try{ doc.addImage(logoImg,"PNG",x,y,s,s); }catch(e){} }
    function chapters(bd,x,y,wBar){
      doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(18,35,58);doc.text("Confidence by chapter",x,y);y+=15;
      doc.setFontSize(8.5);
      bd.forEach(function(t){
        var col=rgb(t.avg===null?RAG.grey:(t.avg>=2.5?RAG.green:t.avg>=1.5?RAG.amber:RAG.red));
        doc.setFont("helvetica","normal");doc.setTextColor(40,50,65);
        var label=t.code+"  "+t.name; label=doc.splitTextToSize(label,150)[0];
        doc.text(label,x,y);
        // bar
        var bx=x+160, bw=wBar||120, bh=7;
        doc.setFillColor(233,236,241);doc.rect(bx,y-6,bw,bh,"F");
        if(t.avg!==null){ doc.setFillColor(col[0],col[1],col[2]); doc.rect(bx,y-6,bw*(t.avg/3),bh,"F"); }
        doc.setTextColor(col[0],col[1],col[2]);doc.setFont("helvetica","bold");
        doc.text(t.avg===null?"—":t.avg.toFixed(1)+"/3",bx+bw+8,y);
        y+=14;
      });
      return y;
    }
    function bandCols(sc,x,y){
      function col(title,band,color,cx){
        var items=SK.filter(function(s){return bandOf(sc[s.code])===band;});
        if(band==="green") items=items.slice(0,10);
        var c=rgb(color); doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(c[0],c[1],c[2]);
        doc.text(title+" ("+items.length+")",cx,y);
        var yy=y+13; doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(40,50,65);
        items.slice(0,14).forEach(function(s){ doc.text(doc.splitTextToSize(s.code+"  "+s.desc,150)[0],cx,yy); yy+=11; });
        return yy;
      }
      var y1=col("Top green skills","green",RAG.green,x);
      var y2=col("Priorities — needs work","red",RAG.red,x+175);
      var y3=col("Partial — nearly there","amber",RAG.amber,x+350);
      return Math.max(y1,y2,y3);
    }

    // ---- class page ----
    logo(pageW-M-54,M-16,54);
    doc.setFont("helvetica","bold");doc.setFontSize(18);doc.setTextColor(18,35,58);
    doc.text(sp.title+" — Class Report",M,M+6);
    doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(99,116,138);
    doc.text((sp.year?sp.year+"  ·  ":"")+new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})+"  ·  "+students.length+" pupils",M,M+22);
    doc.addImage(classUrl,"PNG",M,M+34,120,120);
    var cbd=TOP.map(function(t){ var sks=SK.filter(function(s){return s.topicCode===t.code;}); var vals=[]; students.forEach(function(st){sks.forEach(function(s){var v=st.scores[s.code];if(v)vals.push(v);});}); return {code:t.code,name:t.name,avg:vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:null}; });
    chapters(cbd,M+150,M+50,150);
    foot();

    // ---- per pupil ----
    students.forEach(function(st,idx){
      doc.addPage("a4","landscape");
      logo(pageW-M-54,M-16,54);
      doc.setFont("helvetica","bold");doc.setFontSize(18);doc.setTextColor(18,35,58);
      doc.text(st.name||"(unnamed)",M,M+6);
      doc.setFont("helvetica","normal");doc.setFontSize(9.5);doc.setTextColor(99,116,138);
      doc.text((sp.year?sp.year+"  ·  ":"")+sp.title,M,M+21);
      doc.addImage(studentUrls[idx],"PNG",M,M+30,110,110);
      var conf=confidence(st.scores,SK);
      doc.setFont("helvetica","bold");doc.setFontSize(12);doc.setTextColor(27,153,139);
      doc.text((conf.greenPct!==null?Math.round(conf.greenPct*100)+"% confident":"—")+(conf.avg!==null?"  ·  avg "+conf.avg.toFixed(1)+"/3":""),M,M+150);
      doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(99,116,138);
      doc.text(conf.seen+" of "+conf.total+" skills seen",M,M+163);
      var y=chapters(topicBreakdown(st.scores,SK,TOP),M+150,M+40,120);
      var y2=bandCols(st.scores,M,Math.max(y+10,M+190));
      foot();
    });
    doc.save(sp.title.replace(/[^\w]+/g,"_")+"_Report.pdf");
  }

  /* ---------- wiring ---------- */
  document.addEventListener("DOMContentLoaded",function(){
    var dz=document.getElementById("dropzone"),fi=document.getElementById("file-input"),status=document.getElementById("tool-status"),
        preview=document.getElementById("report-preview"),classHost=document.getElementById("class-summary-card"),
        studentHost=document.getElementById("student-cards"),dlBtn=document.getElementById("download-pdf");
    if(!dz) return;
    dz.addEventListener("click",function(){fi.click();});
    dz.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" ")fi.click();});
    ["dragover","dragenter"].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.add("dragover");});});
    ["dragleave","drop"].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.remove("dragover");});});
    dz.addEventListener("drop",function(e){if(e.dataTransfer.files&&e.dataTransfer.files.length)handle(e.dataTransfer.files[0]);});
    fi.addEventListener("change",function(e){if(e.target.files&&e.target.files.length)handle(e.target.files[0]);});
    function setStatus(m,cls){status.textContent=m||"";status.className="tool-status"+(cls?" "+cls:"");}

    function handle(file){
      var sp=spec(); if(!sp){setStatus("No course configured.","err");return;}
      setStatus("Reading "+file.name+"\u2026"); preview.hidden=true;
      var isCsv=/\.csv$/i.test(file.name);
      var reader=new FileReader();
      reader.onload=function(e){
        try{
          var students;
          if(isCsv){ students=parseCsv(e.target.result,sp.skills); }
          else { var wb=XLSX.read(new Uint8Array(e.target.result),{type:"array"}); students=parseXlsx(wb,sp.skills); }
          if(!students.length) throw new Error("No pupils found.");
          render(students,sp);
          setStatus("Loaded "+students.length+" pupil(s) from "+(isCsv?"Google Form CSV":"workbook")+". Report ready below.","ok");
        }catch(err){ setStatus(err.message||"Couldn't read that file.","err"); }
      };
      reader.onerror=function(){setStatus("Couldn't read that file — please try again.","err");};
      if(isCsv) reader.readAsText(file); else reader.readAsArrayBuffer(file);
    }

    function loadLogo(sp,cb){
      if(!sp.logo){ cb(null); return; }
      var img=new Image(); img.crossOrigin="anonymous";
      img.onload=function(){ var cv=document.createElement("canvas"); cv.width=img.width; cv.height=img.height; cv.getContext("2d").drawImage(img,0,0); try{cb(cv.toDataURL("image/png"));}catch(e){cb(null);} };
      img.onerror=function(){cb(null);};
      img.src=sp.logo;
    }

    function render(students,sp){
      classHost.innerHTML=""; studentHost.innerHTML="";
      var cls=classCard(students,sp); classHost.appendChild(cls.el);
      students.forEach(function(st,idx){ studentHost.appendChild(studentCard(st,idx,sp)); });
      preview.hidden=false;
      var classDonut=classHost.querySelector('[data-role="class-donut"]'); drawDonut(classDonut,cls.agg);
      var donuts=studentHost.querySelectorAll('[data-role="donut"]');
      students.forEach(function(st,idx){ drawDonut(donuts[idx],summarise(st.scores,sp.skills)); });
      dlBtn.onclick=function(){
        setStatus("Building PDF\u2026");
        loadLogo(sp,function(logoData){
          setTimeout(function(){
            try{
              var cu=classDonut.toDataURL("image/png"), su=[]; donuts.forEach(function(c){su.push(c.toDataURL("image/png"));});
              buildPDF(students,sp,logoData,cu,su);
              setStatus("PDF downloaded.","ok");
            }catch(err){ setStatus("Couldn't build the PDF: "+err.message,"err"); }
          },30);
        });
      };
    }
  });
})();
