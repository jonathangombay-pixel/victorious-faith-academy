const raw=localStorage.getItem("loggedInStudent");if(!raw){location.href="index.html";}else{const student=JSON.parse(raw),$=id=>document.getElementById(id);
const students=(()=>{try{return JSON.parse(localStorage.getItem("vfaAdminStudents")||"[]")}catch{return[]}})();
const payments=(()=>{try{return JSON.parse(localStorage.getItem("vfaAdminPayments")||"[]")}catch{return[]}})();
const grades=(()=>{try{return JSON.parse(localStorage.getItem("vfaGrades")||"{}")}catch{return{}}})();
const exams=(()=>{try{return JSON.parse(localStorage.getItem("vfaExams")||"[]")}catch{return[]}})();
const assignments=(()=>{try{return JSON.parse(localStorage.getItem("vfaAssignments")||"[]")}catch{return[]}})();
const announcements=(()=>{try{return JSON.parse(localStorage.getItem("vfaAdminAnnouncements")||"[]")}catch{return[]}})();
const suggestions=(()=>{try{return JSON.parse(localStorage.getItem("vfaAdminSuggestions")||"[]")}catch{return[]}})();
const reportMeta=(()=>{try{return JSON.parse(localStorage.getItem("vfaReportMeta")||"{}")}catch{return{}}})();
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
const fresh=students.find(s=>s.id===student.id)||student;
$("studentName").textContent=fresh.name;$("studentId").textContent=fresh.id;$("schoolYear").textContent=fresh.schoolYear||"";$("classValue").textContent=fresh.grade||"";$("welcomeText").textContent=`Welcome, ${fresh.name}`;

const myPayments=payments.filter(p=>p.studentId===fresh.id),due=Number(fresh.tuitionTotal||0),paid=myPayments.reduce((a,p)=>a+Number(p.amount||0),0),balance=Math.max(0,due-paid);
$("totalFees").textContent=`$${due.toFixed(2)}`;$("totalPaid").textContent=`$${paid.toFixed(2)}`;$("totalBalance").textContent=`$${balance.toFixed(2)}`;$("balanceValue").textContent=`$${balance.toFixed(2)}`;
$("paymentRows").innerHTML=myPayments.map(p=>`<tr><td>${esc(p.date)}</td><td>${esc(p.period)}</td><td>$${Number(p.amount).toFixed(2)}</td><td>$${Number(p.balance).toFixed(2)}</td></tr>`).join("")||'<tr><td colspan="4">No financial records available.</td></tr>';
const subSet=["Mathematics","English Language","Science","Social Studies","ICT","Biology","Chemistry","Physics"], first=["1st Period","2nd Period","3rd Period","Exam"], second=["4th Period","5th Period","6th Period","Exam"], allPeriods=[...first,...second];
$("reportStudentName").textContent=fresh.name||"";$("reportStudentId").textContent=fresh.id||"";$("reportClass").textContent=fresh.grade||"";$("reportSponsor").textContent=fresh.sponsor||"—";$("reportYear").textContent=fresh.schoolYear||"";
$("reportRows").innerHTML=subSet.map(sub=>{const vals=allPeriods.map(p=>grades[`${fresh.id}|${sub}|${p}`]??"");const f=vals.slice(0,4).reduce((a,v)=>a+Number(v||0),0),s=vals.slice(4).reduce((a,v)=>a+Number(v||0),0);return `<tr><td><strong>${esc(sub)}</strong></td>${vals.slice(0,4).map(v=>`<td>${v}</td>`).join("")}<td><strong>${f||""}</strong></td>${vals.slice(4).map(v=>`<td>${v}</td>`).join("")}<td><strong>${s||""}</strong></td></tr>`}).join("");
const summaryPeriods=allPeriods;
$("reportSummaryRows").innerHTML=`<tr class="summary-row"><th>Average</th>${summaryPeriods.map(p=>{const sem=second.includes(p)?"second":"first";const m=reportMeta[`${fresh.id}|${sem}|${p}`]||{};return `<td>${esc(m.average??"")}</td>`}).join("")}<td></td><td></td></tr><tr class="summary-row"><th>Rank</th>${summaryPeriods.map(p=>{const sem=second.includes(p)?"second":"first";const m=reportMeta[`${fresh.id}|${sem}|${p}`]||{};return `<td>${esc(m.rank??"")}</td>`}).join("")}<td></td><td></td></tr>`;
const conducts=summaryPeriods.map(p=>{const sem=second.includes(p)?"second":"first";return reportMeta[`${fresh.id}|${sem}|${p}`]?.conduct||""}).filter(Boolean);
$("reportConduct").textContent=conducts.length?conducts.join(" • "):"—";
const visibleAnnouncements=announcements.filter(a=>a.audience==="All Students"||a.audience===fresh.grade);const visibleAssignments=assignments.filter(a=>a.audience==="All Students"||a.audience===fresh.grade);const visibleSuggestions=suggestions.filter(a=>a.audience==="All Students"||a.audience===fresh.grade||a.audience===fresh.name||a.audience===fresh.id);
$("assignmentCount").textContent=visibleAssignments.length;
function ann(a){return `<div class="announcement"><h3>${esc(a.title)}</h3><div class="date">${esc(a.date||"")}${a.subject?` • ${esc(a.subject)}`:""}</div><div>${esc(a.body)}</div></div>`}
$("homeAnnouncements").innerHTML=visibleAnnouncements.slice(0,2).map(ann).join("")||"<p>No announcements available.</p>";$("announcementList").innerHTML=visibleAnnouncements.map(ann).join("")||"<p>No announcements available.</p>";
$("assignmentList").innerHTML=visibleAssignments.map(a=>`<div class="announcement"><h3>${esc(a.title)}</h3><div class="date">${esc(a.subject||"")} • Due ${esc(a.due||"")}</div><div>${esc(a.body)}</div></div>`).join("")||"<p>No assignments available.</p>";
$("suggestionList").innerHTML=visibleSuggestions.map(a=>`<div class="announcement"><h3>${esc(a.title)}</h3><div class="date">${esc(a.date||"")}</div><div>${esc(a.body)}</div></div>`).join("")||"<p>No suggestions from administration yet.</p>";
const myExams=exams.filter(e=>e.grade===fresh.grade);$("examClassTitle").textContent=fresh.grade||"Examination Timetable";$("examRows").innerHTML=myExams.map(e=>`<tr><td>${esc(e.date)}</td><td><strong>${esc(e.subject)}</strong></td><td>${esc(e.time)}</td><td>${esc(e.room)}</td></tr>`).join("")||'<tr><td colspan="4">No examination timetable has been published for your class.</td></tr>';
$("scaleForm").onsubmit=e=>{e.preventDefault();const checks=[...e.target.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value),note=$("scaleNote").value.trim();if(!checks.length&&!note){$("scaleMessage").textContent="Select at least one statement or enter a note.";return}let list;try{list=JSON.parse(localStorage.getItem("vfaScaleResponses")||"[]")}catch{list=[]}list.push({id:Date.now()+"",studentId:fresh.id,studentName:fresh.name,studentGrade:fresh.grade,date:new Date().toISOString().slice(0,10),checks,note,reviewed:false});localStorage.setItem("vfaScaleResponses",JSON.stringify(list));$("scaleMessage").textContent="Your response was sent to the school administration.";$("scaleForm").reset();};
const titles={home:"Home",grades:"Student's Grade",finance:"Financial Report",scale:"Scale Your Child",suggestions:"Admin Suggestions",assignments:"Assignments",announcements:"Announcements",exams:"Examination Timetable",profile:"Profile"};
document.querySelectorAll(".nav-button").forEach(b=>b.addEventListener("click",()=>openTab(b.dataset.tab)));
function openTab(id){document.querySelectorAll(".tab-page").forEach(p=>p.classList.remove("active"));$(id).classList.add("active");document.querySelectorAll(".nav-button").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));$("pageTitle").textContent=titles[id];window.scrollTo({top:0,behavior:"smooth"});}
$("logout").onclick=()=>{localStorage.removeItem("loggedInStudent");location.href="index.html"};
(function(){const menu=$("mobileMenu"),sidebar=document.querySelector(".sidebar"),overlay=$("sidebarOverlay");if(!menu||!sidebar||!overlay)return;function close(){sidebar.classList.remove("mobile-open");overlay.classList.remove("show");menu.setAttribute("aria-expanded","false")}menu.onclick=()=>{const open=sidebar.classList.toggle("mobile-open");overlay.classList.toggle("show",open);menu.setAttribute("aria-expanded",String(open))};overlay.onclick=close;sidebar.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{if(btn!==menu)close()}));})();

// Student ID card is uploaded by an administrator and is view-only here.
function loadStudentIdCard(){
 const preview=$("studentIdCardPreview"); if(!preview)return;
 const data=fresh.idCard||"";
 preview.innerHTML=data?`<img src="${data}" alt="Student ID card">`:`<p class="muted">No ID card has been uploaded yet.</p>`;
}
loadStudentIdCard();
}
