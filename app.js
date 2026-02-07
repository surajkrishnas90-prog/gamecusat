// ================= IMPORT =================

import { initializeApp } from
"https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from
"https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy
} from
"https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";


// ================= CONFIG =================

const firebaseConfig = {
  apiKey: "AIzaSyDPz1-CBAGWEmtci-FVCetNFAx_R5aO6nc",
  authDomain: "collegegame.firebaseapp.com",
  projectId: "collegegame",
  storageBucket: "collegegame.appspot.com",
  messagingSenderId: "237681170796",
  appId: "1:237681170796:web:9ffba56c5c780d2d21bb49"
};

initializeApp(firebaseConfig);

const auth = getAuth();
const db = getFirestore();

const page = location.pathname.split("/").pop();

let currentUser = null;
let currentRole = "";


// ================= AUTH READY =================

onAuthStateChanged(auth, async (user) => {

  currentUser = user;

  if (!user) return;

  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists()) return;

  currentRole = snap.data().role || "player";

  // Protect dashboard
  if (page === "dashboard.html") {

    if (!["admin","superadmin","developer"].includes(currentRole)) {
      location = "index.html";
      return;
    }

    loadUsers();
    loadLogs();
  }
});


// ================= REDIRECT =================

function redirectUser(data){

  if(data.banned){
    location="banned.html";
    return;
  }

  if(["admin","superadmin","developer"].includes(data.role)){
    location="dashboard.html";
    return;
  }

  if(data.status==="verified"){
    location="play.html";
    return;
  }

  location="pending.html";
}


// ================= LOGIN =================

const loginBtn=document.getElementById("loginBtn");

if(loginBtn){

  loginBtn.onclick=async()=>{

    try{

      const res=await signInWithPopup(
        auth,
        new GoogleAuthProvider()
      );

      const user=res.user;

      const snap=await getDoc(
        doc(db,"users",user.uid)
      );

      if(!snap.exists()){
        location="register.html";
        return;
      }

      redirectUser(snap.data());

    }catch(e){

      console.error(e);
      alert("Login failed");

    }
  };
}


// ================= REGISTER =================

const submitBtn=document.getElementById("submit");

if(submitBtn){

  submitBtn.onclick=async()=>{

    if(!currentUser){
      alert("Login first");
      return;
    }

    const name =
      document.getElementById("name").value.trim();

    const college =
      document.getElementById("college").value.trim();

    const studentId =
      document.getElementById("studentId").value.trim();

    const phone =
      document.getElementById("phone").value.trim();

    const gender =
      document.getElementById("gender").value;

    if(!name||!college||!studentId||!phone||!gender){
      alert("Fill all fields");
      return;
    }

    const ref=doc(db,"users",currentUser.uid);

    const old=await getDoc(ref);

    if(old.exists()){
      redirectUser(old.data());
      return;
    }

    try{

      await setDoc(ref,{

        name,
        college,
        studentId,
        phone,
        gender,

        email:currentUser.email,

        role:"player",
        status:"pending",
        banned:false,

        createdAt:serverTimestamp()

      });

      location="pending.html";

    }catch(e){

      console.error(e);
      alert("Register failed");

    }
  };
}


// ================= LOAD USERS =================

async function loadUsers(){

  const list=document.getElementById("userList");
  if(!list) return;

  const snap=await getDocs(collection(db,"users"));

  list.innerHTML="";

  snap.forEach(d=>{

    const u=d.data();

    const isSuper = u.role==="superadmin";

    const tr=document.createElement("tr");

    tr.innerHTML=`

      <td>${u.name||"-"}</td>
      <td>${u.college||"-"}</td>
      <td>${u.studentId||"-"}</td>
      <td>${u.email||"-"}</td>

      <td>${
        currentRole==="superadmin"
        ? (u.phone||"-")
        : "🔒 Hidden"
      }</td>

      <td>${u.gender||"-"}</td>
      <td>${u.status||"-"}</td>
      <td>${u.role||"-"}</td>

      <td>
        <div class="action-box">

          ${
            !isSuper
            ? `
            <button
              class="btn-approve"
              onclick="toggleVerify('${d.id}')">

              ${u.status==="verified"?"Reject":"Approve"}

            </button>

            <button
              class="${u.banned?"btn-unban":"btn-ban"}"
              onclick="toggleBan('${d.id}',${u.banned})">

              ${u.banned?"Unban":"Ban"}

            </button>
            `
            : "<b>Owner</b>"
          }

          ${
            currentRole==="superadmin"
            ? roleButtons(d.id,u.role)
            : ""
          }

        </div>
      </td>
    `;

    list.appendChild(tr);

  });
}


// ================= ROLE BUTTONS =================

function roleButtons(uid,role){

  if(role==="superadmin") return "";

  return `

    <button
      class="btn-dev"
      onclick="setRole('${uid}','developer')">

      Dev

    </button>

    <button
      class="btn-admin"
      onclick="setRole('${uid}','admin')">

      Admin

    </button>

    <button
      class="btn-player"
      onclick="setRole('${uid}','player')">

      Player

    </button>
  `;
}


// ================= ROLE CHANGE =================

window.setRole=async(uid,newRole)=>{

  if(currentRole!=="superadmin"){
    alert("No permission");
    return;
  }

  if(!confirm("Change role?")) return;

  const ref=doc(db,"users",uid);

  const snap=await getDoc(ref);

  if(!snap.exists()) return;

  if(snap.data().role==="superadmin"){
    alert("Protected");
    return;
  }

  await updateDoc(ref,{role:newRole});

  await addLog("role",uid,newRole);

  loadUsers();
};


// ================= ACTIONS =================


// Verify
window.toggleVerify=async(id)=>{

  const ref=doc(db,"users",id);

  const snap=await getDoc(ref);

  if(!snap.exists()) return;

  const newStatus=
    snap.data().status==="verified"
    ? "rejected"
    : "verified";

  await updateDoc(ref,{status:newStatus});

  await addLog("verify",id,newStatus);

  loadUsers();
};


// Ban
window.toggleBan=async(id,banned)=>{

  const snap=await getDoc(doc(db,"users",id));

  if(snap.data().role==="superadmin"){
    alert("Cannot ban owner");
    return;
  }

  await updateDoc(
    doc(db,"users",id),
    {banned:!banned}
  );

  await addLog("ban",id,!banned);

  loadUsers();
};


// ================= LOGS =================

async function addLog(action,id,value){

  await addDoc(collection(db,"adminLogs"),{

    admin:currentUser.email,

    action,
    targetId:id,
    value,

    time:serverTimestamp()
  });
}


async function loadLogs(){

  const body=document.getElementById("logBody");
  if(!body) return;

  const q=query(
    collection(db,"adminLogs"),
    orderBy("time","desc")
  );

  const snap=await getDocs(q);

  body.innerHTML="";

  snap.forEach(d=>{

    const l=d.data();

    const tr=document.createElement("tr");

    tr.innerHTML=`

      <td>${l.time?.toDate().toLocaleString()||"-"}</td>
      <td>${l.admin||"-"}</td>
      <td>${l.action||"-"}</td>
      <td>${l.value||"-"}</td>

    `;

    body.appendChild(tr);

  });
}


// ================= LOGOUT =================

window.logout=async()=>{

  await signOut(auth);

  location="index.html";
};
