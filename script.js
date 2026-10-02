const password=document.getElementById("password");
document.getElementById("togglePassword").addEventListener("click",()=>{const show=password.type==="password";password.type=show?"text":"password";document.getElementById("togglePassword").textContent=show?"🙈":"👁"});
document.getElementById("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();const id=document.getElementById("studentId").value.trim(),pw=password.value.trim(),msg=document.getElementById("message");if(!id||!pw)return;msg.textContent="Signing in…";
 const normalizedId=id.toLowerCase().replace(/[^a-z0-9._-]/g,"-");
 const email=`${normalizedId}@students.vfa.local`;
 const legacyEmail=`${normalizedId.replace(/-/g,"")}@students.vfa.local`;
 // Clear any previous session so the student login always starts cleanly.
 await vfaSupabase.auth.signOut();
 let authResult=await vfaSupabase.auth.signInWithPassword({email,password:pw});
 // Compatibility fallback for accounts created by the older Edge Function, which stripped hyphens.
 if(authResult.error && legacyEmail!==email){
   authResult=await vfaSupabase.auth.signInWithPassword({email:legacyEmail,password:pw});
 }
 const {data,error}=authResult;
 if(error){console.error("Student sign-in failed:",error);msg.textContent="Incorrect Student ID or password. Please contact the school office if you need help.";return;}
 const user=data.user;
 const {data:student,error:se}=await vfaSupabase.from("students").select("id,student_code,full_name,class_id,sponsor_id,parent_name,parent_phone,school_year,is_active,auth_user_id").eq("auth_user_id",user.id).maybeSingle();
 if(se||!student||!student.is_active){await vfaSupabase.auth.signOut();msg.textContent="Your student account could not be found. Please contact the school office.";return;}
 localStorage.setItem("loggedInStudent",JSON.stringify({dbId:student.id,id:student.student_code,name:student.full_name,schoolYear:student.school_year||"",parent:student.parent_name||"",parentPhone:student.parent_phone||"",auth_user_id:user.id}));location.href="dashboard.html";
});
document.getElementById("forgotPassword").addEventListener("click",e=>{e.preventDefault();document.getElementById("message").textContent="Please contact the school office to reset your student password."});
let deferredPrompt=null;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e});document.getElementById("installButton").addEventListener("click",async()=>{if(!deferredPrompt){document.getElementById("message").textContent="Install is available when this browser supports web-app installation.";return}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null});
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
