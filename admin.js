const ADMIN_ACCOUNTS=[
{id:"VFA-BISHOP",email:"bishopandrew352@gmail.com",name:"Bishop Andrew Gombay Sr",role:"Admin",position:"Owner",department:"Administration"},
{id:"VFA-JUE",email:"juecarmo6@gmail.com",name:"Jue Carmo",role:"Admin",position:"Assistant Administrator",department:"Administration"},
{id:"VFA-JONATHAN",email:"jaygombay35@gmail.com",name:"Jonathan Gombay",role:"Administrator",position:"Administrator",department:"Administration"}
];const BASE_ID="0020172";
const classes=["Daycare","Nursery","Kindergarten 1","Kindergarten 2",...Array.from({length:9},(_,i)=>`Grade ${i+1}`)];
const DEFAULT_FEE_MAP={"Daycare":[10000,7000,2500],"Nursery":[10000,3000,2400],"Kindergarten 1":[10000,3000,2400],"Kindergarten 2":[10000,3000,2400],"Grade 1":[10500,6750,2250],"Grade 2":[10500,6750,2250],"Grade 3":[11500,8250,2250],"Grade 4":[11500,8250,2250],"Grade 5":[11500,8250,2250],"Grade 6":[14100,7250,2250],"Grade 7":[14100,8250,2000],"Grade 8":[15500,8000,2000],"Grade 9":[15500,8000,2000]};
const subjects=["Bible","English","Mathematics","General Science","Social Studies","Writing","Phonics","Computer","Physical Education","Spelling","Reading","Drawing","Arts/Craft"];
const periods={first:["1st Period","2nd Period","3rd Period","Exam"],second:["4th Period","5th Period","6th Period","Exam"]};
let classRows=[],subjectRows=[],periodRows=[];
// One-time cleanup of legacy browser-stored school/demo records.
// Supabase is the source of truth for the migrated records.
const VFA_CLEANUP_VERSION="2026-08-31-clean-1";
const VFA_STUDENT_PASSWORDS_KEY="vfaStudentPortalPasswordsV1";
if(localStorage.getItem("vfaCleanupVersion")!==VFA_CLEANUP_VERSION){
  ["vfaAdminStudents","vfaAdminPayments","vfaGrades","vfaExams","vfaAssignments","vfaAdminAnnouncements","vfaAdminSuggestions","vfaScaleResponses","vfaStaff","vfaStaffAttendance","vfaReportMeta"].forEach(k=>localStorage.removeItem(k));
  localStorage.setItem("vfaCleanupVersion",VFA_CLEANUP_VERSION);
}
const get=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}};
let students=[];
let pendingStudentIds=new Set();
let payments=[];
let feeStructures=[];
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
const VFA_ADMIN_SESSION_KEY_STORAGE="vfaAdminSessionLockKeyV1";
function getVfaAdminSessionKey(){
  const keyName=`${VFA_ADMIN_SESSION_KEY_STORAGE}:${location.origin}`;
  let key=localStorage.getItem(keyName);
  if(!key){
    key=(globalThis.crypto?.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(keyName,key);
  }
  return key;
}
async function acquireVfaAdminSessionLock(){
  const {data,error}=await vfaSupabase.rpc("vfa_acquire_admin_session",{p_session_key:getVfaAdminSessionKey()});
  if(error)throw new Error(error.message||"This VFA administrator account is already signed in on another device. Please log out there before signing in here.");
  if(data?.ok!==true)throw new Error("This VFA administrator account is already signed in on another device. Please log out there before signing in here.");
}
async function releaseVfaAdminSessionLock(){
  try{await vfaSupabase.rpc("vfa_release_admin_session",{p_session_key:getVfaAdminSessionKey()});}catch(err){console.warn("VFA admin session lock release failed:",err);}
}
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
function getStoredStudentPasswords(){
 try{return JSON.parse(localStorage.getItem(VFA_STUDENT_PASSWORDS_KEY)||"{}")}catch{return {}}
}
function saveStoredStudentPasswords(map){
 try{localStorage.setItem(VFA_STUDENT_PASSWORDS_KEY,JSON.stringify(map))}catch{}
}
function getStudentPassword(id){
 if(!id)return "";
 return getStoredStudentPasswords()[id]||"";
}
function rememberStudentPassword(id,password){
 if(!id||!password)return;
 const map=getStoredStudentPasswords(); map[id]=password; saveStoredStudentPasswords(map);
}
async function loadServerStudentPasswords(){
 try{
  const {data,error}=await vfaSupabase.functions.invoke("bright-api",{body:{action:"get_passwords"}});
  if(error||data?.error)throw new Error(error?.message||data?.error||"Password vault could not be loaded.");
  const serverPasswords=data?.passwords||{};
  Object.entries(serverPasswords).forEach(([id,password])=>{const student=students.find(x=>x.id===id);if(student&&password)student.password=password;});
  return serverPasswords;
 }catch(err){console.warn("Could not load server-side student passwords:",err);return {};}
}
async function saveServerStudentPassword(studentId,password){
 if(!studentId||!password)return;
 const {data,error}=await vfaSupabase.functions.invoke("bright-api",{body:{action:"store_password",studentId,password}});
 if(error||data?.error)throw new Error(error?.message||data?.error||"Student password could not be stored securely.");
}
function formatRegistrationNumber(n){return n==null||n===""?"":String(n).padStart(3,"0");}
function makeStudentCode(n){return `${BASE_ID}${formatRegistrationNumber(n)}`;}
function registrationFromCode(id){const m=String(id||"").match(/(\d{3})$/);return m?Number(m[1]):null;}
function sortStudentsForDisplay(list,mode){
 const copy=[...list];
 if(mode==="registration") return copy.sort((a,b)=>Number(a.registration_number??registrationFromCode(a.id)??999999)-Number(b.registration_number??registrationFromCode(b.id)??999999));
 return copy.sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base"}));
}

function fillSelect(id,items,selected){
 const el=$(id); if(!el)return;
 el.innerHTML=items.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
 if(selected && items.includes(selected))el.value=selected;
}
function init(){
 // Passwords are assigned only once for newly created students. Remote students load their stored password.
 students.forEach(s=>{if(!s.dbId&&!s.password)s.password=makePassword(); if(s.id&&!s.password){const saved=getStudentPassword(s.id);if(saved)s.password=saved;}});
 if(!students.length) localStorage.removeItem("vfaAdminStudents");
 fillSelect("studentClass",["All Classes",...classes],"All Classes");
 fillSelect("gradeClass",classes); fillFinanceClassSelect(); fillSelect("examGrade",classes);
 fillSelect("assignmentAudience",["All Students",...classes]);
 fillSelect("announcementAudience",["All Students",...classes]);
 fillSelect("suggestionAudience",["All Students",...classes]);
 $("staffDate").value=today();
 $("announcementDate").value=today();
 renderAll();
}

function fillFinanceClassSelect(selected){
 const el=$("financeClass");if(!el)return;
 const groups=[
  ["Daycare",["Daycare"]],
  ["Nursery K1–K2",["Nursery","Kindergarten 1","Kindergarten 2"]],
  ["Grade 1–2",["Grade 1","Grade 2"]],
  ["Grade 3–5",["Grade 3","Grade 4","Grade 5"]],
  ["Grade 6",["Grade 6"]],
  ["Grade 7",["Grade 7"]],
  ["Grade 8–9",["Grade 8","Grade 9"]]
 ];
 el.innerHTML=groups.map(([label,names])=>`<optgroup label="${esc(label)}">${names.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("")}</optgroup>`).join("");
 if(selected && classes.includes(selected))el.value=selected;
}

function renderAll(){
 renderHome();renderStudents();renderGrades();renderFinanceClass();renderExams();renderAssignments();renderAnnouncements();renderScale();renderSuggestions();renderStaff();
 loadScaleStatements();
}
$("staffLoginForm").onsubmit=async e=>{
 e.preventDefault();
 const id=$("staffId").value.trim(),pw=$("staffPassword").value;
 const account=ADMIN_ACCOUNTS.find(a=>a.id===id);
 currentAdmin=account||null;
 if(!account){$("loginMessage").textContent="Incorrect Admin ID or password.";return}
 $("loginMessage").textContent="Signing in…";
 try{
   const {data,error}=await vfaSupabase.auth.signInWithPassword({
     email:account.email,
     password:pw
   });
   if(error) throw error;
   if(!data?.session?.user) throw new Error("Supabase login succeeded but no browser session was created.");
   await showVerifiedAdminPanel();
   $("loginMessage").textContent="";
 }catch(err){
   console.error("VFA administrator authentication failed:",err);
   await vfaSupabase.auth.signOut();
   currentAdmin=null;
   $("loginMessage").textContent="Admin login failed: "+(err?.message||String(err));
 }
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
    await requireVerifiedAdminSession();
    if(!students.length){alert("There are no students to save.");return;}
    await syncVfaStudents();
    await syncVfaGrades();
    pendingStudentIds.clear();
    renderAll();
    const pendingAuth=students.filter(s=>s.auth_sync_error).length; alert(pendingAuth?`Students saved successfully to the school database. ${pendingAuth} student portal account${pendingAuth===1?"":"s"} still need account sync.`:"Students saved successfully to the school database.");
  }catch(err){
    console.error("Student save failed:",err);
    alert("The students could not be saved to the school database: "+err.message);
  }
};
$("studentClass").onchange=renderStudents;$("studentSearch").oninput=renderStudents;$("studentSort").onchange=renderStudents;
async function generateExistingStudentPasswords(){
  await requireVerifiedAdminSession();
  const existing=students.filter(s=>s.dbId && s.id);
  if(!existing.length){alert("There are no saved students with portal accounts to update.");return;}
  const stored=getStoredStudentPasswords();
  const missing=existing.filter(s=>!stored[s.id]);
  if(!missing.length){renderStudents();alert("All existing students already have assigned passwords. Their passwords were not changed.");return;}
  if(!confirm(`Assign passwords to ${missing.length} existing students that do not have a saved password yet? Existing assigned passwords will NOT be changed.`))return;
  const btn=$("generateExistingPasswords");
  const old=btn.innerHTML; btn.disabled=true; btn.setAttribute("aria-busy","true");
  btn.innerHTML='<span class="vfa-button-spinner" aria-hidden="true"></span> Assigning Passwords…';
  let completed=0; const failures=[];
  try{
    for(const s of missing){
      const password=makePassword();
      const action=s.auth_user_id?"sync":"create";
      const {data,error}=await vfaSupabase.functions.invoke("bright-api",{body:{action,studentDbId:s.dbId,studentId:s.id,fullName:s.name,password,authUserId:s.auth_user_id||undefined}});
      if(error)throw new Error(error.message||"Student portal account request failed.");
      if(data?.error)throw new Error(data.error);
      s.password=password;
      rememberStudentPassword(s.id,password);
      await saveServerStudentPassword(s.id,password);
      if(data?.studentAuthUserId)s.auth_user_id=data.studentAuthUserId;
      s.auth_sync_error=false;
      completed++;
      renderStudents();
    }
    renderAll();
    btn.innerHTML='<span class="vfa-button-check" aria-hidden="true">✓</span> Passwords Assigned';
    alert(`Assigned passwords to ${completed} existing student${completed===1?"":"s"}. These passwords will stay assigned and will not be regenerated by refresh or normal saves.`);
  }catch(err){
    console.error("Existing student password assignment failed:",err);
    alert(`Password assignment stopped after ${completed} student${completed===1?"":"s"}. ${err.message||err}`);
    renderStudents();
    btn.innerHTML='<span class="vfa-button-error" aria-hidden="true">!</span> Assignment Failed';
  }finally{
    btn.disabled=false; btn.removeAttribute("aria-busy");
    setTimeout(()=>{btn.innerHTML=old;},1400);
  }
}
$("generateExistingPasswords").onclick=async()=>{try{await generateExistingStudentPasswords();}catch(err){console.error(err);alert("Could not generate student passwords: "+(err.message||err));}};

