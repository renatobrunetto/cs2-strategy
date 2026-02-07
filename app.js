// =======================
// 🔹 FIREBASE + AUTH
// =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =======================
// 🔹 INIT
// =======================
const app = initializeApp({
  apiKey: "AIzaSyAEX1MOFqLp1UDO8SfN4oMqDQx_8NhEH8w",
  authDomain: "cs2-strategy.firebaseapp.com",
  projectId: "cs2-strategy"
});

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// =======================
// 🔹 STATE
// =======================
let currentUser = null;
let currentStrategyId = null;
let currentStep = 1;
const stepStates = {};

// =======================
// 🔹 DOM
// =======================
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userName = document.getElementById("userName");

const newStrategyInput = document.getElementById("newStrategyName");
const createStrategyBtn = document.getElementById("createStrategyBtn");

const myPrivateStrategyList = document.getElementById("myPrivateStrategyList");
const myPublicStrategyList = document.getElementById("myPublicStrategyList");
const publicStrategyList = document.getElementById("publicStrategyList");

const editorEmpty = document.getElementById("editor-empty");
const editorContent = document.getElementById("editor-content");

const addPlayerBtn = document.getElementById("addPlayerBtn");
const mapContainer = document.getElementById("map-container");
const stepButtons = document.getElementById("stepButtons");

// =======================
// 🔹 AUTH
// =======================
loginBtn.onclick = () => signInWithPopup(auth, provider);
logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  if (!user) {
    loginView.style.display = "flex";
    appView.style.display = "none";
    return;
  }

  currentUser = user;
  loginView.style.display = "none";
  appView.style.display = "block";
  userName.textContent = user.displayName;

  await loadStrategies();
});

// =======================
// 🔹 STRATEGIES
// =======================
async function loadStrategies() {
  myPrivateStrategyList.innerHTML = "";
  myPublicStrategyList.innerHTML = "";
  publicStrategyList.innerHTML = "";

  const mineSnap = await getDocs(
    query(collection(db, "strategies"), where("ownerId", "==", currentUser.uid))
  );

  mineSnap.forEach(docSnap => {
    const data = docSnap.data();
    renderStrategy(
      docSnap,
      data.isPublic ? myPublicStrategyList : myPrivateStrategyList,
      true
    );
  });

  const publicSnap = await getDocs(
    query(collection(db, "strategies"), where("isPublic", "==", true))
  );

  publicSnap.forEach(docSnap => {
    if (docSnap.data().ownerId !== currentUser.uid) {
      renderStrategy(docSnap, publicStrategyList, false);
    }
  });
}

