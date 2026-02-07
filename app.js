// FIREBASE + AUTH
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyAEX1MOFqLp1UDO8SfN4oMqDQx_8NhEH8w",
  authDomain: "cs2-strategy.firebaseapp.com",
  projectId: "cs2-strategy"
});

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentStrategyId = null;
let currentStep = 1;
const stepStates = {};

const mapContainer = document.getElementById("map-container");

// =======================
// 🔹 DOM REFERENCES
// =======================
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userName = document.getElementById("userName");

const myPrivateStrategyList = document.getElementById("myPrivateStrategyList");
const myPublicStrategyList = document.getElementById("myPublicStrategyList");
const publicStrategyList = document.getElementById("publicStrategyList");

const editorEmpty = document.getElementById("editor-empty");
const editorContent = document.getElementById("editor-content");

const addPlayerBtn = document.getElementById("addPlayerBtn");
const mapContainer = document.getElementById("map-container");


// LOGIN
loginBtn.onclick = () => signInWithPopup(auth, provider);
logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  if (!user) return loginView.style.display = "flex";
  loginView.style.display = "none";
  appView.style.display = "block";
  userName.textContent = user.displayName;
  loadStrategies();
});

// STRATEGIES
async function loadStrategies() {
  myPrivateStrategyList.innerHTML = "";
  myPublicStrategyList.innerHTML = "";
  publicStrategyList.innerHTML = "";

  const mine = await getDocs(query(collection(db,"strategies"), where("ownerId","==",auth.currentUser.uid)));
  mine.forEach(d => renderStrategy(d,true));

  const pub = await getDocs(query(collection(db,"strategies"), where("isPublic","==",true)));
  pub.forEach(d => d.data().ownerId !== auth.currentUser.uid && renderStrategy(d,false));
}

function renderStrategy(docSnap,isMine){
  const c=document.createElement("div");
  c.className="strategy-card";
  c.textContent=docSnap.data().name;
  c.onclick=()=>selectStrategy(docSnap.id);
  (isMine?myPrivateStrategyList:publicStrategyList).appendChild(c);
}

async function selectStrategy(id){
  currentStrategyId=id;
  currentStep=1;
  editorEmpty.style.display="none";
  editorContent.style.display="block";
  await loadStep();
  renderSteps();
}

// STEP
function ensureState(){
  if(!stepStates[currentStep]) stepStates[currentStep]={players:[],grenades:[],bomb:null};
}

addPlayerBtn.onclick=()=>{
  ensureState();
  stepStates[currentStep].players.push({x:100,y:100});
  renderStep();
  saveStep();
};

document.querySelectorAll("[data-type]").forEach(b=>{
  b.onclick=()=>{
    ensureState();
    const t=b.dataset.type;
    if(t==="bomb") stepStates[currentStep].bomb={x:200,y:200};
    else stepStates[currentStep].grenades.push({x:150,y:150,type:t});
    renderStep();
    saveStep();
  };
});

function renderStep(){
  mapContainer.querySelectorAll(".player,.grenade,.bomb").forEach(e=>e.remove());
  const s=stepStates[currentStep];
  if(!s) return;

  s.players.forEach(p=>draw("player",p));
  s.grenades.forEach(g=>draw(`grenade ${g.type}`,g));
  if(s.bomb) draw("bomb",s.bomb);
}

function draw(cls,data){
  const e=document.createElement("div");
  e.className=cls;
  e.style.left=data.x+"px";
  e.style.top=data.y+"px";

  e.oncontextmenu=ev=>{
    ev.preventDefault();
    Object.values(stepStates[currentStep]).forEach(arr=>{
      if(Array.isArray(arr)){
        const i=arr.indexOf(data);
        if(i>-1) arr.splice(i,1);
      }
    });
    renderStep();
    saveStep();
  };

  e.onmousedown=ev=>{
    const ox=ev.offsetX, oy=ev.offsetY;
    document.onmousemove=m=>{
      data.x=m.clientX-mapContainer.offsetLeft-ox;
      data.y=m.clientY-mapContainer.offsetTop-oy;
      e.style.left=data.x+"px";
      e.style.top=data.y+"px";
    };
    document.onmouseup=()=>{
      document.onmousemove=null;
      document.onmouseup=null;
      saveStep();
    };
  };

  mapContainer.appendChild(e);
}

async function saveStep(){
  if(!currentStrategyId) return;
  await setDoc(doc(db,"strategies",currentStrategyId,"steps",String(currentStep)),{
    stepNumber:currentStep,
    state:stepStates[currentStep]
  });
}

async function loadStep(){
  const snap=await getDoc(doc(db,"strategies",currentStrategyId,"steps",String(currentStep)));
  stepStates[currentStep]=snap.exists()?snap.data().state:{players:[],grenades:[],bomb:null};
  renderStep();
}