function renderStudents(){
 const cls=$("studentClass").value,q=($("studentSearch").value||"").trim().toLowerCase(),mode=$("studentSort")?.value||"alphabetical";
 const filtered=students.filter(s=>(!cls||cls==="All Classes"||s.grade===cls)&&(!q||`${s.name||""} ${s.id||""}`.toLowerCase().includes(q)));
 const list=sortStudentsForDisplay(filtered,mode);
 $("studentRows").innerHTML=list.map(s=>{const reg=s.registration_number??registrationFromCode(s.id);const displayId=s.id||"Assigned on save";const key=s.id||s._localId;return `<tr><td><strong>${esc(displayId)}</strong><small class="student-reg">${reg?`Registration ${esc(formatRegistrationNumber(reg))}`:""}</small></td><td><button class="link-button" onclick="openStudentRecord('${esc(key)}')">${esc(s.name)}</button></td><td>${esc(s.grade)}</td><td>${esc(s.registrationDate||"")}</td><td>${esc(s.sex||"—")}</td><td>${esc(s.enrollmentStatus||"—")}</td><td>${esc(s.parent||"")}</td><td>${esc(s.parentPhone||"")}</td><td><code>${esc(s.password||"")}</code></td><td>${esc(s.status||"Active")}</td><td class="row-actions"><button class="icon-btn" onclick="openStudentForm('${esc(key)}')">✏️</button>${s.dbId?`<button class="icon-btn danger" onclick="deleteStudent('${esc(s.id)}')">🗑️</button>`:""}</td></tr>`}).join("")||'<tr><td colspan="11" class="empty">No students in this class.</td></tr>';
}

