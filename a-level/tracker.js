/* tracker.js — Core Pure 1 PLC report engine.
   Reads an uploaded PLC workbook (students down column A, skills across the
   top of the "PLC" sheet), scored 1/2/3, and builds an on-screen RAG report
   plus a downloadable PDF. Everything runs in the browser — nothing is
   uploaded to a server. Spec (skills, topics, bands) lives in tracker-data.js. */
(function () {
  "use strict";

  var BANDS = window.PLC_BANDS || {};
  var NOTSEEN = window.PLC_NOTSEEN || { key:"grey", label:"Not seen", color:"#9AA7B4" };
  var SKILLS = window.PLC_SKILLS || [];
  var TOPICS = window.PLC_TOPICS || [];
  var RAG = { green:"#1B998B", amber:"#F4A93F", red:"#C0392B", grey:"#9AA7B4" };

  function bandOf(score) {
    if (score === 1) return "red";
    if (score === 2) return "amber";
    if (score === 3) return "green";
    return "grey";
  }
  function pct(n, d) { return d ? Math.round((n / d) * 100) + "%" : "—"; }

  /* ---------- parse workbook ---------- */
  function parseWorkbook(wb) {
    var sheetName = wb.SheetNames.filter(function (n) { return /plc/i.test(n); })[0] || wb.SheetNames[0];
    var ws = wb.Sheets[sheetName];
    var grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

    // find header row containing "Pupil name" in col A
    var hdr = -1;
    for (var i = 0; i < grid.length; i++) {
      if (String(grid[i][0]).trim().toLowerCase() === "pupil name") { hdr = i; break; }
    }
    if (hdr === -1) throw new Error("Couldn't find the 'Pupil name' header. Please upload the Core Pure PLC workbook downloaded from this page.");

    // map each spreadsheet column (from col B, index 1) to a skill by matching the code prefix
    var headerRow = grid[hdr];
    var colSkill = {}; // colIndex -> skill object
    for (var c = 1; c < headerRow.length; c++) {
      var txt = String(headerRow[c] || "").trim();
      if (!txt) continue;
      var codeMatch = txt.match(/^(\d+\.\d+)/);
      if (!codeMatch) continue;
      var code = codeMatch[1];
      var sk = SKILLS.filter(function (s) { return s.code === code; })[0];
      if (sk) colSkill[c] = sk;
    }

    var students = [];
    for (var r = hdr + 1; r < grid.length; r++) {
      var row = grid[r];
      if (!row) continue;
      var name = String(row[0] || "").trim();
      if (!name) continue;
      var scores = {}; // code -> band
      Object.keys(colSkill).forEach(function (ci) {
        var raw = row[ci];
        if (raw === "" || raw === null || raw === undefined) return;
        var v = Number(raw);
        if (v === 1 || v === 2 || v === 3) scores[colSkill[ci].code] = v;
      });
      students.push({ name: name, scores: scores });
    }
    if (!students.length) throw new Error("No pupils found. Type names down column A and score some skills, then upload again.");
    return { students: students };
  }

  /* ---------- analysis ---------- */
  function summarise(scores) {
    var counts = { green:0, amber:0, red:0, grey:0 };
    SKILLS.forEach(function (sk) {
      var v = scores[sk.code];
      counts[bandOf(v)]++;
    });
    return counts;
  }
  function confidence(scores) {
    // proportion of GREEN out of all skills seen; plus avg score
    var seen = 0, sum = 0, green = 0;
    SKILLS.forEach(function (sk) {
      var v = scores[sk.code];
      if (v) { seen++; sum += v; if (v === 3) green++; }
    });
    return { seen: seen, total: SKILLS.length, avg: seen ? sum / seen : null, greenPct: seen ? green / seen : null };
  }
  function topicBreakdown(scores) {
    return TOPICS.map(function (t) {
      var sks = SKILLS.filter(function (s) { return s.topicCode === t.code; });
      var seen = 0, sum = 0;
      sks.forEach(function (s) { var v = scores[s.code]; if (v) { seen++; sum += v; } });
      return { code: t.code, name: t.name, n: sks.length, seen: seen, avg: seen ? sum / seen : null };
    });
  }
  function weakest(scores) {
    var reds = SKILLS.filter(function (s) { return scores[s.code] === 1; });
    return reds.slice(0, 12);
  }
  function classAverages(students) {
    return SKILLS.map(function (sk) {
      var vals = [];
      students.forEach(function (st) { var v = st.scores[sk.code]; if (v) vals.push(v); });
      var avg = vals.length ? vals.reduce(function (a,b){return a+b;},0)/vals.length : null;
      return { code: sk.code, desc: sk.desc, topic: sk.topic, avg: avg, band: avg===null?"grey":(avg>=2.5?"green":avg>=1.5?"amber":"red") };
    });
  }

  /* ---------- donut ---------- */
  function drawDonut(canvas, counts) {
    var ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    var cx=W/2, cy=H/2, rO=Math.min(W,H)/2-3, rI=rO*0.58;
    var total = counts.green+counts.amber+counts.red+counts.grey;
    var order=["green","amber","red","grey"], start=-Math.PI/2;
    if (!total) { ctx.beginPath(); ctx.arc(cx,cy,rO,0,Math.PI*2); ctx.fillStyle="#E4E9EF"; ctx.fill(); }
    else order.forEach(function(k){ var v=counts[k]; if(!v)return; var a=(v/total)*Math.PI*2;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,rO,start,start+a); ctx.closePath();
      ctx.fillStyle=RAG[k]; ctx.fill(); start+=a; });
    ctx.globalCompositeOperation="destination-out"; ctx.beginPath(); ctx.arc(cx,cy,rI,0,Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation="source-over";
    var seen = counts.green+counts.amber+counts.red;
    ctx.fillStyle="#12233A"; ctx.font="700 22px Inter,Arial,sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(total?Math.round((seen/total)*100)+"%":"0%", cx, cy-8);
    ctx.font="600 10px 'Space Mono',monospace"; ctx.fillStyle="#63748A"; ctx.fillText("SEEN", cx, cy+13);
  }

  /* ---------- DOM ---------- */
  function legend(counts) {
    var order=[["green","Confident"],["amber","Partial"],["red","Needs work"],["grey","Not seen"]];
    var total=counts.green+counts.amber+counts.red+counts.grey;
    return '<div class="rag-legend">'+order.map(function(p){
      return '<span class="rag-chip"><i style="background:'+RAG[p[0]]+'"></i>'+p[1]+' '+counts[p[0]]+' ('+pct(counts[p[0]],total)+')</span>';
    }).join("")+'</div>';
  }
  function chipRow(skills, bandColor) {
    if (!skills.length) return '<p class="chip-empty">None</p>';
    return '<div class="chip-grid">'+skills.map(function(s){
      return '<div class="topic-chip" style="border-left:3px solid '+bandColor+'"><span class="chip-code">'+s.code+'</span><span class="chip-desc">'+s.desc+'</span></div>';
    }).join("")+'</div>';
  }

  function renderStudentCard(st, idx) {
    var counts = summarise(st.scores);
    var conf = confidence(st.scores);
    var reds = weakest(st.scores);
    var el = document.createElement("div");
    el.className = "report-card";
    el.innerHTML =
      '<div class="report-card-main">'+
        '<h3>'+st.name+'</h3>'+
        '<div class="box-panel box-panel-red"><h4>Priorities — needs work <span>'+counts.red+'</span></h4>'+chipRow(reds,RAG.red)+'</div>'+
      '</div>'+
      '<div class="report-card-side">'+
        '<canvas class="donut" width="150" height="150" data-role="donut" data-idx="'+idx+'"></canvas>'+
        legend(counts)+
        '<div class="grade-badge-wrap">'+
          '<div class="grade-badge">'+(conf.greenPct!==null?Math.round(conf.greenPct*100)+"%":"—")+'</div>'+
          '<div class="grade-label">Confidence (green)'+(conf.avg!==null?" · avg "+conf.avg.toFixed(1)+"/3":"")+'</div>'+
        '</div>'+
      '</div>';
    return el;
  }

  function renderClassCard(students) {
    var agg = { green:0,amber:0,red:0,grey:0 };
    students.forEach(function(st){ var c=summarise(st.scores); agg.green+=c.green;agg.amber+=c.amber;agg.red+=c.red;agg.grey+=c.grey; });
    var avgs = classAverages(students);
    var weak = avgs.filter(function(a){return a.band==="red";}).slice(0,12);
    var strong = avgs.filter(function(a){return a.band==="green";}).slice(0,12);
    var el=document.createElement("div"); el.className="report-card";
    el.innerHTML=
      '<div class="report-card-main">'+
        '<h3>Whole class</h3>'+
        '<div class="box-panel box-panel-red"><h4>Class needs work <span>'+weak.length+'</span></h4>'+chipRow(weak,RAG.red)+'</div>'+
        '<div class="box-panel box-panel-green"><h4>Class confident <span>'+strong.length+'</span></h4>'+chipRow(strong,RAG.green)+'</div>'+
      '</div>'+
      '<div class="report-card-side">'+
        '<canvas class="donut" width="150" height="150" data-role="class-donut"></canvas>'+
        legend(agg)+
        '<div class="details-panel"><div><strong>'+students.length+'</strong> pupil'+(students.length===1?"":"s")+' in this upload</div></div>'+
      '</div>';
    return { el: el, agg: agg };
  }

  /* ---------- PDF ---------- */
  function buildPDF(students, classDonutUrl, studentDonutUrls) {
    var doc = new window.jspdf.jsPDF({ unit:"pt", format:"a4", orientation:"landscape" });
    var pageW=doc.internal.pageSize.getWidth(), pageH=doc.internal.pageSize.getHeight();
    var margin=36;
    function hexToRgb(h){h=h.replace("#","");return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];}
    function footer(){doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(150,158,170);
      doc.text("Core Pure 1 PLC report · generated locally in your browser", margin, pageH-16);}
    function header(){doc.setFont("helvetica","bold");doc.setFontSize(9);
      var lbl="WINCHMORE MATHS · CORE PURE 1 PLC"; var tw=doc.getStringUnitWidth(lbl)*9/doc.internal.scaleFactor;
      var g=hexToRgb(RAG.green); doc.setFillColor(g[0],g[1],g[2]); doc.roundedRect(pageW-margin-tw-24,margin-14,16,16,4,4,"F");
      doc.setTextColor(255,255,255); doc.setFontSize(10); doc.text("\u03a3",pageW-margin-tw-16,margin-2,{align:"center"});
      doc.setTextColor(18,35,58); doc.setFontSize(9); doc.text(lbl, pageW-margin-tw, margin-3);}

    // class page
    header();
    doc.setFont("helvetica","bold"); doc.setFontSize(19); doc.setTextColor(18,35,58);
    doc.text("Core Pure 1 — Class PLC Report", margin, margin+8);
    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(99,116,138);
    doc.text(new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}), margin, margin+24);
    doc.addImage(classDonutUrl,"PNG",margin,margin+40,140,140);

    var avgs=classAverages(students);
    function bandList(band,title,color,x,y){
      var items=avgs.filter(function(a){return a.band===band;});
      doc.setFont("helvetica","bold"); doc.setFontSize(11); var rgb=hexToRgb(color);
      doc.setTextColor(rgb[0],rgb[1],rgb[2]); doc.text(title+" ("+items.length+")",x,y); y+=14;
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(40,50,65);
      items.slice(0,18).forEach(function(a){ var line=a.code+"  "+a.desc; line=doc.splitTextToSize(line,300)[0];
        doc.text(line,x,y); y+=12; });
      return y;
    }
    var cx=margin+170;
    bandList("red","Class needs work",RAG.red,cx,margin+56);
    bandList("green","Class confident",RAG.green,cx+300,margin+56);
    footer();

    // per student
    students.forEach(function(st,idx){
      doc.addPage("a4","landscape"); header();
      doc.setFont("helvetica","bold"); doc.setFontSize(20); doc.setTextColor(18,35,58);
      doc.text(st.name||"(unnamed)", margin, margin+10);
      doc.addImage(studentDonutUrls[idx],"PNG",margin,margin+26,140,140);
      var conf=confidence(st.scores);
      doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(27,153,139);
      doc.text((conf.greenPct!==null?Math.round(conf.greenPct*100)+"% green":"—")+(conf.avg!==null?"   ·   avg "+conf.avg.toFixed(1)+"/3":""), margin, margin+184);

      var bd=topicBreakdown(st.scores);
      var x=margin+180, y=margin+40;
      doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(18,35,58);
      doc.text("Confidence by topic", x, y); y+=16;
      bd.forEach(function(t){
        var rgb=hexToRgb(t.avg===null?RAG.grey:(t.avg>=2.5?RAG.green:t.avg>=1.5?RAG.amber:RAG.red));
        doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.rect(x,y-8,10,10,"F");
        doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(40,50,65);
        doc.text(t.code+"  "+t.name+"   "+(t.avg===null?"not seen":t.avg.toFixed(1)+"/3"+"  ("+t.seen+"/"+t.n+")"), x+16, y);
        y+=16;
      });
      footer();
    });
    doc.save("Core Pure 1 PLC Report.pdf");
  }

  /* ---------- wiring ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    var dz=document.getElementById("dropzone"), fi=document.getElementById("file-input"),
        status=document.getElementById("tool-status"), preview=document.getElementById("report-preview"),
        classCard=document.getElementById("class-summary-card"), studentCards=document.getElementById("student-cards"),
        dlBtn=document.getElementById("download-pdf");
    if (!dz) return;
    dz.addEventListener("click",function(){fi.click();});
    dz.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" ")fi.click();});
    ["dragover","dragenter"].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.add("dragover");});});
    ["dragleave","drop"].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.remove("dragover");});});
    dz.addEventListener("drop",function(e){if(e.dataTransfer.files&&e.dataTransfer.files.length)handle(e.dataTransfer.files[0]);});
    fi.addEventListener("change",function(e){if(e.target.files&&e.target.files.length)handle(e.target.files[0]);});

    function setStatus(m,cls){status.textContent=m||"";status.className="tool-status"+(cls?" "+cls:"");}

    function handle(file){
      setStatus("Reading "+file.name+"\u2026"); preview.hidden=true;
      var reader=new FileReader();
      reader.onload=function(e){
        try{
          var wb=XLSX.read(new Uint8Array(e.target.result),{type:"array",cellDates:false});
          var data=parseWorkbook(wb);
          render(data);
          setStatus("Loaded "+data.students.length+" pupil(s). Report ready below.","ok");
        }catch(err){ setStatus(err.message||"Couldn't read that file.","err"); }
      };
      reader.onerror=function(){setStatus("Couldn't read that file — please try again.","err");};
      reader.readAsArrayBuffer(file);
    }

    function render(data){
      classCard.innerHTML=""; studentCards.innerHTML="";
      var cls=renderClassCard(data.students); classCard.appendChild(cls.el);
      data.students.forEach(function(st,idx){ studentCards.appendChild(renderStudentCard(st,idx)); });
      preview.hidden=false;

      var classDonut=classCard.querySelector('[data-role="class-donut"]');
      drawDonut(classDonut, cls.agg);
      var donuts=studentCards.querySelectorAll('[data-role="donut"]');
      data.students.forEach(function(st,idx){ drawDonut(donuts[idx], summarise(st.scores)); });

      dlBtn.onclick=function(){
        setStatus("Building PDF\u2026");
        setTimeout(function(){
          try{
            var cu=classDonut.toDataURL("image/png"), su=[];
            donuts.forEach(function(c){su.push(c.toDataURL("image/png"));});
            buildPDF(data.students, cu, su);
            setStatus("PDF downloaded.","ok");
          }catch(err){ setStatus("Couldn't build the PDF: "+err.message,"err"); }
        },30);
      };
    }
  });
})();
