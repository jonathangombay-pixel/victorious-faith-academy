const ADMIN_ACCOUNTS=[
{id:"VFA-OWNER",email:"bishop.andrew@your-school-domain.com",password:"VFAOwner2026!",name:"Bishop Andrew Gombay Sr",role:"Owner",position:"School Owner",department:"Administration"},
{id:"VFA-ASSISTANT",email:"jue.carmo@your-school-domain.com",password:"VFAAssist2026!",name:"Jue Carmo",role:"Assistant",position:"School Assistant",department:"Administration"},
{id:"VFA-JONATHAN",email:"jonathangombay@gmail.com",password:"VFAJonathan2026!",name:"Jonathan",role:"Administrator",position:"Administrator",department:"Administration"}
];
const BASE_ID="0020172";
const classes=["Day Care","Nursery 1","Nursery 2","Kindergarten",...Array.from({length:9},(_,i)=>`Grade ${i+1}`)];
const subjects=["Mathematics","English Language","Science","Social Studies","ICT","Biology","Chemistry","Physics"];
const periods={first:["1st Period","2nd Period","3rd Period","Exam"],second:["4th Period","5th Period","6th Period","Exam"]};
let classRows=[],subjectRows=[],periodRows=[];
// One-time cleanup of legacy browser-stored school/demo records.
// Supabase is the source of truth for the migrated records.
const VFA_CLEANUP_VERSION="2026-08-31-clean-1";
if(localStorage.getItem("vfaCleanupVersion")!==VFA_CLEANUP_VERSION){
  ["vfaAdminStudents","vfaAdminPayments","vfaGrades","vfaExams","vfaAssignments","vfaAdminAnnouncements","vfaAdminSuggestions","vfaScaleResponses","vfaStaff","vfaStaffAttendance","vfaReportMeta"].forEach(k=>localStorage.removeItem(k));
  localStorage.setItem("vfaCleanupVersion",VFA_CLEANUP_VERSION);
}
const get=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}};
let students=[];
let pendingStudentIds=new Set();
let payments=[];
let gradesData={};
let exams=[];
let assignments=[];
let announcements=[];
let suggestions=[];
let scaleResponses=[];
let scaleStatements=["Shows good effort","Completes assignments","Participates in class","Works well with others","Needs additional academic support"];
let staff=[];
let staffAttendance=[];
let reportMeta=get("vfaReportMeta",{});
let currentAdmin=null;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const today=()=>new Date().toISOString().slice(0,10);
function save(){
 // Supabase is the source of truth. This cache is only for UI/session compatibility.
 try{
  localStorage.setItem("vfaGrades",JSON.stringify(gradesData));
  localStorage.setItem("vfaReportMeta",JSON.stringify(reportMeta));
 }catch{}
}
function makePassword(){
 const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
 let out="";for(let i=0;i<7;i++)out+=chars[Math.floor(Math.random()*chars.length)];return out;
}
function sortStudents(){students.sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base"}));}
function assignAlphabeticalIds(){
 const before=students.map(s=>({ref:s,old:s.id||""}));
 sortStudents();
 const changes={};
 students.forEach((s,i)=>{
   const next=`${BASE_ID}(${String(i+1).padStart(3,"0")})`;
   const old=s.id||"";
   if(old && old!==next) changes[old]=next;
   s.id=next;
 });
 if(Object.keys(changes).length){
   payments.forEach(p=>{if(changes[p.studentId])p.studentId=changes[p.studentId];});
   const nextGrades={};Object.entries(gradesData).forEach(([k,v])=>{const old=k.split("|")[0];nextGrades[(changes[old]||old)+k.slice(old.length)]=v;});gradesData=nextGrades;
   const nextMeta={};Object.entries(reportMeta).forEach(([k,v])=>{const old=k.split("|")[0];nextMeta[(changes[old]||old)+k.slice(old.length)]=v;});reportMeta=nextMeta;
   scaleResponses.forEach(r=>{if(changes[r.studentId])r.studentId=changes[r.studentId];});
   const logged=get("loggedInStudent",null);if(logged&&changes[logged.id]){logged.id=changes[logged.id];localStorage.setItem("loggedInStudent",JSON.stringify(logged));}
 }
 return changes;
}
function fillSelect(id,items,selected){
 const el=$(id); if(!el)return;
 el.innerHTML=items.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
 if(selected && items.includes(selected))el.value=selected;
}
function init(){
 // Passwords are assigned only once for newly created students. Remote students load their stored password.
 students.forEach(s=>{if(!s.dbId && !s.password)s.password=makePassword();});
 if(students.length)assignAlphabeticalIds();
 if(!students.length) localStorage.removeItem("vfaAdminStudents");
 fillSelect("studentClass",["All Classes",...classes],"All Classes");
 fillSelect("gradeClass",classes); fillSelect("financeClass",classes); fillSelect("examGrade",classes);
 fillSelect("assignmentAudience",["All Students",...classes]);
 fillSelect("announcementAudience",["All Students",...classes]);
 fillSelect("suggestionAudience",["All Students",...classes]);
 $("staffDate").value=today();
 $("announcementDate").value=today();
 renderAll();
}
function renderAll(){
 renderHome();renderStudents();renderGrades();renderFinanceClass();renderExams();renderAssignments();renderAnnouncements();renderScale();renderSuggestions();renderStaff();
 loadScaleStatements();
}
$("staffLoginForm").onsubmit=async e=>{
 e.preventDefault();const id=$("staffId").value.trim(),pw=$("staffPassword").value;
 currentAdmin=ADMIN_ACCOUNTS.find(a=>a.id===id);
 if(!currentAdmin){$("loginMessage").textContent="Incorrect Admin ID or password.";return}
 $("loginMessage").textContent="Signing in…";
 const {error}=await vfaSupabase.auth.signInWithPassword({email:currentAdmin.email,password:pw});
 if(error){$("loginMessage").textContent="Incorrect Admin ID or password.";currentAdmin=null;return;}
 try{await loadVfaRemote();}catch(err){console.error("VFA database load failed:",err);$("loginMessage").textContent="Database load failed: "+(err?.message||String(err));return;}
 $("loginView").classList.add("hidden");$("adminApp").classList.remove("hidden");
 $("staffPill").textContent=`${currentAdmin.name} • ${currentAdmin.role}`;
 init();
};
$("toggleStaffPassword").onclick=()=>{$("staffPassword").type=$("staffPassword").type==="password"?"text":"password"};
$("staffLogout").onclick=async()=>{await vfaSupabase.auth.signOut();currentAdmin=null;$("adminApp").classList.add("hidden");$("loginView").classList.remove("hidden");$("staffId").value="";$("staffPassword").value=""};
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>openSection(b.dataset.section));
function openSection(id){document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));$(id).classList.add("active");document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.section===id));$("sectionTitle").textContent={overview:"Home",students:"Students",grades:"Report Cards",tuition:"Financial Records",exams:"Examination Timetable",assignments:"Assignments",announcements:"Announcements",scale:"Scale Your Child",suggestions:"Admin Suggestions",staff:"Staff / Teacher Attendance"}[id]||"Home";window.scrollTo({top:0,behavior:"smooth"});}
function renderHome(){
 $("welcomeTitle").textContent=`Welcome, ${currentAdmin?.name||"Administrator"} 👋🏾`;
 $("todayLabel").textContent=new Date(today()+"T12:00:00").toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"});
 $("studentCount").textContent=students.length;$("staffCount").textContent=staff.length;$("announcementCount").textContent=announcements.length;$("scaleCount").textContent=scaleResponses.filter(r=>!r.reviewed).length;
}
$("addStudent").onclick=()=>openStudentForm();
$("saveStudents").onclick=async()=>{
  try{
    if(!students.length){alert("There are no students to save.");return;}
    assignAlphabeticalIds();
    await syncVfaStudents();
    await syncVfaGrades();
    pendingStudentIds.clear();
    renderAll();
    alert("Students saved successfully to the school database.");
  }catch(err){
    console.error("Student save failed:",err);
    alert("The students could not be saved to the school database: "+err.message);
  }
};
$("studentClass").onchange=renderStudents;$("studentSearch").oninput=renderStudents;
function renderStudents(){
 const cls=$("studentClass").value,q=($("studentSearch").value||"").trim().toLowerCase();
 const list=students.filter(s=>(!cls||cls==="All Classes"||s.grade===cls)&&(!q||`${s.name||""} ${s.id||""}`.toLowerCase().includes(q)));
 $("studentRows").innerHTML=list.map(s=>`<tr><td><strong>${esc(s.id)}</strong></td><td><button class="link-button" onclick="openStudentRecord('${esc(s.id)}')">${esc(s.name)}</button></td><td>${esc(s.grade)}</td><td>${esc(s.parent||"")}</td><td>${esc(s.parentPhone||"")}</td><td><code>${esc(s.password||"")}</code></td><td>${esc(s.status||"Active")}</td><td class="row-actions"><button class="icon-btn" onclick="openStudentForm('${esc(s.id)}')">✏️</button><button class="icon-btn danger" onclick="deleteStudent('${esc(s.id)}')">🗑️</button></td></tr>`).join("")||'<tr><td colspan="8" class="empty">No students in this class.</td></tr>';
}
function openStudentForm(id){
 const s=students.find(x=>x.id===id);
 const grade=s?.grade||$("studentClass").value||classes[0];
 openModal(id?"Edit Student":"Add Student",`<form id="studentForm" class="form-grid student-form">
 <label class="full">Student Full Name<input name="name" value="${esc(s?.name||"")}" required></label>
 <label>Class<select name="grade">${classes.map(c=>`<option ${c===grade?"selected":""}>${esc(c)}</option>`).join("")}</select></label>
 <label>Parent / Guardian<input name="parent" value="${esc(s?.parent||"")}" placeholder="Parent or guardian name"></label>
 <label>Parent Phone Number<input name="parentPhone" value="${esc(s?.parentPhone||"")}" placeholder="Phone number"></label>
 <label>Sponsor / Class Teacher<select name="sponsor"><option value="">Select staff member</option>${staff.map(t=>{const n=t.name||t.fullName||t.staffName||"";return `<option value="${esc(n)}" ${n===(s?.sponsor||"")?"selected":""}>${esc(n)}</option>`}).join("")}</select></label>
 <label>Status<select name="status"><option ${s?.status!=="Inactive"?"selected":""}>Active</option><option ${s?.status==="Inactive"?"selected":""}>Inactive</option></select></label>
 <label class="full">School Year<input name="schoolYear" value="${esc(s?.schoolYear||"")}" required></label>
 <label class="full">ID Card Upload<div class="student-id-upload-box"><input id="studentIdCardUpload" name="idCard" type="file" accept="image/*"><small>Upload this student's ID card. The image will appear in the student's Profile tab.</small><div id="studentIdCardUploadPreview" class="student-id-upload-preview"></div></div></label>
 <div class="credential-box full"><strong>Portal Login</strong><p>Student ID: <code>${esc(s?.id||"Assigned automatically")}</code></p><p>Password: <code id="newStudentPassword">${esc(s?.password||"Will be generated automatically")}</code></p><small>New students receive a strong password automatically. The ID uses the fixed seven-digit prefix ${BASE_ID} and an alphabetical three-digit suffix.</small></div>
 <div class="submit-row"><button class="primary" type="submit">${id?"Save Student":"Add Student"}</button></div></form>`);
 $("studentForm").onsubmit=e=>{
   e.preventDefault();const f=new FormData(e.target);
   const file=f.get("idCard");
   const finish=()=>{assignAlphabeticalIds();pendingStudentIds.add(s?.dbId||s?.id||"pending");closeModal();fillSelect("studentClass",["All Classes",...classes],$("studentClass").value);renderAll();};
   const applyCard=(target)=>{
     if(file && file.size && file.type.startsWith("image/")){const reader=new FileReader();reader.onload=()=>{target.idCard=reader.result;finish();};reader.readAsDataURL(file);}
     else finish();
   };
   if(id){Object.assign(s,{name:f.get("name").trim(),grade:f.get("grade"),parent:f.get("parent").trim(),parentPhone:f.get("parentPhone").trim(),sponsor:f.get("sponsor").trim(),status:f.get("status"),schoolYear:f.get("schoolYear").trim()});applyCard(s);}
   else{const ns={id:"",name:f.get("name").trim(),grade:f.get("grade"),parent:f.get("parent").trim(),parentPhone:f.get("parentPhone").trim(),sponsor:f.get("sponsor").trim(),status:f.get("status"),schoolYear:f.get("schoolYear").trim(),password:makePassword(),idCard:""};students.push(ns);applyCard(ns);}

 };
}
window.deleteStudent=async id=>{
 const s=students.find(x=>x.id===id);if(!s)return;
 if(!confirm(`Delete ${s.name}? This will remove the student and their portal login from Supabase.`))return;
 try{
   if(s.auth_user_id){
     const {data,error}=await vfaSupabase.functions.invoke("bright-api",{
       body:{action:"delete",studentDbId:s.dbId,authUserId:s.auth_user_id}
     });
     if(error)throw error;
     if(data?.error)throw new Error(data.error);
   }
   if(s.dbId){
     const {error}=await vfaSupabase.from("students").delete().eq("id",s.dbId);
     if(error)throw error;
   }
   students=students.filter(x=>x.id!==id);
   payments=payments.filter(p=>p.studentId!==id);
   Object.keys(gradesData).filter(k=>k.startsWith(id+"|")).forEach(k=>delete gradesData[k]);
   assignAlphabeticalIds();
   renderAll();
   alert("Student deleted successfully from the school database.");
 }catch(err){console.error(err);alert("The student could not be deleted from the school database: "+err.message);}
};