function openStudentForm(id){
 const s=students.find(x=>x.id===id||x._localId===id);
 const grade=s?.grade||$("studentClass").value||classes[0];
 const registrationDate=s?.registrationDate||today();
 const enrollmentStatus=s?.enrollmentStatus||"New";
 openModal(id?"Edit Student":"Add Student",`<form id="studentForm" class="form-grid student-form">
 <label class="full">Student Full Name<input name="name" value="${esc(s?.name||"")}" required></label>
 <label>Class<select name="grade">${classes.map(c=>`<option ${c===grade?"selected":""}>${esc(c)}</option>`).join("")}</select></label>
 <label>Registration Date<input name="registrationDate" type="date" value="${esc(registrationDate)}" required></label>
 <label>Sex<select name="sex"><option value="">Select sex</option><option value="Male" ${s?.sex==="Male"?"selected":""}>Male</option><option value="Female" ${s?.sex==="Female"?"selected":""}>Female</option></select></label>
 <label>Enrollment Status<select name="enrollmentStatus"><option value="New" ${enrollmentStatus==="New"?"selected":""}>New</option><option value="Old" ${enrollmentStatus==="Old"?"selected":""}>Old</option></select></label>
 <label>Parent / Guardian<input name="parent" value="${esc(s?.parent||"")}" placeholder="Parent or guardian name"></label>
 <label>Parent Phone Number<input name="parentPhone" value="${esc(s?.parentPhone||"")}" placeholder="Phone number"></label>
 <label>Sponsor / Class Teacher<select name="sponsor"><option value="">Select staff member</option>${staff.map(t=>{const n=t.name||t.fullName||t.staffName||"";return `<option value="${esc(n)}" ${n===(s?.sponsor||"")?"selected":""}>${esc(n)}</option>`}).join("")}</select></label>
 <label>Portal Status<select name="status"><option ${s?.status!=="Inactive"?"selected":""}>Active</option><option ${s?.status==="Inactive"?"selected":""}>Inactive</option></select></label>
 <label>School Year<input name="schoolYear" value="${esc(s?.schoolYear||"2026/2027")}" required></label>
 <label class="full"><input name="scholarship" type="checkbox" ${s?.scholarship?"checked":""}> Scholarship Student — No tuition payment required</label>
 <label class="full">ID Card Upload<div class="student-id-upload-box"><input id="studentIdCardUpload" name="idCard" type="file" accept="image/*"><small>Upload this student's ID card. The image will appear in the student's Profile tab.</small><div id="studentIdCardUploadPreview" class="student-id-upload-preview">${s?.idCard?`<img src="${esc(s.idCard)}" alt="Current student ID card"><button type="button" class="icon-btn danger" id="removeStudentIdCard">Remove ID Card</button>`:"<span class=\"muted\">No ID card saved yet.</span>"}</div></div></label>
 <div class="credential-box full"><strong>Portal Registration</strong><p>Registration Number: <code>${esc(s?.registration_number?formatRegistrationNumber(s.registration_number):"Assigned on save")}</code></p><p>Student ID: <code>${esc(s?.id||"Assigned automatically")}</code></p><p>Password: <code id="newStudentPassword">${esc(s?.password||"Will be generated automatically")}</code></p><small>The school's register numbers (001, 002, 003...) are permanent school-wide registration numbers. The portal Student ID combines the fixed prefix ${BASE_ID} with that three-digit registration number. Moving a student to another class does not change the ID, and deleted numbers are never recycled.</small></div>
 <div class="submit-row"><button class="primary" type="submit">${id?"Save Student":"Add Student"}</button></div></form>`);
 $("studentForm").onsubmit=async e=>{
   e.preventDefault();
   const f=new FormData(e.target);
   const submitBtn=e.target.querySelector('button[type="submit"]');
   if(submitBtn){submitBtn.disabled=true;submitBtn.textContent="Saving Student…";}
   try{
     await requireVerifiedAdminSession();
     let target=s;
     if(id){
       Object.assign(target,{name:f.get("name").trim(),grade:f.get("grade"),registrationDate:f.get("registrationDate")||today(),sex:f.get("sex")||"",enrollmentStatus:f.get("enrollmentStatus")||"New",parent:f.get("parent").trim(),parentPhone:f.get("parentPhone").trim(),sponsor:f.get("sponsor").trim(),status:f.get("status"),schoolYear:f.get("schoolYear").trim(),scholarship:f.get("scholarship")==="on"});
       if(!target.registration_number)target.registration_number=registrationFromCode(target.id);
     }else{
       target={id:"",_localId:`new-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,registration_number:null,name:f.get("name").trim(),grade:f.get("grade"),registrationDate:f.get("registrationDate")||today(),sex:f.get("sex")||"",enrollmentStatus:f.get("enrollmentStatus")||"New",parent:f.get("parent").trim(),parentPhone:f.get("parentPhone").trim(),sponsor:f.get("sponsor").trim(),status:f.get("status"),schoolYear:f.get("schoolYear").trim(),scholarship:f.get("scholarship")==="on",password:makePassword(),idCard:""};
       students.push(target);
     }

     const file=f.get("idCard");
     if(file && file.size && file.type.startsWith("image/")){
       target.idCard=await new Promise((resolve,reject)=>{
         const reader=new FileReader();
         reader.onload=()=>resolve(reader.result);
         reader.onerror=()=>reject(new Error("The ID card image could not be read."));
         reader.readAsDataURL(file);
       });
     }

     pendingStudentIds.add(target.dbId||target.id||target._localId);
     await syncVfaStudents([target]);
     await refreshRemoteContent();
     pendingStudentIds.delete(target.dbId||target.id||target._localId);
     closeModal();
     fillSelect("studentClass",["All Classes",...classes],$("studentClass").value);
     renderAll();
     alert(id?"Student updated successfully and saved to the school database.":"Student added successfully and saved to the school database.");
   }catch(err){
     console.error("Student save failed:",err);
     alert("The student could not be saved to the school database: "+err.message);
   }finally{
     if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=id?"Save Student":"Add Student";}
   }
 };
 $("removeStudentIdCard")?.addEventListener("click",async()=>{
   if(!s)return;
   if(!confirm("Remove this student's saved ID card?"))return;
   s.idCard="";
   $("studentIdCardUpload").value="";
   $("studentIdCardUploadPreview").innerHTML='<span class="muted">ID card will be removed when you save this student.</span>';
 });
 $("studentIdCardUpload")?.addEventListener("change",e=>{
   const picked=e.target.files?.[0];
   if(!picked||!picked.type.startsWith("image/"))return;
   const reader=new FileReader();
   reader.onload=()=>{$("studentIdCardUploadPreview").innerHTML=`<img src="${esc(reader.result)}" alt="Selected student ID card"><span class="muted">Selected. Click Save Student to store it in Supabase.</span>`;};
   reader.readAsDataURL(picked);
 });

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
   renderAll();
   alert("Student deleted successfully from the school database. Existing registration numbers were not changed or recycled.");
 }catch(err){console.error(err);alert("The student could not be deleted from the school database: "+err.message);}
};

window.openStudentRecord=id=>{const s=students.find(x=>x.id===id||x._localId===id);if(!s)return;const reg=s.registration_number??registrationFromCode(s.id);openModal(`${s.name} — Student Record`,`<div class="record-grid"><div><strong>Student ID</strong><span>${esc(s.id||"Assigned on save")}</span></div><div><strong>Registration Number</strong><span>${esc(reg?formatRegistrationNumber(reg):"Assigned on save")}</span></div><div><strong>Registration Date</strong><span>${esc(s.registrationDate||"—")}</span></div><div><strong>Sex</strong><span>${esc(s.sex||"—")}</span></div><div><strong>Enrollment Status</strong><span>${esc(s.enrollmentStatus||"—")}</span></div><div><strong>Class</strong><span>${esc(s.grade)}</span></div><div><strong>Parent / Guardian</strong><span>${esc(s.parent||"")}</span></div><div><strong>Parent Phone</strong><span>${esc(s.parentPhone||"")}</span></div><div><strong>Sponsor / Class Teacher</strong><span>${esc(s.sponsor||"—")}</span></div><div><strong>Portal Status</strong><span>${esc(s.status||"Active")}</span></div><div><strong>Portal Password</strong><span><code>${esc(s.password)}</code></span></div><div><strong>School Year</strong><span>${esc(s.schoolYear||"")}</span></div><div><strong>Scholarship</strong><span>${s.scholarship?"Yes — No tuition required":"No"}</span></div></div><div class="sheet-toolbar"><button class="secondary" onclick="openStudentForm('${esc(s.id||s._localId)}')">Edit Student</button></div>`);};

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

function financeRowsFor(studentId){
 const year=$("financeYear")?.value.trim()||"2026/2027";
 return payments.filter(p=>p.studentId===studentId&&(!p.schoolYear||p.schoolYear===year)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function selectedFeeStructure(){
 const cls=classRows.find(c=>c.name===$("financeClass").value);
 const year=$("financeYear").value.trim()||"2026/2027";
 return feeStructures.find(f=>f.classId===cls?.id&&f.schoolYear===year)||null;
}
function feeAmountFor(structure,period){
 if(!structure)return 0;
 return period==="1st Payment"?Number(structure.first||0):period==="2nd Payment"?Number(structure.second||0):period==="3rd Payment"?Number(structure.third||0):0;
}
function studentFinanceSummary(studentId){
 const s=students.find(x=>x.id===studentId);
 const cls=classRows.find(c=>c.name===s?.grade);
 const year=$("financeYear")?.value.trim()||s?.schoolYear||"2026/2027";
 const structure=feeStructures.find(f=>f.classId===cls?.id&&f.schoolYear===year)||null;
 const rows=financeRowsFor(studentId);
 const required=structure?Number(structure.total||0):0;
 const paid=rows.reduce((a,p)=>a+Number(p.amount||0),0);
 return {structure,rows,required,paid,balance:Math.max(0,required-paid),scholarship:false,schoolYear:year};
}
function renderFeeSetup(){
 const cls=classRows.find(c=>c.name===$("financeClass").value);
 const year=$("financeYear").value.trim()||"2026/2027";
 const f=feeStructures.find(x=>x.classId===cls?.id&&x.schoolYear===year)||null;
 $("feeSetupTitle").textContent=cls?.name||"Select a class";
 $("fee1").value=f?.first??"";
 $("fee2").value=f?.second??"";
 $("fee3").value=f?.third??"";
 updateFeeTotal();
}
function updateFeeTotal(){
 const t=["fee1","fee2","fee3"].reduce((a,id)=>a+Number($(id)?.value||0),0);
 $("feeTotal").textContent=`LD ${t.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
["fee1","fee2","fee3"].forEach(id=>$(id)?.addEventListener("input",updateFeeTotal));
$("financeClass").onchange=()=>{renderFeeSetup();renderFinanceClass()};
$("financeSearch").oninput=renderFinanceClass;
$("financeYear").oninput=()=>{renderFeeSetup();renderFinanceClass()};
$("saveFeeStructure").onclick=async()=>{
 const cls=classRows.find(c=>c.name===$("financeClass").value);
 if(!cls)return alert("Select a class first.");
 const schoolYear=$("financeYear").value.trim()||"2026/2027";
 const first=Number($("fee1").value||0),second=Number($("fee2").value||0),third=Number($("fee3").value||0);
 if([first,second,third].some(v=>!Number.isFinite(v)||v<0))return alert("Fee amounts cannot be negative.");
 try{
  await requireVerifiedAdminSession();
  const {error}=await vfaSupabase.from("fee_structures").upsert({class_id:cls.id,school_year:schoolYear,first_payment:first,second_payment:second,third_payment:third,amount_due:first+second+third},{onConflict:"class_id,school_year"});
  if(error)throw error;
  await refreshRemoteContent();
  renderFeeSetup();renderFinanceClass();
  $("feeMessage").textContent="Fee structure saved to the school database.";
  setTimeout(()=>$("feeMessage").textContent="",2500);
 }catch(err){console.error(err);alert("Could not save the fee structure: "+err.message)}
};
function fmtLD(n){return `LD ${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function renderFinanceClass(){
 const cls=$("financeClass").value,q=($("financeSearch").value||"").trim().toLowerCase();
 const list=students.filter(s=>s.grade===cls&&(!q||`${s.name||""} ${s.id||""}`.toLowerCase().includes(q)));
 $("financeClassRows").innerHTML=list.map(s=>{const x=studentFinanceSummary(s.id);return `<tr><td><button class="link-button" onclick="openFinance('${esc(s.id)}')">${esc(s.name)}</button></td><td>${esc(s.id)}</td><td>${esc(s.grade)}</td><td>${fmtLD(x.required)}</td><td>${fmtLD(x.paid)}</td><td class="${x.balance===0?'success':'warning'}">${fmtLD(x.balance)}</td><td><button class="secondary small" onclick="openFinance('${esc(s.id)}')">Open Sheet</button></td></tr>`}).join("")||'<tr><td colspan="7" class="empty">No students in this class.</td></tr>';
}
function financeInstallments(studentId){
 const x=studentFinanceSummary(studentId),f=x.structure||{first:0,second:0,third:0};
 return ["1st Payment","2nd Payment","3rd Payment"].map(period=>{
  const required=feeAmountFor(f,period);
  const paid=x.rows.filter(r=>r.period===period).reduce((a,p)=>a+Number(p.amount||0),0);
  return {period,required,paid,balance:Math.max(0,required-paid)};
 });
}
window.openFinance=id=>{
 const s=students.find(x=>x.id===id);if(!s)return;
 const x=studentFinanceSummary(id),ins=financeInstallments(id);
 openModal(`${s.name} — Financial Record`,`<div class="record-grid"><div><strong>Student ID</strong><span>${esc(s.id)}</span></div><div><strong>Class</strong><span>${esc(s.grade)}</span></div><div><strong>School Year</strong><span>${esc(x.schoolYear)}</span></div></div>
 <div class="finance-summary"><div><span>Total Fees</span><strong>${fmtLD(x.required)}</strong></div><div><span>Total Paid</span><strong>${fmtLD(x.paid)}</strong></div><div><span>Balance</span><strong class="${x.balance===0?'success':'warning'}">${fmtLD(x.balance)}</strong></div></div>
 <div class="installment-grid">${ins.map(i=>`<div class="installment-card"><span>${i.period}</span><strong>${fmtLD(i.required)}</strong><small>Paid: ${fmtLD(i.paid)}</small><b>Balance: ${fmtLD(i.balance)}</b></div>`).join("")}</div>
 <div class="sheet-toolbar"><button class="primary" onclick="addPayment('${esc(id)}')">＋ Record Payment</button></div>
 <div class="table-wrap"><table class="spreadsheet"><thead><tr><th>Date</th><th>Payment</th><th>Amount Paid</th><th>Balance After Payment</th><th>Action</th></tr></thead><tbody>${x.rows.map(p=>`<tr><td>${esc(p.date)}</td><td>${esc(p.period||"")}</td><td>${fmtLD(p.amount)}</td><td>${fmtLD(p.balance)}</td><td><button class="icon-btn danger" onclick="deletePayment('${esc(p.id)}','${esc(id)}')">🗑️</button></td></tr>`).join("")||'<tr><td colspan="5" class="empty">No payments recorded yet.</td></tr>'}</tbody></table></div>`);
};
window.addPayment=id=>{
 const s=students.find(x=>x.id===id);if(!s)return;
 const x=studentFinanceSummary(id),ins=financeInstallments(id);
 if(!x.structure)return alert(`No fee structure has been saved for ${s.grade} for ${x.schoolYear}. Save the class fee structure first.`);
 openModal(`Record Payment — ${s.name}`,`<form id="paymentForm" class="form-grid student-form"><label>Date<input name="date" type="date" value="${today()}" required></label><label>Payment<select name="period" required>${ins.map(i=>`<option value="${i.period}" ${i.balance<=0?'disabled':''}>${i.period} — ${fmtLD(i.required)} required / ${fmtLD(i.balance)} balance</option>`).join("")}</select></label><label>Amount Paid<input name="amount" type="number" min="0.01" step="0.01" required></label><div class="credential-box full"><strong>Selected payment balance</strong><p id="selectedPaymentBalance">${fmtLD(ins.find(i=>i.balance>0)?.balance||0)}</p></div><div class="submit-row"><button class="primary" type="submit">Save Payment</button></div></form>`);
 const periodEl=$("paymentForm").querySelector('[name="period"]');
 const initial=ins.find(i=>i.period===periodEl.value)||ins.find(i=>i.balance>0)||ins[0]; if(initial)periodEl.value=initial.period;
 $("selectedPaymentBalance").textContent=fmtLD(initial?.balance||0);
 periodEl.onchange=e=>{const i=ins.find(z=>z.period===e.target.value);$("selectedPaymentBalance").textContent=fmtLD(i?.balance||0)};
 $("paymentForm").onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target),period=f.get("period"),amt=Number(f.get("amount")),i=ins.find(z=>z.period===period);
  if(!i||i.balance<=0)return alert("That payment period is already fully paid.");
  if(!Number.isFinite(amt)||amt<=0||amt>i.balance)return alert(`Enter an amount up to ${fmtLD(i.balance)}.`);
  try{
   await requireVerifiedAdminSession();
   const {error}=await vfaSupabase.from("financial_records").insert({student_id:s.dbId,school_year:x.schoolYear,record_date:f.get("date"),description:period,amount_due:i.required,amount_paid:amt});
   if(error)throw error;
   await refreshRemoteContent();closeModal();openFinance(id);renderFinanceClass();
  }catch(err){console.error(err);alert("Could not save payment to the school database: "+err.message)}
 };
};
window.deletePayment=async(pid,sid)=>{
 if(!confirm("Delete this payment record?"))return;
 try{await requireVerifiedAdminSession();const {error}=await vfaSupabase.from("financial_records").delete().eq("id",pid);if(error)throw error;await refreshRemoteContent();openFinance(sid);renderFinanceClass();}
 catch(err){alert("Could not delete payment from the school database: "+err.message)}
};

function downloadXls(filename,html){const blob=new Blob([`\ufeff${html}`],{type:"application/vnd.ms-excel"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
renderFeeSetup();

$("examGrade").onchange=renderExams;$('addExamRow').onclick=()=>addExamRow();$('saveExams').onclick=saveExamSheet;
function renderExams(){const cls=$("examGrade").value;const list=exams.filter(x=>x.grade===cls);$("examSheet").innerHTML=list.map(x=>`<tr data-id="${esc(x.id)}"><td><input class="sheet-input exam-date" type="date" value="${esc(x.date)}"></td><td><input class="sheet-input exam-subject" value="${esc(x.subject)}"></td><td><input class="sheet-input exam-time" value="${esc(x.time)}"></td><td><input class="sheet-input exam-room" value="${esc(x.room)}"></td><td><button class="icon-btn danger" onclick="removeExam('${esc(x.id)}')">🗑️</button></td></tr>`).join("")||'<tr><td colspan="5" class="empty">No exams scheduled for this class.</td></tr>';}
function addExamRow(){exams.push({id:"NEW-"+Date.now()+"-"+Math.random().toString(36).slice(2),grade:$("examGrade").value,date:"",subject:"",time:"",room:""});renderExams();}
async function reloadExamClass(classId,className){const {data,error}=await vfaSupabase.from("exam_timetable").select("id,exam_date,start_time,end_time,room,subject_id,class_id").eq("class_id",classId).order("exam_date").order("start_time");if(error)throw error;const subMap=Object.fromEntries(subjectRows.map(s=>[s.id,s.name]));exams=(data||[]).map(x=>({id:x.id,grade:className,date:x.exam_date||"",subject:subMap[x.subject_id]||"",time:[x.start_time,x.end_time].filter(Boolean).join(" - "),room:x.room||""}));renderExams();}
async function saveExamSheet(){try{await requireVerifiedAdminSession();const className=$("examGrade").value;const classRow=classRows.find(c=>c.name===className);if(!classRow)throw new Error("Class not found.");const rows=[...document.querySelectorAll("#examSheet tr[data-id]")];for(const tr of rows){const id=tr.dataset.id;const x=exams.find(e=>e.id===id);if(!x)continue;x.date=tr.querySelector(".exam-date")?.value||"";x.subject=tr.querySelector(".exam-subject")?.value.trim()||"";x.time=tr.querySelector(".exam-time")?.value.trim()||"";x.room=tr.querySelector(".exam-room")?.value.trim()||"";const blank=!x.date&&!x.subject&&!x.time&&!x.room;if(blank){if(!String(id).startsWith("NEW-")){const {error}=await vfaSupabase.from("exam_timetable").delete().eq("id",id);if(error)throw error;}continue;}if(!x.date||!x.subject)throw new Error("Each timetable entry needs both a date and subject.");const sr=subjectRows.find(q=>String(q.name||"").trim().toLowerCase()===x.subject.toLowerCase());if(!sr)throw new Error(`Subject not found: ${x.subject}`);const parts=x.time.split(/\s*(?:-|–|—)\s*/);const payload={exam_date:x.date,start_time:parts[0]||null,end_time:parts[1]||null,room:x.room||null,subject_id:sr.id,class_id:classRow.id};if(String(id).startsWith("NEW-")){const {data,error}=await vfaSupabase.from("exam_timetable").insert(payload).select("id").single();if(error)throw error;if(!data?.id)throw new Error("The timetable entry was not returned after saving.");}else{const {data,error}=await vfaSupabase.from("exam_timetable").update(payload).eq("id",id).select("id").single();if(error)throw error;if(!data?.id)throw new Error("The timetable entry was not returned after updating.");}}await reloadExamClass(classRow.id,className);alert("Examination timetable saved to the school database.");}catch(err){console.error("VFA exam timetable save failed:",err);alert("Could not save timetable: "+(err?.message||err));}}
window.removeExam=async id=>{if(String(id).startsWith("NEW-")){exams=exams.filter(x=>x.id!==id);renderExams();return;}if(!confirm("Delete this examination row? This will also remove it from the student panel."))return;try{await requireVerifiedAdminSession();const {error}=await vfaSupabase.from("exam_timetable").delete().eq("id",id);if(error)throw error;exams=exams.filter(x=>x.id!==id);renderExams();}catch(err){alert("Could not delete exam: "+(err?.message||err));}};
function audienceClassId(audience){return audience&&audience!=="All Students"?(classRows.find(c=>c.name===audience)?.id||null):null;}
function renderAssignments(){$("assignmentList").innerHTML=assignments.map(a=>`<div class="announcement-item"><div><strong>${esc(a.title)}</strong><span>${esc(a.subject||"")} • Due ${esc(a.due||"")} • ${esc(a.audience)}</span><p>${esc(a.body)}</p></div><button class="icon-btn danger" onclick="removeAssignment('${esc(a.id)}')">🗑️</button></div>`).join("")||'<p class="empty">No assignments published.</p>'}
$("addAssignment").onclick=async()=>{const title=$("assignmentTitle").value.trim(),audience=$("assignmentAudience").value,subject=$("assignmentSubject").value.trim(),due=$("assignmentDue").value,body=$("assignmentBody").value.trim();if(!title||!body)return alert("Enter an assignment title and instructions.");try{const sr=subjectRows.find(x=>x.name.toLowerCase()===subject.toLowerCase());const {data,error}=await vfaSafeInsert("assignments",{title,description:body,due_date:due||null,class_id:audienceClassId(audience),subject_id:sr?.id||null},["due_date","class_id","subject_id"]);if(error)throw error;await refreshRemoteContent();$("assignmentTitle").value="";$("assignmentSubject").value="";$("assignmentDue").value="";$("assignmentBody").value="";renderAssignments();}catch(err){alert("Could not publish assignment: "+err.message)}};
window.removeAssignment=async id=>{if(!confirm("Delete this assignment?"))return;try{const {error}=await vfaSupabase.from("assignments").delete().eq("id",id);if(error)throw error;await refreshRemoteContent();renderAssignments();}catch(err){alert("Could not delete assignment: "+err.message)}};
function renderAnnouncements(){$("announcementAdminList").innerHTML=announcements.map(a=>`<div class="announcement-item"><div><strong>${esc(a.title)}</strong><span>${esc(a.date)} • ${esc(a.audience)}</span><p>${esc(a.body)}</p></div><button class="icon-btn danger" onclick="removeAnnouncement('${esc(a.id)}')">🗑️</button></div>`).join("")||'<p class="empty">No announcements published.</p>'}
$("addAnnouncement").onclick=async()=>{const title=$("announcementTitle").value.trim(),date=$("announcementDate").value,audience=$("announcementAudience").value,body=$("announcementBody").value.trim();if(!title||!date||!body)return alert("Complete the announcement.");try{const createdAt=date?new Date(`${date}T12:00:00`).toISOString():new Date().toISOString();const {data,error}=await vfaSafeInsert("announcements",{title,message:body,target_class_id:audienceClassId(audience),publish_to_all:audience==="All Students",created_at:createdAt},["target_class_id","publish_to_all","created_at"]);if(error)throw error;await refreshRemoteContent();$("announcementTitle").value="";$("announcementBody").value="";renderAnnouncements();renderHome();}catch(err){alert("Could not publish announcement: "+err.message)}};
window.removeAnnouncement=async id=>{if(!confirm("Delete this announcement?"))return;try{const {error}=await vfaSupabase.from("announcements").delete().eq("id",id);if(error)throw error;await refreshRemoteContent();renderAnnouncements();renderHome();}catch(err){alert("Could not delete announcement: "+err.message)}};

async function loadScaleStatements(){try{const {data,error}=await vfaSupabase.from("scale_settings").select("statements").eq("id",1).maybeSingle();if(error)throw error;if(Array.isArray(data?.statements)&&data.statements.length===5)scaleStatements=data.statements.map(x=>String(x||"").trim());}catch(err){console.warn("Scale settings could not be loaded:",err)}for(let i=1;i<=5;i++){const el=$("scaleStatement"+i);if(el)el.value=scaleStatements[i-1]||"";}}
$("saveScaleStatements")?.addEventListener("click",async()=>{const vals=[];for(let i=1;i<=5;i++){const v=$("scaleStatement"+i)?.value.trim();if(!v){$("scaleSettingsMessage").textContent=`Statement ${i} cannot be empty.`;return}vals.push(v)}const btn=$("saveScaleStatements");btn.disabled=true;try{const {error}=await vfaSupabase.from("scale_settings").upsert({id:1,statements:vals,updated_at:new Date().toISOString()});if(error)throw error;scaleStatements=vals;$("scaleSettingsMessage").textContent="Saved successfully."}catch(err){$("scaleSettingsMessage").textContent="Could not save: "+err.message}btn.disabled=false;});
function formatScaleDate(value){
 if(!value)return "Date not available";
 const d=new Date(value);
 if(Number.isNaN(d.getTime()))return String(value);
 return d.toLocaleDateString([], {year:"numeric",month:"short",day:"numeric"});
}
function normalizeScaleResponse(raw){
 try{
  if(typeof raw==="string") raw=JSON.parse(raw);
 }catch{}
 raw=raw&&typeof raw==="object"?raw:{};
 const checks=Array.isArray(raw.checks)?raw.checks.filter(Boolean).map(String):[];
 const note=raw.note==null?"":String(raw.note);
 return {checks,note,reviewed:!!raw.reviewed};
}
function renderScale(){
 const rows=scaleResponses.slice().reverse();
 $("scaleList").innerHTML=rows.map(r=>{
  const data=normalizeScaleResponse(r.response);
  r.checks=data.checks;r.note=data.note;r.reviewed=data.reviewed;
  const selectedSummary=r.checks.length?`${r.checks.length} option${r.checks.length===1?"":"s"} selected`:"No checkbox selected";
  return `<div class="feedback-item scale-response-card">
    <div class="scale-response-main">
      <strong>${esc(r.studentName||"Student")}</strong>
      <span>${esc(r.date||"")} • ${esc(r.studentGrade||"")}</span>
      <div class="scale-response-summary"><b>Parent response:</b> ${esc(selectedSummary)}${r.note?` • <b>Additional note:</b> Yes`:` • <b>Additional note:</b> None`}</div>
    </div>
    <div class="scale-response-actions">
      <button class="icon-btn primary-outline" onclick="viewScaleResponse('${esc(r.id)}')">View response</button>
      <button class="icon-btn" onclick="markScaleReviewed('${esc(r.id)}')">${r.reviewed?"✓ Reviewed":"Mark reviewed"}</button>
      <button class="icon-btn danger" onclick="deleteScaleResponse('${esc(r.id)}')">🗑️ Delete</button>
    </div>
  </div>`;
 }).join("")||'<p class="empty">No Scale Your Child responses yet.</p>'
}
window.viewScaleResponse=id=>{
 const r=scaleResponses.find(x=>x.id===id);if(!r)return;
 const data=normalizeScaleResponse(r.response);
 const statementList=(scaleStatements||[]).map((statement,i)=>{
  const text=String(statement||"");
  const selected=data.checks.some(x=>x===text);
  return `<div class="scale-response-option ${selected?"selected":""}"><span class="scale-check">${selected?"✓":""}</span><span>${esc(text)}</span></div>`;
 }).join("");
 const extra=data.checks.filter(x=>!(scaleStatements||[]).some(s=>String(s||"")===x));
 const extraHtml=extra.length?`<div class="scale-response-extra"><strong>Other recorded selections</strong>${extra.map(x=>`<div class="scale-response-option selected"><span class="scale-check">✓</span><span>${esc(x)}</span></div>`).join("")}</div>`:"";
 openModal(`Scale Your Child — ${r.studentName||"Student"}`,`
  <div class="scale-response-detail">
   <div class="record-grid"><div><strong>Student</strong><span>${esc(r.studentName||"Student")}</span></div><div><strong>Class</strong><span>${esc(r.studentGrade||"")}</span></div><div><strong>Date</strong><span>${esc(r.date||"")}</span></div></div>
   <h3>Options selected by parent</h3>
   <div class="scale-response-options">${statementList||'<p class="empty">No statements are currently configured.</p>'}</div>
   ${extraHtml}
   <h3>Additional note</h3>
   <div class="scale-note-box">${data.note?esc(data.note):"No additional note was provided."}</div>
   <div class="scale-review-status"><strong>Status:</strong> ${data.reviewed?"Reviewed":"Not reviewed"}</div>
  </div>`);
};
window.markScaleReviewed=async id=>{const r=scaleResponses.find(x=>x.id===id);if(!r)return;const data=normalizeScaleResponse(r.response);r.reviewed=!data.reviewed;r.response={...(r.response&&typeof r.response==="object"?r.response:{}),checks:data.checks,note:data.note,reviewed:r.reviewed};renderScale();renderHome();};
window.deleteScaleResponse=async id=>{const r=scaleResponses.find(x=>x.id===id);if(!r)return;if(!confirm("Delete this Scale Your Child response?"))return;scaleResponses=scaleResponses.filter(x=>x.id!==id);renderScale();renderHome();};
function renderSuggestions(){$("suggestionList").innerHTML=suggestions.map(s=>`<div class="announcement-item"><div><strong>${esc(s.title)}</strong><span>To: ${esc(s.audience)} • ${esc(s.date)} • By ${esc(s.by)}</span><p>${esc(s.body)}</p></div><button class="icon-btn danger" onclick="removeSuggestion('${esc(s.id)}')">🗑️</button></div>`).join("")||'<p class="empty">No suggestions sent.</p>'}
$("addSuggestion").onclick=async()=>{const audience=$("suggestionAudience").value,title=$("suggestionTitle").value.trim(),body=$("suggestionBody").value.trim();if(!title||!body)return alert("Enter a title and message.");try{const {data,error}=await vfaSupabase.from("admin_suggestions").insert(targets.map(st=>({student_id:st.dbId,title,message:body})));if(error)throw error;await refreshRemoteContent();$("suggestionTitle").value="";$("suggestionBody").value="";renderSuggestions();}catch(err){alert("Could not send suggestion: "+err.message)}};
window.removeSuggestion=async id=>{if(!confirm("Delete this suggestion?"))return;try{const {error}=await vfaSupabase.from("admin_suggestions").delete().eq("id",id);if(error)throw error;await refreshRemoteContent();renderSuggestions();}catch(err){alert("Could not delete suggestion: "+err.message)}};

$("staffDate").onchange=renderStaff;$('addStaff').onclick=()=>openStaffForm();
function formatCheckInTime(value){if(!value)return "";const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value).slice(0,5);return d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false});}
function renderStaff(){const date=$("staffDate").value||today();$("staffRows").innerHTML=staff.map(s=>{const rec=staffAttendance.find(r=>r.staffId===s.id&&r.date===date);const checkIn=rec?.time?formatCheckInTime(rec.time):"";return `<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.position)}</td><td><select class="staff-status" data-id="${esc(s.id)}"><option value="present" ${rec?.status==="present"?"selected":""}>Present</option><option value="late" ${rec?.status==="late"?"selected":""}>Late</option><option value="absent" ${rec?.status==="absent"?"selected":""}>Absent</option></select></td><td><input class="staff-checkin" data-id="${esc(s.id)}" type="time" value="${esc(checkIn)}" aria-label="Check-in time for ${esc(s.name)}"></td><td><button class="secondary small" onclick="saveStaffStatus('${esc(s.id)}')">Save</button> <button class="icon-btn" onclick="openStaffForm('${esc(s.id)}')">✏️</button><button class="icon-btn danger" onclick="deleteStaff('${esc(s.id)}')">🗑️</button></td></tr>`}).join("")||'<tr><td colspan="5" class="empty">No staff or teachers added yet.</td></tr>';}
async function upsertAttendance(staffId,date,status,checkInTime){const {data:existing,error:probeError}=await vfaSupabase.from("staff_attendance").select("id,check_in_time").eq("staff_id",staffId).eq("attendance_date",date).maybeSingle();if(probeError)throw probeError;const normalized=String(status||"").toLowerCase();let checkIn=null;if(normalized==="present"||normalized==="late"){if(checkInTime){const parsed=new Date(`${date}T${checkInTime}:00`);if(Number.isNaN(parsed.getTime()))throw new Error("Enter a valid check-in time.");checkIn=parsed.toISOString();}else checkIn=existing?.check_in_time||new Date().toISOString();}const payload={staff_id:staffId,attendance_date:date,status:normalized,check_in_time:checkIn};if(existing?.id)return await vfaSupabase.from("staff_attendance").update(payload).eq("id",existing.id).select("*").single();return await vfaSupabase.from("staff_attendance").insert(payload).select("*").single();}
window.saveStaffStatus=async id=>{const date=$("staffDate").value||today();const select=document.querySelector(`.staff-status[data-id="${CSS.escape(id)}"]`);const timeInput=document.querySelector(`.staff-checkin[data-id="${CSS.escape(id)}"]`);if(!select||!timeInput)return;try{await requireVerifiedAdminSession();const result=await upsertAttendance(id,date,select.value,timeInput.value);if(result.error)throw result.error;const saved=result.data;const old=staffAttendance.find(r=>r.staffId===id&&r.date===date);const normalized=String(select.value).toLowerCase();if(old){old.status=normalized;old.time=saved?.check_in_time||"";}else staffAttendance.push({id:saved.id,staffId:id,date,status:normalized,time:saved?.check_in_time||""});renderStaff();}catch(err){console.error(err);alert("Could not save attendance: "+(err?.message||err));}};
function openStaffForm(id){const s=staff.find(x=>x.id===id);openModal(id?"Edit Staff / Teacher":"Add Staff / Teacher",`<form id="staffForm" class="form-grid student-form"><label class="full">Full Name<input name="name" value="${esc(s?.name||"")}" required></label><label>Position<input name="position" value="${esc(s?.position||"")}" placeholder="Teacher, Principal, Secretary..." required></label><label>Phone<input name="phone" value="${esc(s?.phone||"")}" placeholder="Phone number"></label><div class="submit-row"><button class="primary" type="submit">${id?"Save":"Add Staff"}</button></div></form>`);$("staffForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const name=String(f.get("name")||"").trim(),position=String(f.get("position")||"").trim(),phone=String(f.get("phone")||"").trim()||null;if(!name||!position)return alert("Enter the staff member name and position.");try{await requireVerifiedAdminSession();if(id){const {data,error}=await vfaSupabase.from("staff").update({name,position,phone}).eq("id",id).select("id,name,position,phone,email,is_active").single();if(error)throw error;staff=staff.map(x=>x.id===id?{...x,id:data.id,dbId:data.id,name:data.name,position:data.position||"",phone:data.phone||"",email:data.email||""}:x);}else{const {data,error}=await vfaSupabase.from("staff").insert({name,position,phone,is_active:true}).select("id,name,position,phone,email,is_active").single();if(error)throw error;if(!data?.id)throw new Error("Staff member was not returned after saving.");staff.push({dbId:data.id,id:data.id,name:data.name,position:data.position||"",phone:data.phone||"",email:data.email||""});}closeModal();renderStaff();renderHome();}catch(err){console.error("VFA staff save failed:",err);alert("Could not save staff member: "+(err?.message||err));}};}
window.deleteStaff=async id=>{const s=staff.find(x=>x.id===id);if(!s||!confirm(`Delete ${s.name} from staff?`))return;try{await requireVerifiedAdminSession();const attendanceDelete=await vfaSupabase.from("staff_attendance").delete().eq("staff_id",id);if(attendanceDelete.error)throw attendanceDelete.error;const clearSponsor=await vfaSupabase.from("students").update({sponsor_id:null}).eq("sponsor_id",id);if(clearSponsor.error&&!/column|schema cache|does not exist/i.test(String(clearSponsor.error.message||"")))throw clearSponsor.error;const {error}=await vfaSupabase.from("staff").delete().eq("id",id);if(error)throw error;staff=staff.filter(x=>x.id!==id);staffAttendance=staffAttendance.filter(x=>x.staffId!==id);students.forEach(st=>{if(st.sponsorId===id){st.sponsorId="";st.sponsor="";}});renderStaff();renderHome();}catch(err){console.error("VFA staff delete failed:",err);alert("Could not delete staff member: "+(err?.message||err));}};
function openModal(title,html){$("modalTitle").textContent=title;$("modalBody").innerHTML=html;$("modal").classList.remove("hidden")}
function closeModal(){$("modal").classList.add("hidden")}
$("closeModal").onclick=closeModal;$("modal").onclick=e=>{if(e.target.id==="modal")closeModal()};
(function(){const menu=$("mobileMenu"),sidebar=document.querySelector(".sidebar"),overlay=$("sidebarOverlay");if(!menu||!sidebar||!overlay)return;function close(){sidebar.classList.remove("mobile-open");overlay.classList.remove("show");menu.setAttribute("aria-expanded","false")}menu.onclick=()=>{const open=sidebar.classList.toggle("mobile-open");overlay.classList.toggle("show",open);menu.setAttribute("aria-expanded",String(open))};overlay.onclick=close;sidebar.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{if(btn!==menu)close()}))})();

/* ================= NEW SUPABASE BRIDGE ================= */
async function vfaSafeInsert(table,payload){
  return await vfaSupabase.from(table).insert(payload).select().single();
}
async function vfaSafeUpdate(table,payload,matchColumn,matchValue){
  return await vfaSupabase.from(table).update(payload).eq(matchColumn,matchValue).select().single();
}
const VFA_PERIODS=[
  {name:"1st Period",semester:"first",column:"first"},
  {name:"2nd Period",semester:"first",column:"second"},
  {name:"3rd Period",semester:"first",column:"third"},
  {name:"Exam",semester:"first",column:"exam"},
  {name:"4th Period",semester:"second",column:"fourth"},
  {name:"5th Period",semester:"second",column:"fifth"},
  {name:"6th Period",semester:"second",column:"sixth"},
  {name:"Exam",semester:"second",column:"second_exam"}
];
periodRows=VFA_PERIODS.map((p,i)=>({id:p.name+"-"+p.semester,period_name:p.name,semester:p.semester,sort_order:i+1,column:p.column}));

async function getVerifiedAdminSession(){
 const {data,error}=await vfaSupabase.auth.getSession();
 if(error)throw error;
 const session=data?.session,user=session?.user;
 if(!session||!user)return null;
 const {data:profile,error:pe}=await vfaSupabase.from("admin_profiles").select("id,admin_code,full_name,email,role,position,is_active").eq("auth_user_id",user.id).maybeSingle();
 if(pe)throw pe;
 if(!profile||!profile.is_active)throw new Error("The signed-in Supabase account is not linked to an active VFA administrator.");
 currentAdmin={id:profile.admin_code,email:profile.email||user.email,name:profile.full_name,role:profile.role,position:profile.position};
 return {session,user,profile};
}
let vfaAdminRealtimeChannel=null;
let vfaAdminRealtimeTimer=null;
let vfaAdminRealtimePoll=null;
let vfaAdminRealtimeBusy=false;
let vfaAdminRealtimeLastSignature="";
const VFA_ADMIN_LIVE_TABLES=["students","staff","staff_attendance","financial_records","fee_structures","grades","exam_timetable","assignments","announcements","admin_suggestions","scale_settings","classes","subjects"];
async function refreshAdminRealtimeView(){
  if(!currentAdmin || !($("adminApp")) || $("adminApp").classList.contains("hidden") || vfaAdminRealtimeBusy) return;
  clearTimeout(vfaAdminRealtimeTimer);
  vfaAdminRealtimeTimer=setTimeout(async()=>{
    if(vfaAdminRealtimeBusy)return;
    vfaAdminRealtimeBusy=true;
    try{await loadVfaRemote();renderAll();}catch(err){console.warn("VFA realtime refresh failed:",err);}finally{vfaAdminRealtimeBusy=false;}
  },150);
}
function setupAdminRealtime(){
  if(vfaAdminRealtimeChannel){vfaSupabase.removeChannel(vfaAdminRealtimeChannel);vfaAdminRealtimeChannel=null;}
  if(vfaAdminRealtimePoll)clearInterval(vfaAdminRealtimePoll);
  vfaAdminRealtimeChannel=vfaSupabase.channel("vfa-admin-live-data",{config:{broadcast:{ack:false}}});
  VFA_ADMIN_LIVE_TABLES.forEach(table=>{
    vfaAdminRealtimeChannel.on("postgres_changes",{event:"*",schema:"public",table},()=>refreshAdminRealtimeView());
  });
  vfaAdminRealtimeChannel.subscribe(status=>{
    console.debug("VFA admin realtime status:",status);
    if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
      setTimeout(()=>{if(currentAdmin)setupAdminRealtime();},1000);
    }
  });
  // Realtime is the fast path. This lightweight fallback guarantees that an
  // already-open device still sees saved database changes if a websocket is
  // blocked or Supabase Realtime temporarily drops a notification.
  vfaAdminRealtimePoll=setInterval(()=>refreshAdminRealtimeView(),5000);
}
async function showVerifiedAdminPanel(){const verified=await getVerifiedAdminSession();if(!verified)return false;await acquireVfaAdminSessionLock();await loadVfaRemote();$("loginView").classList.add("hidden");$("adminApp").classList.remove("hidden");$("staffPill").textContent=`${currentAdmin.name} • ${currentAdmin.role}`;init();setupAdminRealtime();return true;}

async function refreshRemoteContent(){
  const classMap=Object.fromEntries(classRows.map(x=>[x.id,x.name]));
  const subMap=Object.fromEntries(subjectRows.map(x=>[x.id,x.name]));

  const {data:fin,error:fe}=await vfaSupabase.from("financial_records").select("id,student_id,school_year,record_date,description,amount_due,amount_paid,balance,created_at").order("record_date");
  if(fe)throw new Error(`financial_records: ${fe.message}`);
  payments=(fin||[]).map(x=>({id:x.id,studentId:students.find(s=>s.dbId===x.student_id)?.id||x.student_id,schoolYear:x.school_year||students.find(s=>s.dbId===x.student_id)?.schoolYear||"",date:x.record_date||"",period:x.description||"",amount:Number(x.amount_paid||0),balance:Number(x.balance||0),amountDue:Number(x.amount_due||0)}));

  const {data:fee,error:feeError}=await vfaSupabase.from("fee_structures").select("id,class_id,school_year,first_payment,second_payment,third_payment,amount_due").order("school_year");
  if(feeError)throw new Error(`fee_structures: ${feeError.message}`);
  feeStructures=(fee||[]).map(x=>({id:x.id,classId:x.class_id,schoolYear:x.school_year||"",first:Number(x.first_payment||0),second:Number(x.second_payment||0),third:Number(x.third_payment||0),total:Number(x.amount_due??(Number(x.first_payment||0)+Number(x.second_payment||0)+Number(x.third_payment||0)))}));

  const {data:ex,error:ee}=await vfaSupabase.from("exam_timetable").select("id,exam_date,start_time,end_time,room,subject_id,class_id").order("exam_date");
  if(ee)throw new Error(`exam_timetable: ${ee.message}`);
  exams=(ex||[]).map(x=>({id:x.id,grade:classMap[x.class_id]||"",date:x.exam_date||"",subject:subMap[x.subject_id]||"",time:[x.start_time,x.end_time].filter(Boolean).join(" - "),room:x.room||""}));

  const {data:as,error:ase}=await vfaSupabase.from("assignments").select("id,title,description,due_date,subject_id,class_id,created_at").order("created_at",{ascending:false});
  if(ase)throw new Error(`assignments: ${ase.message}`);
  assignments=(as||[]).map(x=>({id:x.id,title:x.title||"",body:x.description||"",due:x.due_date||"",subject:subMap[x.subject_id]||"",audience:classMap[x.class_id]||"All Students",createdAt:x.created_at||""}));

  const {data:an,error:ane}=await vfaSupabase.from("announcements").select("id,title,message,target_class_id,created_at").order("created_at",{ascending:false});
  if(ane)throw new Error(`announcements: ${ane.message}`);
  announcements=(an||[]).map(x=>({id:x.id,title:x.title||"",body:x.message||"",date:String(x.created_at||"").slice(0,10),audience:classMap[x.target_class_id]||"All Students",createdAt:x.created_at||""}));

  const {data:sg,error:sge}=await vfaSupabase.from("admin_suggestions").select("id,student_id,title,message,status,created_at").order("created_at",{ascending:false});
  if(sge)throw new Error(`admin_suggestions: ${sge.message}`);
  suggestions=(sg||[]).map(x=>({id:x.id,title:x.title||"",body:x.message||"",date:String(x.created_at||"").slice(0,10),audience:students.find(s=>s.dbId===x.student_id)?.name||"Student",by:"Administration",createdAt:x.created_at||""}));

  const {data:sa,error:sae}=await vfaSupabase.from("staff_attendance").select("id,staff_id,attendance_date,status,check_in_time,created_at").order("attendance_date",{ascending:false});
  if(sae)throw new Error(`staff_attendance: ${sae.message}`);
  staffAttendance=(sa||[]).map(x=>({id:x.id,staffId:x.staff_id,date:x.attendance_date||"",status:String(x.status||"").toLowerCase(),time:x.check_in_time||""}));

  const {data:gr,error:ge}=await vfaSupabase.from("grades").select("*");
  if(ge)throw new Error(`grades: ${ge.message}`);
  gradesData={}; reportMeta={};
  const byDb=Object.fromEntries(students.map(x=>[x.dbId,x]));
  (gr||[]).forEach(x=>{
    const st=byDb[x.student_id], sub=subMap[x.subject_id]; if(!st||!sub)return;
    const sem=x.semester||"first";
    const p=VFA_PERIODS.find(q=>q.name===x.period && q.semester===sem);
    if(p && x.score!==null && x.score!==undefined) gradesData[`${st.id}|${sub}|${p.name}`]=x.score;
  });
}

async function refreshVfaAuthSession(){
  const {data,error}=await vfaSupabase.auth.refreshSession();
  if(error)throw error;
  return data?.session||null;
}

async function loadVfaRemote(){
  await refreshVfaAuthSession();
  const {data:{user},error:ue}=await vfaSupabase.auth.getUser();
  if(ue)throw ue; if(!user)throw new Error("No authenticated admin user.");
  const {data:admins,error:ae}=await vfaSupabase.from("admin_profiles").select("id,admin_code,full_name,email,role,position,is_active").eq("auth_user_id",user.id).maybeSingle();
  if(ae)throw new Error(`admin_profiles: ${ae.message}`);
  if(!admins||!admins.is_active)throw new Error("This account is not authorized as a VFA administrator.");
  currentAdmin={id:admins.admin_code,email:admins.email,name:admins.full_name,role:admins.role,position:admins.position};

  const {data:classesDb,error:ce}=await vfaSupabase.from("classes").select("id,name");
  if(ce)throw new Error(`classes: ${ce.message}`);
  const classOrder={"Daycare":1,"Nursery":2,"Kindergarten 1":3,"Kindergarten 2":4,"Grade 1":5,"Grade 2":6,"Grade 3":7,"Grade 4":8,"Grade 5":9,"Grade 6":10,"Grade 7":11,"Grade 8":12,"Grade 9":13};
  classRows=(classesDb||[]).sort((a,b)=>(classOrder[a.name]||999)-(classOrder[b.name]||999));
  const {data:staffDb,error:se}=await vfaSupabase.from("staff").select("id,name,position,phone,email,is_active").eq("is_active",true).order("name");
  if(se)throw new Error(`staff: ${se.message}`); staff=(staffDb||[]).map(x=>({dbId:x.id,id:x.id,name:x.name,position:x.position||"",phone:x.phone||"",email:x.email||""}));
  const {data:studentsDb,error:ste}=await vfaSupabase.from("students").select("id,full_name,student_code,registration_date,sex,enrollment_status,class_id,sponsor_id,parent_name,parent_phone,school_year,scholarship,auth_user_id,is_active,created_at,updated_at,id_card_data").order("full_name");
  if(ste)throw new Error(`students: ${ste.message}`);
  const classById=Object.fromEntries(classRows.map(x=>[x.id,x.name]));
  students=(studentsDb||[]).map(x=>({dbId:x.id,id:x.student_code||"",name:x.full_name,grade:classById[x.class_id]||"",registrationDate:x.registration_date||"",sex:x.sex||"",enrollmentStatus:x.enrollment_status||"",parent:x.parent_name||"",parentPhone:x.parent_phone||"",sponsor:(staff.find(t=>t.id===x.sponsor_id)||{}).name||"",sponsorId:x.sponsor_id||"",status:x.is_active?"Active":"Inactive",schoolYear:x.school_year||"",password:getStudentPassword(x.student_code||""),auth_user_id:x.auth_user_id,scholarship:Boolean(x.scholarship),idCard:x.id_card_data||""}));
  await loadServerStudentPasswords();
  students.forEach(s=>{if(!s.password){const saved=getStudentPassword(s.id);if(saved)s.password=saved;}});
  const {data:subs,error:sube}=await vfaSupabase.from("subjects").select("id,name").order("name");
  if(sube)throw new Error(`subjects: ${sube.message}`); subjectRows=subs||[];
  await refreshRemoteContent();
}
async function requireVerifiedAdminSession(){await refreshVfaAuthSession();const verified=await getVerifiedAdminSession();if(!verified)throw new Error("Your VFA administrator session has expired. Please log in again.");return verified;}

function nextStudentCode(){
  const nums=students.map(s=>Number(String(s.id||"").match(/(\d{3})$/)?.[1]||0)).filter(Number.isFinite);
  const next=Math.max(0,...nums)+1; return `0020172${String(next).padStart(3,"0")}`;
}
async function syncVfaStudents(studentList=students){
  for(const s of studentList){
    const cls=classRows.find(c=>c.name===s.grade), sponsor=staff.find(t=>t.name===s.sponsor);
    const payload={full_name:s.name,class_id:cls?.id||null,registration_date:s.registrationDate||null,sex:s.sex||null,enrollment_status:s.enrollmentStatus||null,sponsor_id:sponsor?.id||null,parent_name:s.parent||null,parent_phone:s.parentPhone||null,school_year:s.schoolYear||null,scholarship:Boolean(s.scholarship),is_active:s.status!=="Inactive",id_card_data:s.idCard||null};
    if(!s.dbId){
      // New students receive one password when first saved. Keep that password.
      if(!s.password)s.password=makePassword();
      if(!s.id)s.id=nextStudentCode();
      const {data:row,error}=await vfaSupabase.from("students").insert({...payload,student_code:s.id}).select("*").single();
      if(error)throw error; s.dbId=row.id;s.auth_user_id=row.auth_user_id||null; rememberStudentPassword(s.id,s.password);
    }else{
      const {data:row,error}=await vfaSupabase.from("students").update({...payload,student_code:s.id}).eq("id",s.dbId).select("*").single();
      if(error)throw error; s.auth_user_id=row.auth_user_id||s.auth_user_id||null;
    }

    // Stage 11: after the database row is saved, create/sync the student Auth account
    // through the server-side Edge Function. The password is never stored in the students table.
    const action = s.auth_user_id ? "sync" : "create";
    const { data: authData, error: authError } = await vfaSupabase.functions.invoke("bright-api", {
      body: {
        action,
        studentDbId: s.dbId,
        studentId: s.id,
        fullName: s.name,
        password: s.password || undefined,
        authUserId: s.auth_user_id || undefined
      }
    });
    if(authError) throw new Error(authError.message || "Student portal account could not be created.");
    if(authData?.error) throw new Error(authData.error);
    if(authData?.studentAuthUserId) s.auth_user_id = authData.studentAuthUserId;
    if(s.password) await saveServerStudentPassword(s.id,s.password);
    s.auth_sync_error = false;
  }
}
async function syncVfaGrades(){
  const by=Object.fromEntries(students.map(x=>[x.id,x]));
  const subs=Object.fromEntries(subjectRows.map(x=>[x.name,x]));
  for(const [key,val] of Object.entries(gradesData)){
    if(val===""||val===null||val===undefined)continue;
    const [sid,sub,period]=key.split("|");
    const st=by[sid],sr=subs[sub],p=VFA_PERIODS.find(x=>x.name===period);
    if(!st?.dbId||!sr||!p)continue;
    const payload={student_id:st.dbId,subject_id:sr.id,semester:p.semester,period:p.name,score:Number(val)};
    const {data:existing,error:ee}=await vfaSupabase.from("grades").select("id").eq("student_id",st.dbId).eq("subject_id",sr.id).eq("semester",p.semester).eq("period",p.name).maybeSingle();
    if(ee)throw ee;
    if(existing){const {error}=await vfaSupabase.from("grades").update(payload).eq("id",existing.id);if(error)throw error;}
    else{const {error}=await vfaSupabase.from("grades").insert(payload);if(error)throw error;}
  }
}

// Replace legacy button handlers that depended on tables/RPCs not present in the new database.
$("saveStudents").onclick=async()=>{try{await requireVerifiedAdminSession();const pending=students.filter(x=>pendingStudentIds.has(x.dbId)||pendingStudentIds.has(x.id)||pendingStudentIds.has(x._localId));if(!pending.length){alert("There are no unsaved student changes. Use Save Student after editing a student.");return;}await syncVfaStudents(pending);pendingStudentIds.clear();await refreshRemoteContent();renderAll();alert(`${pending.length} student${pending.length===1?"":"s"} saved successfully to the school database.`);}catch(err){console.error(err);alert("The students could not be saved to the school database: "+err.message)}};
window.deleteStudent=async id=>{const s=students.find(x=>x.id===id);if(!s||!confirm(`Delete ${s.name}? This removes the student record and portal login from Supabase.`))return;try{if(s.auth_user_id&&s.dbId){const {data:functionData,error:functionError}=await vfaSupabase.functions.invoke("bright-api",{body:{action:"delete",studentDbId:s.dbId,authUserId:s.auth_user_id}});if(functionError)throw new Error(functionError.message||"Student account deletion failed.");if(functionData?.error)throw new Error(functionData.error);}if(s.dbId){const {error}=await vfaSupabase.from("students").delete().eq("id",s.dbId);if(error)throw error;}students=students.filter(x=>x.id!==id);await refreshRemoteContent();renderAll();alert("Student deleted successfully from the school database.");}catch(err){alert("Could not delete student: "+err.message)}};

$("saveAllGrades").onclick=async()=>{document.querySelectorAll(".grade-cell").forEach(i=>{const v=i.value.trim();if(v==="")delete gradesData[i.dataset.key];else gradesData[i.dataset.key]=Math.max(0,Math.min(100,Number(v)))});try{await syncVfaGrades();await refreshRemoteContent();renderGrades();alert("Grade sheet saved to the school database.");}catch(err){alert("Could not save grades: "+err.message)}};

$("addAssignment").onclick=async()=>{const title=$("assignmentTitle").value.trim(),audience=$("assignmentAudience").value,subject=$("assignmentSubject").value.trim(),due=$("assignmentDue").value,body=$("assignmentBody").value.trim();if(!title||!body)return alert("Enter an assignment title and instructions.");try{const {error}=await vfaSupabase.from("assignments").insert({title,description:body,due_date:due||null,subject_id:subjectRows.find(x=>x.name===subject)?.id||null,class_id:audienceClassId(audience)});if(error)throw error;await refreshRemoteContent();$("assignmentTitle").value="";$("assignmentSubject").value="";$("assignmentDue").value="";$("assignmentBody").value="";renderAssignments();}catch(err){alert("Could not publish assignment: "+err.message)}};
window.removeAssignment=async id=>{if(!confirm("Delete this assignment?"))return;try{const {error}=await vfaSupabase.from("assignments").delete().eq("id",id);if(error)throw error;await refreshRemoteContent();renderAssignments();}catch(err){alert("Could not delete assignment: "+err.message)}};
$("addAnnouncement").onclick=async()=>{const title=$("announcementTitle").value.trim(),date=$("announcementDate").value,audience=$("announcementAudience").value,body=$("announcementBody").value.trim();if(!title||!body)return alert("Complete the announcement.");try{const {error}=await vfaSupabase.from("announcements").insert({title,message:body,target_class_id:audienceClassId(audience),created_at:date?new Date(`${date}T12:00:00`).toISOString():new Date().toISOString()});if(error)throw error;await refreshRemoteContent();$("announcementTitle").value="";$("announcementBody").value="";renderAnnouncements();renderHome();}catch(err){alert("Could not publish announcement: "+err.message)}};
window.removeAnnouncement=async id=>{if(!confirm("Delete this announcement?"))return;try{const {error}=await vfaSupabase.from("announcements").delete().eq("id",id);if(error)throw error;await refreshRemoteContent();renderAnnouncements();renderHome();}catch(err){alert("Could not delete announcement: "+err.message)}};
$("addSuggestion").onclick=async()=>{const audience=$("suggestionAudience").value,title=$("suggestionTitle").value.trim(),body=$("suggestionBody").value.trim();if(!title||!body)return alert("Enter a title and message.");try{const targets=audience==="All Students"?students.filter(s=>s.dbId):students.filter(s=>s.grade===audience&&s.dbId);if(!targets.length)throw new Error("No saved students match that audience yet.");for(const st of targets){const {error}=await vfaSupabase.from("admin_suggestions").insert({student_id:st.dbId,title,message:body});if(error)throw error;}await refreshRemoteContent();$("suggestionTitle").value="";$("suggestionBody").value="";renderSuggestions();}catch(err){alert("Could not send suggestion: "+err.message)}};
window.removeSuggestion=async id=>{if(!confirm("Delete this suggestion?"))return;try{const {error}=await vfaSupabase.from("admin_suggestions").delete().eq("id",id);if(error)throw error;await refreshRemoteContent();renderSuggestions();}catch(err){alert("Could not delete suggestion: "+err.message)}};

// The new database intentionally does not contain the legacy Scale Your Child tables yet.
$("saveScaleStatements")?.addEventListener("click",()=>{if($("scaleSettingsMessage"))$("scaleSettingsMessage").textContent="Scale Your Child storage is not connected in this database build yet."});

function loadAdminIdCard(){const key=`vfaAdminIdCard:${currentAdmin?.id||""}`;const data=localStorage.getItem(key);const preview=$("adminIdCardPreview");if(!preview)return;preview.innerHTML=data?`<img src="${data}" alt="Administrator ID card">`:'<p class="muted">No ID card uploaded.</p>';}
function bindAdminIdCard(){$("adminIdCardInput")?.addEventListener("change",e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){ $("adminIdCardMessage").textContent="Please choose an image file.";return;}const reader=new FileReader();reader.onload=()=>{localStorage.setItem(`vfaAdminIdCard:${currentAdmin.id}`,reader.result);$("adminIdCardMessage").textContent="ID card uploaded.";loadAdminIdCard();};reader.readAsDataURL(file);});$("removeAdminIdCard")?.addEventListener("click",()=>{localStorage.removeItem(`vfaAdminIdCard:${currentAdmin.id}`);$("adminIdCardInput").value="";$("adminIdCardMessage").textContent="ID card removed.";loadAdminIdCard();});loadAdminIdCard();}

// Rebind handlers that were attached before this compatibility layer was loaded.
$("staffLoginForm").onsubmit=async e=>{e.preventDefault();const id=$("staffId").value.trim(),pw=$("staffPassword").value;const account=ADMIN_ACCOUNTS.find(a=>a.id===id);if(!account){$("loginMessage").textContent="Incorrect Admin ID.";return;}$("loginMessage").textContent="Signing in…";try{const {data,error}=await vfaSupabase.auth.signInWithPassword({email:account.email,password:pw});if(error)throw error;if(!data?.session?.user)throw new Error("Supabase login succeeded but no browser session was created.");await showVerifiedAdminPanel();$("loginMessage").textContent="";setTimeout(bindAdminIdCard,0);}catch(err){try{await vfaSupabase.auth.signOut();}catch(_){}currentAdmin=null;$("adminApp").classList.add("hidden");$("loginView").classList.remove("hidden");$("loginMessage").textContent=(err.message||String(err));}};
$("staffLogout").onclick=async()=>{await releaseVfaAdminSessionLock();await vfaSupabase.auth.signOut();currentAdmin=null;$("adminApp").classList.add("hidden");$("loginView").classList.remove("hidden");$("staffId").value="";$("staffPassword").value="";};
document.addEventListener("visibilitychange",async()=>{
  if(document.visibilityState!=="visible")return;
  try{
    const {data}=await vfaSupabase.auth.getSession();
    if(data?.session)await refreshVfaAuthSession();
  }catch(err){
    console.warn("VFA session refresh failed:",err);
  }
});
(async()=>{try{const restored=await showVerifiedAdminPanel();if(restored)setTimeout(bindAdminIdCard,0);}catch(err){console.warn("No restorable admin session",err);try{await vfaSupabase.auth.signOut();}catch(_){}}})();


/* VFA UI feedback — non-invasive layer.
   Existing Supabase/database handlers remain unchanged. This only wraps the
   already-assigned UI handlers so their buttons reflect the real Promise. */
(function(){
  function setBusy(btn,label){
    if(!btn)return;
    if(!btn.dataset.vfaOriginalHtml) btn.dataset.vfaOriginalHtml=btn.innerHTML;
    btn.disabled=true;
    btn.setAttribute("aria-busy","true");
    btn.innerHTML='<span class="vfa-button-spinner" aria-hidden="true"></span> '+label;
  }
  function restore(btn){
    if(!btn)return;
    btn.disabled=false;
    btn.removeAttribute("aria-busy");
    if(btn.dataset.vfaOriginalHtml){btn.innerHTML=btn.dataset.vfaOriginalHtml;delete btn.dataset.vfaOriginalHtml;}
  }
  function wrap(id,loading,success){
    const btn=$(id); if(!btn || btn.dataset.vfaFeedbackWrapped || typeof btn.onclick!=="function")return;
    const original=btn.onclick;
    btn.dataset.vfaFeedbackWrapped="1";
    btn.onclick=function(e){
      if(btn.dataset.vfaRunning)return false;
      btn.dataset.vfaRunning="1";
      setBusy(btn,loading);
      let result;
      try{ result=original.call(this,e); }catch(err){
        restore(btn);delete btn.dataset.vfaRunning;throw err;
      }
      if(result && typeof result.then==="function"){
        return result.then(v=>{
          btn.innerHTML='<span class="vfa-button-check" aria-hidden="true">✓</span> '+success;
          setTimeout(()=>restore(btn),900);
          return v;
        }).catch(err=>{
          btn.innerHTML='<span class="vfa-button-error" aria-hidden="true">!</span> Not Saved';
          setTimeout(()=>restore(btn),1300);
          throw err;
        }).finally(()=>delete btn.dataset.vfaRunning);
      }
      btn.innerHTML='<span class="vfa-button-check" aria-hidden="true">✓</span> '+success;
      setTimeout(()=>restore(btn),900);
      delete btn.dataset.vfaRunning;
      return result;
    };
  }

  wrap("saveStudents","Saving Students…","Students Saved");
  wrap("saveAllGrades","Saving Grades…","Grades Saved");
  wrap("saveFeeStructure","Saving Fee Structure…","Fee Structure Saved");
  wrap("addAssignment","Publishing Assignment…","Assignment Published");
  wrap("addAnnouncement","Publishing Announcement…","Announcement Published");
  wrap("addSuggestion","Sending Suggestion…","Suggestion Sent");
})();