function renderStrategy(docSnap, container, isMine) {
  const data = docSnap.data();

  const card = document.createElement("div");
  card.className = "strategy-card";

  const name = document.createElement("div");
  name.className = "strategy-info";
  name.textContent = data.name;
  card.appendChild(name);

  if (isMine) {
    const actions = document.createElement("div");
    actions.className = "strategy-actions";

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = data.isPublic ? "🌐" : "🔒";
    toggleBtn.title = "Alterar visibilidade";
    toggleBtn.onclick = async e => {
      e.stopPropagation();
      await updateDoc(doc(db, "strategies", docSnap.id), {
        isPublic: !data.isPublic
      });
      loadStrategies();
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.title = "Excluir estratégia";
    deleteBtn.onclick = async e => {
      e.stopPropagation();
      if (!confirm("Excluir esta estratégia?")) return;
      await deleteDoc(doc(db, "strategies", docSnap.id));
      if (currentStrategyId === docSnap.id) {
        currentStrategyId = null;
        editorContent.style.display = "none";
        editorEmpty.style.display = "flex";
      }
      loadStrategies();
    };

    actions.append(toggleBtn, deleteBtn);
    card.appendChild(actions);
  }

  card.onclick = async () => {
    // 🔴 reset completo ao trocar de estratégia
    Object.keys(stepStates).forEach(k => delete stepStates[k]);

    currentStrategyId = docSnap.id;
    currentStep = 1;

    editorEmpty.style.display = "none";
    editorContent.style.display = "block";

    loadSteps();
    await loadStep();
    highlightActiveStep();
  };

  container.appendChild(card);
}

// =======================
// 🔹 CREATE STRATEGY
// =======================
createStrategyBtn.onclick = async () => {
  const name = newStrategyInput.value.trim();
  if (!name) return;

  await addDoc(collection(db, "strategies"), {
    name,
    ownerId: currentUser.uid,
    isPublic: false,
    createdAt: new Date()
  });

  newStrategyInput.value = "";
  loadStrategies();
};

// =======================
// 🔹 STEP STATE
// =======================
function ensureState() {
  if (!stepStates[currentStep]) {
    stepStates[currentStep] = { players: [], grenades: [], bomb: null };
  }
}

// =======================
// 🔹 TOOLS
// =======================
addPlayerBtn.onclick = () => {
  if (!currentStrategyId) return;
  ensureState();
  stepStates[currentStep].players.push({ x: 100, y: 100 });
  renderStep();
  saveStep();
};

document.querySelectorAll("[data-type]").forEach(btn => {
  btn.onclick = () => {
    if (!currentStrategyId) return;
    ensureState();
    const type = btn.dataset.type;
    if (type === "bomb") {
      stepStates[currentStep].bomb = { x: 200, y: 200 };
    } else {
      stepStates[currentStep].grenades.push({ x: 150, y: 150, type });
    }
    renderStep();
    saveStep();
  };
});

// =======================
// 🔹 RENDER MAP
// =======================
function renderStep() {
  mapContainer.querySelectorAll(".player,.grenade,.bomb").forEach(e => e.remove());
  const s = stepStates[currentStep];
  if (!s) return;

  s.players.forEach(p => draw("player", p));
  s.grenades.forEach(g => draw(`grenade ${g.type}`, g));
  if (s.bomb) draw("bomb", s.bomb);
}

function draw(cls, data) {
  const el = document.createElement("div");
  el.className = cls;
  el.style.left = data.x + "px";
  el.style.top = data.y + "px";

  el.oncontextmenu = e => {
    e.preventDefault();
    Object.values(stepStates[currentStep]).forEach(arr => {
      if (Array.isArray(arr)) {
        const i = arr.indexOf(data);
        if (i > -1) arr.splice(i, 1);
      }
    });
    renderStep();
    saveStep();
  };

  el.onmousedown = ev => {
    const ox = ev.offsetX;
    const oy = ev.offsetY;
    document.onmousemove = m => {
      data.x = m.clientX - mapContainer.offsetLeft - ox;
      data.y = m.clientY - mapContainer.offsetTop - oy;
      el.style.left = data.x + "px";
      el.style.top = data.y + "px";
    };
    document.onmouseup = () => {
      document.onmousemove = null;
      document.onmouseup = null;
      saveStep();
    };
  };

  mapContainer.appendChild(el);
}

// =======================
// 🔹 FIRESTORE
// =======================
async function saveStep() {
  if (!currentStrategyId) return;
  await setDoc(
    doc(db, "strategies", currentStrategyId, "steps", String(currentStep)),
    { stepNumber: currentStep, state: stepStates[currentStep] }
  );
}

async function loadStep() {
  const snap = await getDoc(
    doc(db, "strategies", currentStrategyId, "steps", String(currentStep))
  );
  stepStates[currentStep] = snap.exists()
    ? snap.data().state
    : { players: [], grenades: [], bomb: null };
  renderStep();
}

// =======================
// 🔹 STEPS UI
// =======================
function loadSteps() {
  stepButtons.innerHTML = "";

  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;

    btn.onclick = async () => {
      if (!currentStrategyId) return;
      await saveStep();
      currentStep = i;
      await loadStep();
      highlightActiveStep();
    };

    stepButtons.appendChild(btn);
  }

  highlightActiveStep();
}

function highlightActiveStep() {
  document.querySelectorAll("#stepButtons button").forEach(btn => {
    btn.classList.toggle("active", Number(btn.textContent) === currentStep);
  });
}