window.openStudentRecord=id=>{const s=students.find(x=>x.id===id);if(!s)return;openModal(`${s.name} — Student Record`,`<div class="record-grid"><div><strong>Student ID</strong><span>${esc(s.id)}</span></div><div><strong>Class</strong><span>${esc(s.grade)}</span></div><div><strong>Parent / Guardian</strong><span>${esc(s.parent||"")}</span></div><div><strong>Parent Phone</strong><span>${esc(s.parentPhone||"")}</span></div><div><strong>Sponsor / Class Teacher</strong><span>${esc(s.sponsor||"—")}</span></div><div><strong>Portal Password</strong><span><code>${esc(s.password)}</code></span></div><div><strong>School Year</strong><span>${esc(s.schoolYear||"")}</span></div></div><div class="sheet-toolbar"><button class="secondary" onclick="openStudentForm('${esc(s.id)}')">Edit Student</button></div>`);};

$("gradeClass").onchange=renderGrades;$("gradeSemester").onchange=renderGrades;$("gradeSubject").onchange=renderGrades;$("saveAllGrades").onclick=saveGradeSheet;
function renderGrades(){
 fillSelect("gradeSubject",subjects,$("gradeSubject").value||subjects[0]);
 const cls=$("gradeClass").value,sem=$("gradeSemester").value,period=periods[sem][0];
 if(!$("gradePeriod")){const wrap=$("gradeSemester").parentElement;const l=document.createElement("label");l.innerHTML=`Period<select id="gradePeriod"></select>`;wrap.parentElement.appendChild(l);}
 const periodEl=$("gradePeriod");periodEl.innerHTML=periods[sem].map(p=>`<option>${p}</option>`).join(""); if(periodEl.dataset.sem===sem){} else periodEl.value=period;
 periodEl.dataset.sem=sem;periodEl.onchange=renderGrades;
 const list=students.filter(s=>s.grade===cls&&s.status!=="Inactive");
 $("gradeHead").innerHTML=`<tr><th>Student ID</th><th>Student</th>${subjects.map(sub=>`<th>${esc(sub)}</th>`).join("")}<th>Average</th><th>Rank</th><th>Conduct</th></tr>`;
 const selectedPeriod=periodEl.value;
 $("gradeSheet").innerHTML=list.map(s=>{const mk=`${s.id}|${sem}|${selectedPeriod}`;const m=reportMeta[mk]||{};return `<tr><td>${esc(s.id)}</td><td><strong>${esc(s.name)}</strong></td>${subjects.map(sub=>{const k=gradeKey(s.id,sub,selectedPeriod);return `<td><input class="sheet-input grade-cell" data-key="${esc(k)}" value="${esc(gradesData[k]??"")}" type="number" min="0" max="100" step="1"></td>`}).join("")}<td><input class="sheet-input report-meta" data-meta="${esc(mk)}" data-field="average" value="${esc(m.average??"")}" type="number" min="0" max="100" step="0.01"></td><td><input class="sheet-input report-meta" data-meta="${esc(mk)}" data-field="rank" value="${esc(m.rank??"")}" type="text" placeholder="e.g. 1st"></td><td><input class="sheet-input report-meta" data-meta="${esc(mk)}" data-field="conduct" value="${esc(m.conduct??"")}" type="text" placeholder="Conduct"></td></tr>`}).join("")||`<tr><td colspan="${subjects.length+5}" class="empty">No students in ${esc(cls)}.</td></tr>`;
}
function gradeKey(id,sub,period){return `${id}|${sub}|${period}`;}
async function saveGradeSheet(){
 document.querySelectorAll(".grade-cell").forEach(i=>{const v=i.value.trim();if(v==="")delete gradesData[i.dataset.key];else gradesData[i.dataset.key]=Math.max(0,Math.min(100,Number(v)))});
 document.querySelectorAll(".report-meta").forEach(i=>{const key=i.dataset.meta;reportMeta[key]=reportMeta[key]||{};const v=i.value.trim();if(v==="")delete reportMeta[key][i.dataset.field];else reportMeta[key][i.dataset.field]=v;});
 try{await syncVfaGrades();await refreshRemoteContent();renderGrades();alert("Grade sheet saved to the school database.");}catch(err){console.error(err);alert("Could not save grades: "+err.message)}
}

