const $=id=>document.getElementById(id);const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const periods=[{name:"1st Period",semester:"first",column:"first"},{name:"2nd Period",semester:"first",column:"second"},{name:"3rd Period",semester:"first",column:"third"},{name:"Exam",semester:"first",column:"exam"},{name:"4th Period",semester:"second",column:"fourth"},{name:"5th Period",semester:"second",column:"fifth"},{name:"6th Period",semester:"second",column:"sixth"},{name:"Exam",semester:"second",column:"second_exam"}];
async function load(){
 try{await vfaSupabase.auth.refreshSession();}catch(err){console.warn("VFA student session refresh failed:",err);}
 const {data:{user},error:ue}=await vfaSupabase.auth.getUser();if(ue||!user){location.href="./";return;}
 const {data:student,error:se}=await vfaSupabase.from("students").select("id,student_code,full_name,class_id,sponsor_id,parent_name,parent_phone,school_year,registration_date,sex,enrollment_status,scholarship,is_active,id_card_data").eq("auth_user_id",user.id).maybeSingle();if(se||!student||!student.is_active){await vfaSupabase.auth.signOut();location.href="./";return;}
 const [{data:cls},{data:sponsor},{data:subjects},{data:grades},{data:finance},{data:feeStructure},{data:exams},{data:assignmentsClass},{data:assignmentsAll},{data:announcementsClass},{data:announcementsAll},{data:suggestions},{data:scaleSettings,error:scaleSettingsError}]=await Promise.all([
  vfaSupabase.from("classes").select("id,name").eq("id",student.class_id).maybeSingle(),
  vfaSupabase.from("staff").select("id,name,position").eq("id",student.sponsor_id).maybeSingle(),
  vfaSupabase.from("subjects").select("id,name").order("name"),
  vfaSupabase.from("grades").select("*" ).eq("student_id",student.id),
  vfaSupabase.from("financial_records").select("id,school_year,record_date,description,amount_paid,amount_due,balance").eq("student_id",student.id).order("record_date"),
  vfaSupabase.from("fee_structures").select("first_payment,second_payment,third_payment,amount_due,school_year").eq("class_id",student.class_id).order("school_year",{ascending:false}),
  vfaSupabase.from("exam_timetable").select("exam_date,start_time,end_time,room,subject_id,class_id").eq("class_id",student.class_id).order("exam_date"),
  vfaSupabase.from("assignments").select("title,description,due_date,subject_id,created_at").eq("class_id",student.class_id).order("created_at",{ascending:false}),
  vfaSupabase.from("assignments").select("title,description,due_date,subject_id,created_at").is("class_id",null).order("created_at",{ascending:false}),
  vfaSupabase.from("announcements").select("title,message,created_at").eq("target_class_id",student.class_id).order("created_at",{ascending:false}),
  vfaSupabase.from("announcements").select("title,message,created_at").is("target_class_id",null).order("created_at",{ascending:false}),
  vfaSupabase.from("admin_suggestions").select("title,message,created_at").eq("student_id",student.id).order("created_at",{ascending:false}),
  vfaSupabase.from("scale_settings").select("statements").eq("id",1).maybeSingle()
 ]);
 const subById=Object.fromEntries((subjects||[]).map(x=>[x.id,x.name]));
 const assignments=[...(assignmentsClass||[]),...(assignmentsAll||[])].sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")));
 const announcements=[...(announcementsClass||[]),...(announcementsAll||[])].sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")));
 const fresh={dbId:student.id,id:student.student_code,name:student.full_name,grade:cls?.name||"",schoolYear:student.school_year||"",registrationDate:student.registration_date||"",sex:student.sex||"",enrollmentStatus:student.enrollment_status||"",sponsor:sponsor?.name||"—",parent:student.parent_name||"",parentPhone:student.parent_phone||"",scholarship:Boolean(student.scholarship)};
 $("studentName").textContent=fresh.name;$("studentId").textContent=fresh.id;$("schoolYear").textContent=fresh.schoolYear||"—";$("classValue").textContent=fresh.grade||"—";$("profileStudentId").textContent=fresh.id||"—";$("profileClass").textContent=fresh.grade||"—";$("profileSchoolYear").textContent=fresh.schoolYear||"—";$("profileStatus").textContent=student.is_active?"Active":"Inactive";$("welcomeText").textContent=`Welcome, ${fresh.name}.`;$('reportStudentName').textContent=fresh.name;$('reportStudentId').textContent=fresh.id;$('reportClass').textContent=fresh.grade;$('reportSponsor').textContent=fresh.sponsor;$('reportYear').textContent=fresh.schoolYear||"—";$('examClassTitle').textContent=fresh.grade||"Examination Timetable";
 const normalizeYear=v=>String(v??"").trim().toLowerCase().replace(/\\s+/g," ");
 const currentYear=normalizeYear(student.school_year);
 const financeRows=(finance||[]).filter(x=>!currentYear || normalizeYear(x.school_year)===currentYear);
 const fin=financeRows.length ? financeRows : (finance||[]);
 const feeRows=Array.isArray(feeStructure)?feeStructure:[];
 const feeStructureCurrent=feeRows.find(x=>normalizeYear(x.school_year)===currentYear) || feeRows[0] || null;
 const totalPaid=fin.reduce((a,x)=>a+Number(x.amount_paid||0),0);const totalDue=fresh.scholarship?0:Number(feeStructureCurrent?.amount_due??(Number(feeStructureCurrent?.first_payment||0)+Number(feeStructureCurrent?.second_payment||0)+Number(feeStructureCurrent?.third_payment||0)));const totalBalance=Math.max(0,totalDue-totalPaid);$("totalFees").textContent=`LD ${totalDue.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;$("totalPaid").textContent=`LD ${totalPaid.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;$("totalBalance").textContent=`LD ${totalBalance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;$("balanceValue").textContent=`LD ${totalBalance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;let runningPaid=0;const installmentMap={"1st Payment":Number(feeStructureCurrent?.first_payment||0),"2nd Payment":Number(feeStructureCurrent?.second_payment||0),"3rd Payment":Number(feeStructureCurrent?.third_payment||0)};const periodPaid={};$("paymentRows").innerHTML=fin.map(x=>{runningPaid+=Number(x.amount_paid||0);const period=x.description||"";periodPaid[period]=(periodPaid[period]||0)+Number(x.amount_paid||0);const required=installmentMap[period]||Number(x.amount_due||0);const periodBalance=Math.max(0,required-(periodPaid[period]||0));return `<tr><td>${esc(period)}</td><td>LD ${required.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>LD ${Number(x.amount_paid||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>LD ${periodBalance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>`}).join("")||'<tr><td colspan="4">No financial records available.</td></tr>';
 const gradeMap={};(grades||[]).forEach(g=>{gradeMap[g.subject_id+"|"+String(g.period||"").trim()]=g.score;});let html="";const reportSubjects=(subjects||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));for(const sub of reportSubjects){html+="<tr><td>"+esc(sub.name)+"</td>"+(periods.map(p=>{const key=sub.id+"|"+p.name;return "<td>"+esc(gradeMap[key]??"—")+"</td>"}).join(""))+"<td>—</td><td>—</td></tr>";}$("reportRows").innerHTML=html||"<tr><td colspan=11>No subjects available.</td></tr>";
const avgs=(grades||[]).map(g=>Number(g.score)).filter(Number.isFinite);const avg=avgs.length?avgs.reduce((a,b)=>a+b,0)/avgs.length:null;$('reportSummaryRows').innerHTML=`<tr><td>Average</td><td>${avg===null?"—":avg.toFixed(2)}</td></tr>`;$("reportConduct").textContent="—";
 const ann=announcements.map(a=>({title:a.title,body:a.message,date:a.created_at?.slice(0,10)||""}));$("homeAnnouncements").innerHTML=ann.slice(0,2).map(a=>`<div class="announcement"><h3>${esc(a.title)}</h3><div class="date">${esc(a.date)}</div><div>${esc(a.body)}</div></div>`).join("")||"<p>No announcements available.</p>";$("announcementList").innerHTML=ann.map(a=>`<div class="announcement"><h3>${esc(a.title)}</h3><div class="date">${esc(a.date)}</div><div>${esc(a.body)}</div></div>`).join("")||"<p>No announcements available.</p>";
 const asg=assignments.map(a=>({title:a.title,body:a.description||"",due:a.due_date||"",subject:subById[a.subject_id]||""}));$("assignmentCount").textContent=asg.length;$("assignmentList").innerHTML=asg.map(a=>`<div class="announcement"><h3>${esc(a.title)}</h3><div class="date">${esc(a.subject)} • Due ${esc(a.due)}</div><div>${esc(a.body)}</div></div>`).join("")||"<p>No assignments available.</p>";
 $("examRows").innerHTML=(exams||[]).map(e=>`<tr><td>${esc(e.exam_date||"")}</td><td><strong>${esc(subById[e.subject_id]||"")}</strong></td><td>${esc([e.start_time,e.end_time].filter(Boolean).join(" - "))}</td><td>${esc(e.room||"")}</td></tr>`).join("")||'<tr><td colspan="4">No examination timetable has been published for your class.</td></tr>';
 $("suggestionList").innerHTML=(suggestions||[]).map(s=>`<div class="announcement"><h3>${esc(s.title)}</h3><div class="date">${esc(s.created_at?.slice(0,10)||"")}</div><div>${esc(s.message||"")}</div></div>`).join("")||"<p>No suggestions available.</p>";
 const configuredScale=Array.isArray(scaleSettings?.statements)?scaleSettings.statements.map(x=>String(x||"").trim()).filter(Boolean):[];
 $("scaleStatements").innerHTML=(configuredScale.length?configuredScale:["Shows good effort","Completes assignments","Participates in class","Works well with others","Needs additional academic support"]).map(statement=>`<label><input type="checkbox" name="scale" value="${esc(statement)}"> <span>${esc(statement)}</span></label>`).join("");
 $("scaleMessage").textContent=scaleSettingsError?"Using the default Scale Your Child statements.":"";
 if($("studentRegistrationDate"))$("studentRegistrationDate").textContent=fresh.registrationDate||"—";
 if($("studentSex"))$("studentSex").textContent=fresh.sex||"—";
 if($("studentEnrollmentStatus"))$("studentEnrollmentStatus").textContent=fresh.enrollmentStatus||"—";
 if($("studentParent"))$("studentParent").textContent=fresh.parent||"—";
 if($("studentParentPhone"))$("studentParentPhone").textContent=fresh.parentPhone||"—";
 if($("studentSponsor"))$("studentSponsor").textContent=fresh.sponsor||"—";
 if($("studentScholarship"))$("studentScholarship").textContent=fresh.scholarship?"Yes — No tuition required":"No";
 const idCardPreview=$("studentIdCardPreview");
 if(idCardPreview){
   idCardPreview.innerHTML=student.id_card_data
     ? `<div class="id-card-label">Student ID Card</div><img src="${esc(student.id_card_data)}" alt="${esc(fresh.name)} student ID card">`
     : '<div class="id-card-empty">No ID card has been uploaded by the school.</div>';
 }
 document.querySelectorAll(".nav-button").forEach(b=>b.addEventListener("click",()=>openTab(b.dataset.tab)));openTab("home");
}
const titles={home:"Home",grades:"Student's Grade",finance:"Financial Report",scale:"Scale Your Child",suggestions:"Admin Suggestions",assignments:"Assignments",announcements:"Announcements",exams:"Examination Timetable",profile:"Profile"};
function openTab(id){document.querySelectorAll(".tab-page").forEach(p=>p.classList.remove("active"));$(id)?.classList.add("active");document.querySelectorAll(".nav-button").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));if($("pageTitle"))$("pageTitle").textContent=titles[id]||id;window.scrollTo({top:0,behavior:"smooth"});}
$("logout")?.addEventListener("click",async()=>{await vfaSupabase.auth.signOut();localStorage.removeItem("loggedInStudent");location.href="./"});
let vfaStudentRealtimeChannel=null;
let vfaStudentRealtimeTimer=null;
let vfaStudentRealtimePoll=null;
let vfaStudentRealtimeBusy=false;
const VFA_STUDENT_LIVE_TABLES=["students","financial_records","fee_structures","grades","exam_timetable","assignments","announcements","admin_suggestions","scale_settings","classes","subjects"];
async function refreshStudentRealtimeView(){
  if(vfaStudentRealtimeBusy)return;
  clearTimeout(vfaStudentRealtimeTimer);
  vfaStudentRealtimeTimer=setTimeout(async()=>{
    if(vfaStudentRealtimeBusy)return;
    vfaStudentRealtimeBusy=true;
    try{await load();}catch(err){console.warn("VFA student realtime refresh failed:",err);}finally{vfaStudentRealtimeBusy=false;}
  },150);
}
function setupStudentRealtime(){
  if(vfaStudentRealtimeChannel){vfaSupabase.removeChannel(vfaStudentRealtimeChannel);vfaStudentRealtimeChannel=null;}
  if(vfaStudentRealtimePoll)clearInterval(vfaStudentRealtimePoll);
  vfaStudentRealtimeChannel=vfaSupabase.channel("vfa-student-live-data",{config:{broadcast:{ack:false}}});
  VFA_STUDENT_LIVE_TABLES.forEach(table=>{vfaStudentRealtimeChannel.on("postgres_changes",{event:"*",schema:"public",table},()=>refreshStudentRealtimeView());});
  vfaStudentRealtimeChannel.subscribe(status=>{
    console.debug("VFA student realtime status:",status);
    if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
      setTimeout(()=>setupStudentRealtime(),1000);
    }
  });
  // Fast websocket events plus a 5-second fallback keep an already-open
  // phone/browser synchronized even when Realtime is unavailable.
  vfaStudentRealtimePoll=setInterval(()=>refreshStudentRealtimeView(),5000);
}
(async()=>{try{await load();setupStudentRealtime();}catch(err){console.error(err);alert("The student portal could not load: "+(err.message||err));}})();