function financeRowsFor(studentId){return payments.filter(p=>p.studentId===studentId).sort((a,b)=>String(a.date).localeCompare(String(b.date)));}
function financeDue(studentId){const rows=financeRowsFor(studentId);return rows.length?Math.max(...rows.map(r=>Number(r.amountDue||0))):0;}
function recalcStudentPayments(studentId){
 const rows=financeRowsFor(studentId); let running=financeDue(studentId);
 rows.forEach(p=>{running=Math.max(0,running-Number(p.amount||0));p.balance=running;});
}
$("financeClass").onchange=renderFinanceClass;$("financeSearch").oninput=renderFinanceClass;
function renderFinanceClass(){
 const cls=$("financeClass").value,q=($("financeSearch").value||"").toLowerCase();
 const list=students.filter(s=>s.grade===cls&&(!q||`${s.name} ${s.id}`.toLowerCase().includes(q)));
 $("financeClassRows").innerHTML=list.map(s=>{const rows=financeRowsFor(s.id),due=financeDue(s.id),paid=rows.reduce((a,p)=>a+Number(p.amount||0),0),bal=Math.max(0,due-paid);return `<tr><td><button class="link-button" onclick="openFinance('${esc(s.id)}')">${esc(s.name)}</button></td><td>${esc(s.id)}</td><td>${esc(s.grade)}</td><td>$${due.toFixed(2)}</td><td>$${paid.toFixed(2)}</td><td>$${bal.toFixed(2)}</td><td><button class="secondary small" onclick="openFinance('${esc(s.id)}')">Open Sheet</button></td></tr>`}).join("")||'<tr><td colspan="7" class="empty">No students in this class.</td></tr>';
}
window.openFinance=id=>{
 const s=students.find(x=>x.id===id);if(!s)return; const rows=financeRowsFor(id),due=financeDue(id),paid=rows.reduce((a,p)=>a+Number(p.amount||0),0),bal=Math.max(0,due-paid);
 openModal(`${s.name} — Financial Record`,`<div class="finance-summary"><div><span>Total Due</span><strong>$${due.toFixed(2)}</strong></div><div><span>Total Paid</span><strong>$${paid.toFixed(2)}</strong></div><div><span>Balance</span><strong>$${bal.toFixed(2)}</strong></div></div>
 <div class="sheet-toolbar"><button class="primary" onclick="addPayment('${esc(id)}')">＋ Add Payment</button></div>
 <div class="table-wrap"><table class="spreadsheet"><thead><tr><th>Date</th><th>Student</th><th>Payment Period / Term</th><th>Amount Paid</th><th>Balance After Payment</th><th>Action</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${esc(p.date)}</td><td>${esc(s.name)}</td><td>${esc(p.period)}</td><td>$${Number(p.amount||0).toFixed(2)}</td><td>$${Number(p.balance||0).toFixed(2)}</td><td><button class="icon-btn danger" onclick="deletePayment('${esc(p.id)}','${esc(id)}')">🗑️</button></td></tr>`).join("")||'<tr><td colspan="6" class="empty">No payment records yet.</td></tr>'}</tbody></table></div>
 <p class="record-note">Financial records are stored in the shared school database. The balance is calculated from the amount due and recorded payments.</p>`);
};
window.addPayment=id=>{
 const s=students.find(x=>x.id===id);if(!s)return;
 openModal(`Add Payment — ${s.name}`,`<form id="paymentForm" class="form-grid student-form"><label>Date<input name="date" type="date" value="${today()}" required></label><label>Payment Period / Term<input name="period" placeholder="e.g. First Term" required></label><label>Amount Due<input name="due" type="number" min="0" step="0.01" required></label><label>Amount Paid<input name="amount" type="number" min="0.01" step="0.01" required></label><div class="submit-row"><button class="primary" type="submit">Save Payment</button></div></form>`);
 $("paymentForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),amt=Number(f.get("amount")),due=Number(f.get("due"));if(!amt)return;const rows=financeRowsFor(id),oldPaid=rows.reduce((a,p)=>a+Number(p.amount||0),0),balance=Math.max(0,due-(oldPaid+amt));const payload={student_id:s.dbId,payment_date:f.get("date"),payment_period:f.get("period").trim(),amount_paid:amt,amount_due:due};try{const {data,error}=await vfaSafeInsert("financial_records",payload,["payment_period","amount_due"]);if(error)throw error;await refreshRemoteContent();closeModal();openFinance(id);renderFinanceClass();}catch(err){console.error(err);alert("Could not save payment: "+err.message)}};
};
window.deletePayment=async(pid,sid)=>{if(!confirm("Delete this payment record?"))return;try{const {error}=await vfaSupabase.from("financial_records").delete().eq("id",pid);if(error)throw error;await refreshRemoteContent();openFinance(sid);renderFinanceClass();}catch(err){alert("Could not delete payment: "+err.message)}};

$("examGrade").onchange=renderExams;$("addExamRow").onclick=()=>addExamRow();$("saveExams").onclick=saveExamSheet;
function renderExams(){const cls=$("examGrade").value;const list=exams.filter(x=>x.grade===cls);$("examSheet").innerHTML=list.map(x=>`<tr data-id="${esc(x.id)}"><td><input class="sheet-input exam-date" type="date" value="${esc(x.date)}"></td><td><input class="sheet-input exam-subject" value="${esc(x.subject)}"></td><td><input class="sheet-input exam-time" value="${esc(x.time)}"></td><td><input class="sheet-input exam-room" value="${esc(x.room)}"></td><td><button class="icon-btn danger" onclick="removeExam('${esc(x.id)}')">🗑️</button></td></tr>`).join("")||'<tr><td colspan="5" class="empty">No exams scheduled for this class.</td></tr>';}
async function addExamRow(){exams.push({id:"NEW-"+Date.now(),grade:$("examGrade").value,date:"",subject:"",time:"",room:""});renderExams();}
async function saveExamSheet(){try{const cls=$("examGrade").value;const classRow=classRows.find(c=>c.name===cls);if(!classRow)throw new Error("Class not found.");const rows=[...document.querySelectorAll("#examSheet tr[data-id]")];for(const tr of rows){const x=exams.find(e=>e.id===tr.dataset.id);if(!x)continue;x.date=tr.querySelector(".exam-date").value;x.subject=tr.querySelector(".exam-subject").value.trim();x.time=tr.querySelector(".exam-time").value.trim();x.room=tr.querySelector(".exam-room").value.trim();if(!x.date&&!x.subject&&!x.time&&!x.room){if(!String(x.id).startsWith("NEW-"))await vfaSupabase.from("exam_timetable").delete().eq("id",x.id);continue;}const subjectRow=subjectRows.find(a=>a.name===x.subject);if(!subjectRow)throw new Error(`Subject not found: ${x.subject}`);const [startTime,endTime]=(x.time||"").split(/\s*-\s*/);const payload={exam_date:x.date||null,start_time:startTime||null,end_time:endTime||null,room:x.room||null,subject_id:subjectRow.id,class_id:classRow.id};let res;if(String(x.id).startsWith("NEW-"))res=await vfaSafeInsert("exam_timetable",payload,["start_time","end_time","room","subject_id","class_id"]);else res=await vfaSafeUpdate("exam_timetable",payload,"id",x.id,["start_time","end_time","room","subject_id","class_id"]);if(res.error)throw res.error;if(res.data){x.id=res.data.id;}}await refreshRemoteContent();renderExams();alert("Examination timetable saved to the school database.");}catch(err){console.error(err);alert("Could not save timetable: "+err.message)}}
window.removeExam=async id=>{if(String(id).startsWith("NEW-")){exams=exams.filter(x=>x.id!==id);renderExams();return;}if(!confirm("Delete this examination row?"))return;try{const {error}=await vfaSupabase.from("exam_timetable").delete().eq("id",id);if(error)throw error;exams=exams.filter(x=>x.id!==id);renderExams();}catch(err){alert("Could not delete exam: "+err.message)}};
function audienceClassId(audience){return audience&&audience!=="All Students"?(classRows.find(c=>c.name===audience)?.id||null):null;}
function renderAssignments(){$("assignmentList").innerHTML=assignments.map(a=>`<div class="announcement-item"><div><strong>${esc(a.title)}</strong><span>${esc(a.subject||"")} • Due ${esc(a.due||"")} • ${esc(a.audience)}</span><p>${esc(a.body)}</p></div><button class="icon-btn danger" onclick="removeAssignment('${esc(a.id)}')">🗑️</button></div>`).join("")||'<p class="empty">No assignments published.</p>'}
$("addAssignment").onclick=async()=>{const title=$("assignmentTitle").value.trim(),audience=$("assignmentAudience").value,subject=$("assignmentSubject").value.trim(),due=$("assignmentDue").value,body=$("assignmentBody").value.trim();if(!title||!body)return alert("Enter an assignment title and instructions.");try{const sr=subjectRows.find(x=>x.name.toLowerCase()===subject.toLowerCase());const {data,error}=await vfaSafeInsert("assignments",{title,description:body,due_date:due||null,class_id:audienceClassId(audience),subject_id:sr?.id||null},["due_date","class_id","subject_id"]);if(error)throw error;await refreshRemoteContent();$("assignmentTitle").value="";$("assignmentSubject").value="";$("assignmentDue").value="";$("assignmentBody").value="";renderAssignments();}catch(err){alert("Could not publish assignment: "+err.message)}};
window.removeAssignment=async id=>{if(!confirm("Delete this assignment?"))return;try{const {error}=await vfaSupabase.from("assignments").delete().eq("id",id);if(error)throw error;await refreshRemoteContent();renderAssignments();}catch(err){alert("Could not delete assignment: "+err.message)}};
function renderAnnouncements(){$("announcementAdminList").innerHTML=announcements.map(a=>`<div class="announcement-item"><div><strong>${esc(a.title)}</strong><span>${esc(a.date)} • ${esc(a.audience)}</span><p>${esc(a.body)}</p></div><button class="icon-btn danger" onclick="removeAnnouncement('${esc(a.id)}')">🗑️</button></div>`).join("")||'<p class="empty">No announcements published.</p>'}
$("addAnnouncement").onclick=async()=>{const title=$("announcementTitle").value.trim(),date=$("announcementDate").value,audience=$("announcementAudience").value,body=$("announcementBody").value.trim();if(!title||!date||!body)return alert("Complete the announcement.");try{const createdAt=date?new Date(`${date}T12:00:00`).toISOString():new Date().toISOString();const {data,error}=await vfaSafeInsert("announcements",{title,message:body,target_class_id:audienceClassId(audience),publish_to_all:audience==="All Students",created_at:createdAt},["target_class_id","publish_to_all","created_at"]);if(error)throw error;await refreshRemoteContent();$("announcementTitle").value="";$("announcementBody").value="";renderAnnouncements();renderHome();}catch(err){alert("Could not publish announcement: "+err.message)}};
window.removeAnnouncement=async id=>{if(!confirm("Delete this announcement?"))return;try{const {error}=await vfaSupabase.from("announcements").delete().eq("id",id);if(error)throw error;await refreshRemoteContent();renderAnnouncements();renderHome();}catch(err){alert("Could not delete announcement: "+err.message)}};

async function loadScaleStatements(){try{const {data,error}=await vfaSupabase.from("scale_settings").select("statements").eq("id",1).maybeSingle();if(error)throw error;if(Array.isArray(data?.statements)&&data.statements.length===5)scaleStatements=data.statements.map(x=>String(x||"").trim());}catch(err){console.warn("Scale settings could not be loaded:",err)}for(let i=1;i<=5;i++){const el=$("scaleStatement"+i);if(el)el.value=scaleStatements[i-1]||"";}}
$("saveScaleStatements")?.addEventListener("click",async()=>{const vals=[];for(let i=1;i<=5;i++){const v=$("scaleStatement"+i)?.value.trim();if(!v){$("scaleSettingsMessage").textContent=`Statement ${i} cannot be empty.`;return}vals.push(v)}const btn=$("saveScaleStatements");btn.disabled=true;try{const {error}=await vfaSupabase.from("scale_settings").upsert({id:1,statements:vals,updated_at:new Date().toISOString()});if(error)throw error;scaleStatements=vals;$("scaleSettingsMessage").textContent="Saved successfully."}catch(err){$("scaleSettingsMessage").textContent="Could not save: "+err.message}btn.disabled=false;});
function renderScale(){$("scaleList").innerHTML=scaleResponses.slice().reverse().map(r=>`<div class="feedback-item"><div><strong>${esc(r.studentName||"Student")}</strong><span>${esc(r.date||"")} • ${esc(r.studentGrade||"")}</span><p>${esc((r.checks||[]).join(" • "))}</p>${r.note?`<p>${esc(r.note)}</p>`:""}</div><button class="icon-btn" onclick="markScaleReviewed('${esc(r.id)}')">${r.reviewed?"✓ Reviewed":"Mark reviewed"}</button></div>`).join("")||'<p class="empty">No Scale Your Child responses yet.</p>'}
window.markScaleReviewed=async id=>{const r=scaleResponses.find(x=>x.id===id);if(!r)return;const response={...(r.response||{}),checks:r.checks||[],note:r.note||"",reviewed:!r.reviewed};try{const {error}=await vfaSupabase.from("scale_your_child").update({response}).eq("id",id);if(error)throw error;r.reviewed=response.reviewed;renderScale();renderHome();}catch(err){alert("Could not update response: "+err.message)}};
function renderSuggestions(){$("suggestionList").innerHTML=suggestions.map(s=>`<div class="announcement-item"><div><strong>${esc(s.title)}</strong><span>To: ${esc(s.audience)} • ${esc(s.date)} • By ${esc(s.by)}</span><p>${esc(s.body)}</p></div><button class="icon-btn danger" onclick="removeSuggestion('${esc(s.id)}')">🗑️</button></div>`).join("")||'<p class="empty">No suggestions sent.</p>'}
$("addSuggestion").onclick=async()=>{const audience=$("suggestionAudience").value,title=$("suggestionTitle").value.trim(),body=$("suggestionBody").value.trim();if(!title||!body)return alert("Enter a title and message.");try{const {data,error}=await vfaSafeInsert("admin_suggestions",{title,message:body,target_class_id:audienceClassId(audience)},["target_class_id"]);if(error)throw error;await refreshRemoteContent();$("suggestionTitle").value="";$("suggestionBody").value="";renderSuggestions();}catch(err){alert("Could not send suggestion: "+err.message)}};
window.removeSuggestion=async id=>{if(!confirm("Delete this suggestion?"))return;try{const {error}=await vfaSupabase.from("admin_suggestions").delete().eq("id",id);if(error)throw error;await refreshRemoteContent();renderSuggestions();}catch(err){alert("Could not delete suggestion: "+err.message)}};

$("staffDate").onchange=renderStaff;$("addStaff").onclick=()=>openStaffForm();
function formatCheckInTime(value){if(!value)return "—";const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});}
function renderStaff(){const date=$("staffDate").value||today();$("staffRows").innerHTML=staff.map(s=>{const rec=staffAttendance.find(r=>r.staffId===s.id&&r.date===date);return `<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.position)}</td><td><select class="staff-status" data-id="${esc(s.id)}"><option value="present" ${rec?.status==="present"?"selected":""}>Present</option><option value="absent" ${rec?.status==="absent"?"selected":""}>Absent</option></select></td><td>${esc(formatCheckInTime(rec?.time))}</td><td><button class="secondary small" onclick="saveStaffStatus('${esc(s.id)}')">Save</button> <button class="icon-btn" onclick="openStaffForm('${esc(s.id)}')">✏️</button><button class="icon-btn danger" onclick="deleteStaff('${esc(s.id)}')">🗑️</button></td></tr>`}).join("")||'<tr><td colspan="5" class="empty">No staff or teachers added yet.</td></tr>';}
async function upsertAttendance(payload,staffId,date){
  // Attendance is permanent: one record per staff member per date.
  // When marked Present for the first time, capture the current check-in time.
  const status=String(payload.status||"").toLowerCase()==="present"?"Present":"Absent";
  const probe=await vfaSupabase.from("staff_attendance")
    .select("id,status,check_in_time")
    .eq("staff_id",staffId)
    .eq("attendance_date",date)
    .order("created_at",{ascending:false})
    .limit(1);
  if(probe.error)return probe;
  const existing=probe.data?.[0];
  const base={staff_id:staffId,status,attendance_date:date,check_in_time:status==="Present"?(existing?.check_in_time||new Date().toISOString()):null};
  if(existing?.id)return await vfaSupabase.from("staff_attendance").update(base).eq("id",existing.id).select("*");
  return await vfaSupabase.from("staff_attendance").insert(base).select("*");
}
window.saveStaffStatus=async id=>{
  const date=$("staffDate").value||today();
  const select=document.querySelector(`.staff-status[data-id="${CSS.escape(id)}"]`);
  const s=staff.find(x=>x.id===id);if(!s||!select)return;
  try{
    const res=await upsertAttendance({staff_id:s.id,date,status:select.value},s.id,date);
    if(res.error)throw res.error;
    // Immediately reflect the saved attendance in the UI.
    const existing=staffAttendance.find(r=>r.staffId===id&&r.date===date);
    const normalized=select.value.toLowerCase();
    const saved=res.data?.[0]||res.data||{};
    const savedTime=saved.check_in_time||saved.time||null;
    if(existing){existing.status=normalized;existing.time=savedTime|| (normalized==="present" ? existing.time : "");}
    else staffAttendance.push({id:saved.id||`local-${id}-${date}`,staffId:id,date,status:normalized,time:savedTime||""});
    renderStaff();
    refreshRemoteContent().then(()=>renderStaff()).catch(err=>console.warn("Attendance refresh warning:",err));
  }catch(err){console.error(err);alert("Could not save attendance: "+err.message)}
};
function openStaffForm(id){
  const s=staff.find(x=>x.id===id);
  openModal(id?"Edit Staff / Teacher":"Add Staff / Teacher",`<form id="staffForm" class="form-grid student-form"><label class="full">Full Name<input name="name" value="${esc(s?.name||"")}" required></label><label>Position<input name="position" value="${esc(s?.position||"")}" placeholder="Teacher, Principal, Secretary..." required></label><label>Phone<input name="phone" value="${esc(s?.phone||"")}" placeholder="Phone number"></label><div class="submit-row"><button class="primary" type="submit">${id?"Save":"Add Staff"}</button></div></form>`);
  $("staffForm").onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const name=String(f.get("name")||"").trim(),position=String(f.get("position")||"").trim(),phone=String(f.get("phone")||"").trim();
    try{
      if(id){
        const {error}=await vfaSupabase.from("staff").update({full_name:name,position,phone}).eq("id",id);
        if(error)throw error;
        if(s)Object.assign(s,{name,position,phone});
      }else{
        const {data,error}=await vfaSupabase.from("staff").insert({full_name:name,position,phone}).select("id,full_name,position,phone");
        if(error)throw error;
        const row=data?.[0];
        if(row)staff.push({dbId:row.id,id:row.id,name:row.full_name,position:row.position||"",phone:row.phone||""});
      }
      closeModal();renderAll();
      refreshRemoteContent().then(()=>renderAll()).catch(err=>console.warn("Staff refresh warning:",err));
    }catch(err){console.error(err);alert("Could not save staff member: "+err.message)}
  };
}
window.deleteStaff=async id=>{
  const s=staff.find(x=>x.id===id);if(!s||!confirm(`Delete ${s.name} from staff?`))return;
  try{
    const attendanceDelete=await vfaSupabase.from("staff_attendance").delete().eq("staff_id",id);
    if(attendanceDelete.error)throw new Error(`staff attendance: ${attendanceDelete.error.message}`);
    const clearSponsor=await vfaSupabase.from("students").update({sponsor_id:null}).eq("sponsor_id",id);
    if(clearSponsor.error){
      const msg=String(clearSponsor.error.message||"");
      if(!/column|schema cache|does not exist/i.test(msg))throw new Error(`student sponsor reference: ${msg}`);
    }
    const {error}=await vfaSupabase.from("staff").delete().eq("id",id);
    if(error)throw error;
    // Remove immediately from the current page, then confirm from Supabase.
    staff=staff.filter(x=>x.id!==id);
    staffAttendance=staffAttendance.filter(x=>x.staffId!==id);
    students.forEach(st=>{if(st.sponsorId===id){st.sponsorId="";st.sponsor="";}});
    renderAll();
    refreshRemoteContent().then(()=>renderAll()).catch(err=>console.warn("Staff refresh warning:",err));
  }catch(err){console.error(err);alert("Could not delete staff member: "+err.message)}
};
function openModal(title,html){$("modalTitle").textContent=title;$("modalBody").innerHTML=html;$("modal").classList.remove("hidden")}
function closeModal(){$("modal").classList.add("hidden")}
$("closeModal").onclick=closeModal;$("modal").onclick=e=>{if(e.target.id==="modal")closeModal()};
(function(){const menu=$("mobileMenu"),sidebar=document.querySelector(".sidebar"),overlay=$("sidebarOverlay");if(!menu||!sidebar||!overlay)return;function close(){sidebar.classList.remove("mobile-open");overlay.classList.remove("show");menu.setAttribute("aria-expanded","false")}menu.onclick=()=>{const open=sidebar.classList.toggle("mobile-open");overlay.classList.toggle("show",open);menu.setAttribute("aria-expanded",String(open))};overlay.onclick=close;sidebar.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{if(btn!==menu)close()}))})();

/* ================= SUPABASE DATA BRIDGE ================= */
// Retry inserts/updates when an OPTIONAL column is absent from the live schema.
// This keeps the portal compatible with the tables already in the user's Supabase project.
async function vfaSafeInsert(table,payload,optionalKeys=[]){
  let data={...payload};
  for(let i=0;i<=optionalKeys.length;i++){
    const res=await vfaSupabase.from(table).insert(data).select().single();
    if(!res.error)return res;
    const m=String(res.error.message||"").match(/(?:column ['\"]?([A-Za-z0-9_]+)['\"]? does not exist|Could not find the ['\"]([A-Za-z0-9_]+)['\"] column)/i);
    if(!m || !optionalKeys.includes(m[1]) || !(m[1] in data))return res;
    delete data[m[1]];
  }
}
async function vfaSafeUpdate(table,payload,matchColumn,matchValue,optionalKeys=[]){
  let data={...payload};
  for(let i=0;i<=optionalKeys.length;i++){
    const res=await vfaSupabase.from(table).update(data).eq(matchColumn,matchValue).select().single();
    if(!res.error)return res;
    const m=String(res.error.message||"").match(/(?:column ['\"]?([A-Za-z0-9_]+)['\"]? does not exist|Could not find the ['\"]([A-Za-z0-9_]+)['\"] column)/i);
    if(!m || !optionalKeys.includes(m[1]) || !(m[1] in data))return res;
    delete data[m[1]];
  }
}

async function refreshRemoteContent(){
  const classMap=Object.fromEntries(classRows.map(x=>[x.id,x.name]));
  const subMap=Object.fromEntries(subjectRows.map(x=>[x.id,x.name]));
  const {data:fin,error:fe}=await vfaSupabase.from("financial_records").select("*");
  if(fe)throw new Error(`financial_records: ${fe.message}`);
  payments=(fin||[]).map(x=>({id:x.id,studentId:students.find(s=>s.dbId===x.student_id)?.id||x.student_id,date:x.payment_date||x.date||"",period:x.payment_period||x.term||x.period||"",amount:Number(x.amount_paid??x.amount??0),balance:Number(x.balance??0),amountDue:Number(x.amount_due??x.total_due??0)})).sort((a,b)=>String(a.date).localeCompare(String(b.date)));

  const {data:ex,error:ee}=await vfaSupabase.from("exam_timetable").select("*");
  if(ee)throw new Error(`exam_timetable: ${ee.message}`);
  exams=(ex||[]).map(x=>({id:x.id,grade:classMap[x.class_id]||x.class_name||"",date:x.exam_date||x.date||"",subject:subMap[x.subject_id]||x.subject||"",time:[x.start_time||x.time_start,x.end_time||x.time_end].filter(Boolean).join(" - ")||x.time||"",room:x.room||x.location||""})).sort((a,b)=>String(a.date).localeCompare(String(b.date)));

  const {data:as,error:ase}=await vfaSupabase.from("assignments").select("*");
  if(ase)throw new Error(`assignments: ${ase.message}`);
  assignments=(as||[]).map(x=>({id:x.id,title:x.title||"",body:x.description||x.message||x.body||"",due:x.due_date||x.date||"",subject:subMap[x.subject_id]||x.subject||"",audience:classMap[x.class_id]||"All Students",createdAt:x.created_at||x.created_on||x.date||x.due_date||""})).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));

  const {data:an,error:ane}=await vfaSupabase.from("announcements").select("*");
  if(ane)throw new Error(`announcements: ${ane.message}`);
  announcements=(an||[]).map(x=>({id:x.id,title:x.title||"",body:x.message||x.description||x.body||"",date:String(x.created_at||x.created_on||x.announcement_date||x.date||"").slice(0,10),audience:x.publish_to_all===true?"All Students":(classMap[x.target_class_id]||"All Students"),createdAt:x.created_at||x.created_on||x.announcement_date||x.date||""})).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));

  const {data:sg,error:sge}=await vfaSupabase.from("admin_suggestions").select("*");
  if(sge)throw new Error(`admin_suggestions: ${sge.message}`);
  suggestions=(sg||[]).map(x=>({id:x.id,title:x.title||"",body:x.message||x.description||x.body||"",date:String(x.created_at||x.created_on||x.suggestion_date||x.date||"").slice(0,10),audience:classMap[x.target_class_id]||"All Students",by:x.created_by||x.author||currentAdmin?.name||"Administration",createdAt:x.created_at||x.created_on||x.suggestion_date||x.date||""})).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));

  const {data:sr,error:sre}=await vfaSupabase.from("scale_your_child").select("*");
  if(sre)throw new Error(`scale_your_child: ${sre.message}`);
  scaleResponses=(sr||[]).map(x=>{const st=students.find(s=>s.dbId===x.student_id),r=x.response||{};return {id:x.id,studentName:st?.name||"Student",studentGrade:st?.grade||"",date:String(x.created_at||x.created_on||x.date||"").slice(0,10),checks:Array.isArray(r.checks)?r.checks:[],note:r.note||"",reviewed:!!r.reviewed,response:r};});

  const {data:sa,error:sae}=await vfaSupabase.from("staff_attendance").select("*");
  if(sae)throw new Error(`staff_attendance: ${sae.message}`);
  staffAttendance=(sa||[]).map(x=>({id:x.id,staffId:x.staff_id||x.staffId,date:x.date||x.attendance_date||"",status:String(x.status||"").toLowerCase(),time:x.check_in_time||x.time||x.check_in||""}));
}
async function loadVfaRemote(){
 const user=(await vfaSupabase.auth.getUser()).data.user;if(!user)throw new Error("No authenticated admin user.");
 const {data:admins,error:ae}=await vfaSupabase.from('admin_profiles').select('*').eq('auth_user_id',user.id).limit(1);if(ae)throw new Error(`admin_profiles: ${ae.message}`);if(admins?.[0])currentAdmin={...currentAdmin,name:admins[0].full_name,role:admins[0].role};
 const {data:classesDb,error:ce}=await vfaSupabase.from('classes').select('*');if(ce)throw new Error(`classes: ${ce.message}`);classRows=classesDb||[];
 const {data:staffDb,error:se}=await vfaSupabase.from('staff').select('*');if(se)throw new Error(`staff: ${se.message}`);staff=(staffDb||[]).map(x=>({dbId:x.id,id:x.id,name:x.full_name,position:x.position||'',phone:x.phone||''}));
 const {data:studentsDb,error:ste}=await vfaSupabase.from('students').select('*');if(ste)throw new Error(`students: ${ste.message}`);const classById=Object.fromEntries(classRows.map(x=>[x.id,x.name]));students=(studentsDb||[]).map(x=>({dbId:x.id,id:x.student_code||'',name:x.full_name,grade:classById[x.class_id]||'',parent:x.parent_name||'',parentPhone:x.parent_phone||'',sponsor:(staff.find(t=>t.id===x.sponsor_id)||{}).name||'',sponsorId:x.sponsor_id||'',status:x.is_active?'Active':'Inactive',schoolYear:x.school_year||'',password:x.portal_password||'',idCard:x.id_card_path||'',auth_user_id:x.auth_user_id}));
 const {data:subs,error:sube}=await vfaSupabase.from('subjects').select('*');if(sube)throw new Error(`subjects: ${sube.message}`);subjectRows=(subs||[]).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));const {data:pers,error:pe}=await vfaSupabase.from('academic_periods').select('*');if(pe)throw new Error(`academic_periods: ${pe.message}`);periodRows=(pers||[]).sort((a,b)=>Number(a.sort_order??0)-Number(b.sort_order??0));
 const {data:gr,error:ge}=await vfaSupabase.from('grades').select('*');if(ge)throw new Error(`grades: ${ge.message}`);const {data:meta,error:me}=await vfaSupabase.from('student_period_results').select('*');if(me)throw new Error(`student_period_results: ${me.message}`);const subById=Object.fromEntries(subjectRows.map(x=>[x.id,x.name])),perById=Object.fromEntries(periodRows.map(x=>[x.id,x.period_name])),byDb=Object.fromEntries(students.map(x=>[x.dbId,x]));gradesData={};(gr||[]).forEach(x=>{const st=byDb[x.student_id];if(st)gradesData[`${st.id}|${subById[x.subject_id]}|${perById[x.period_id]}`]=x.score;});reportMeta={};(meta||[]).forEach(x=>{const st=byDb[x.student_id];const p=periodRows.find(y=>y.id===x.period_id);if(st&&p){const sem=p.semester===2?'second':'first';reportMeta[`${st.id}|${sem}|${p.period_name}`]={average:x.average,rank:x.rank,conduct:x.conduct||''};}});
 await refreshRemoteContent();return true;
}
async function syncVfaStudents(){
 const targets=students;
 for(const s of targets){
  const cls=classRows?.find(c=>c.name===s.grade)||null;
  const sponsor=staff.find(t=>t.name===s.sponsor)||null;
  const payload={full_name:s.name,student_code:s.id,class_id:cls?.id||null,sponsor_id:sponsor?.id||null,parent_name:s.parent||null,parent_phone:s.parentPhone||null,school_year:s.schoolYear||null,portal_password:s.password||null,is_active:s.status!=='Inactive'};
  if(!s.dbId){
   const {data:row,error}=await vfaSupabase.from("students").insert(payload).select().single();
   if(error)throw error;
   s.dbId=row.id;
  }else{
   const {error}=await vfaSupabase.from("students").update(payload).eq("id",s.dbId);
   if(error)throw error;
  }

  // Create once, then keep the same Auth user. If the alphabetical student code
  // changes later, only the internal Auth email changes; the password does not.
  if(!s.auth_user_id && s.password){
   const {data:functionData,error:functionError}=await vfaSupabase.functions.invoke("bright-api",{
    body:{action:"create",studentId:s.id,password:s.password,fullName:s.name,studentDbId:s.dbId}
   });
   if(functionError)throw new Error(functionError.message || "Student account function failed.");
   if(functionData?.error)throw new Error(functionData.error);
   if(functionData?.studentAuthUserId)s.auth_user_id=functionData.studentAuthUserId;
  }else if(s.auth_user_id){
   const {data:functionData,error:functionError}=await vfaSupabase.functions.invoke("bright-api",{
    body:{action:"sync",studentId:s.id,fullName:s.name,studentDbId:s.dbId,authUserId:s.auth_user_id}
   });
   if(functionError)throw new Error(functionError.message || "Student account sync failed.");
   if(functionData?.error)throw new Error(functionData.error);
  }
 }
}
async function syncVfaGrades(){
 const subs=subjectRows.length?subjectRows:await vfaSupabase.from('subjects').select('*').then(r=>r.data||[]); const pers=periodRows.length?periodRows:await vfaSupabase.from('academic_periods').select('*').then(r=>r.data||[]);
 subjectRows=subs;periodRows=pers;const sb=Object.fromEntries(subs.map(x=>[x.name,x]));const pb=Object.fromEntries(pers.map(x=>[x.period_name,x]));const by=Object.fromEntries(students.map(x=>[x.id,x]));
 const rows=[];for(const [k,v] of Object.entries(gradesData)){const [sid,sub,per]=k.split('|'),st=by[sid];if(st?.dbId&&sb[sub]?.id&&pb[per]?.id&&v!=='')rows.push({student_id:st.dbId,subject_id:sb[sub].id,period_id:pb[per].id,score:Number(v)});} if(rows.length){const {error}=await vfaSupabase.from('grades').upsert(rows,{onConflict:'student_id,subject_id,period_id'});if(error)throw error;}
 const metaRows=[];for(const [k,m] of Object.entries(reportMeta)){const [sid,sem,per]=k.split('|'),st=by[sid],p=pb[per];if(st?.dbId&&p?.id&&m&&(m.average!==undefined||m.rank!==undefined||m.conduct!==undefined))metaRows.push({student_id:st.dbId,period_id:p.id,average:m.average===''?null:Number(m.average),rank:m.rank===''?null:Number(m.rank),conduct:m.conduct||null});} if(metaRows.length){const {error}=await vfaSupabase.from('student_period_results').upsert(metaRows,{onConflict:'student_id,period_id'});if(error)throw error;}
}
const oldSave=save;
// Supabase is the shared source of truth for administrator records.
// Administrator profile ID-card upload (stored locally until Supabase Storage is connected)
function loadAdminIdCard(){
 const key=`vfaAdminIdCard:${currentAdmin?.id||""}`; const data=localStorage.getItem(key); const preview=$("adminIdCardPreview"); if(!preview)return;
 preview.innerHTML=data?`<img src="${data}" alt="Administrator ID card">`:"<p class=\"muted\">No ID card uploaded.</p>";
 if($("adminProfileName"))$("adminProfileName").textContent=currentAdmin?.name||"";
 if($("adminProfileId"))$("adminProfileId").textContent=currentAdmin?.id||"";
 if($("adminProfileRole"))$("adminProfileRole").textContent=currentAdmin?.role||"";
 if($("adminProfilePosition"))$("adminProfilePosition").textContent=currentAdmin?.position||"";
}
function bindAdminIdCard(){
 $("adminIdCardInput")?.addEventListener("change",e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){ $("adminIdCardMessage").textContent="Please choose an image file.";return;}const reader=new FileReader();reader.onload=()=>{localStorage.setItem(`vfaAdminIdCard:${currentAdmin.id}`,reader.result);$("adminIdCardMessage").textContent="ID card uploaded.";loadAdminIdCard();};reader.readAsDataURL(file);});
 $("removeAdminIdCard")?.addEventListener("click",()=>{localStorage.removeItem(`vfaAdminIdCard:${currentAdmin.id}`);$("adminIdCardInput").value="";$("adminIdCardMessage").textContent="ID card removed.";loadAdminIdCard();});
 loadAdminIdCard();
}
const _origStaffLogin=$("staffLoginForm").onsubmit;
$("staffLoginForm").onsubmit=e=>{_origStaffLogin(e);if(currentAdmin){setTimeout(bindAdminIdCard,0)}};
