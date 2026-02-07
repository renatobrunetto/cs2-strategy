// =======================
// 🔹 IMPORTS
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
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =======================
// 🔹 FIREBASE INIT
// =======================
const firebaseConfig = {
  apiKey: "AIzaSyAEX1MOFqLp1UDO8SfN4oMqDQx_8NhEH8w",
  authDomain: "cs2-strategy.firebaseapp.com",
  projectId: "cs2-strategy",
  appId: "1:225150653706:web:b6dbaf3fa480b8765fd6f3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// =======================
// 🔹 GLOBAL STATE
// =======================
let currentUserId = null;
let currentStrategyId = null;
let currentStep = 1;
const stepStates = {};

let draggingEl = null;
let draggingData = null;
let offsetX = 0;
let offsetY = 0;

// =======================
// 🔹 DOM
// =======================
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userNameEl = document.getElementById("userName");

const newStrategyInput = document.getElementById("newStrategyName");
const createStrategyBtn = document.getElementById("createStrategyBtn");

const myPrivateList = document.getElementById("myPrivateStrategyList");
const myPublicList = document.getElementById("myPublicStrategyList");
const publicList = document.getElementById("publicStrategyList");

const editorEmpty = document.getElementById("editor-empty");
const editorContent = document.getElementById("editor-content");

const addPlayerBtn = document.getElementById("addPlayerBtn");
const mapContainer = document.getElementById("map-container");

// =======================
// 🔹 AUTH
// =======================
loginBtn.onclick = async () => {
  showLoader();
  await signInWithPopup(auth, provider);
  hideLoader();
};

logoutBtn.onclick = async () => {
  showLoader();
  await signOut(auth);
  hideLoader();
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginView.style.display = "flex";
    appView.style.display = "none";
    hideEditor();
    return;
  }

  currentUserId = user.uid;
  userNameEl.textContent = user.displayName;

  loginView.style.display = "none";
  appView.style.display = "block";

  hideEditor();
  showLoader();
  await loadStrategies();
  hideLoader();
});

// =======================
// 🔹 STRATEGIES
// =======================
async function loadStrategies() {
  myPrivateList.innerHTML = "";
  myPublicList.innerHTML = "";
  publicList.innerHTML = "";

  const mySnap = await getDocs(
    query(collection(db, "strategies"), where("ownerId", "==", currentUserId))
  );

  const pubSnap = await getDocs(
    query(collection(db, "strategies"), where("isPublic", "==", true))
  );

  mySnap.forEach(docSnap => renderStrategy(docSnap, true));
  pubSnap.forEach(docSnap => {
    if (docSnap.data().ownerId !== currentUserId) {
      renderStrategy(docSnap, false);
    }
  });
}

function renderStrategy(docSnap, isMine) {
  const data = docSnap.data();

  const card = document.createElement("div");
  card.className = "strategy-card";

  const info = document.createElement("div");
  info.className = "strategy-info";
  info.textContent = data.name;

  const actions = document.createElement("div");
  actions.className = "strategy-actions";

  if (isMine) {
    const toggle = document.createElement("button");
    toggle.textContent = data.isPublic ? "🌐" : "🔒";
    toggle.dataset.tooltip = "Alterar visibilidade";
    toggle.onclick = async (e) => {
      e.stopPropagation();
      await updateDoc(doc(db, "strategies", docSnap.id), {
        isPublic: !data.isPublic
      });
      loadStrategies();
    };

    const del = document.createElement("button");
    del.textContent = "🗑️";
    del.classList.add("delete");
    del.dataset.tooltip = "Excluir estratégia";
    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Excluir estratégia?")) return;
      await setDoc(doc(db, "strategies", docSnap.id), {}, { merge: false });
      if (currentStrategyId === docSnap.id) hideEditor();
      loadStrategies();
    };

    actions.append(toggle, del);
  }

  card.append(info, actions);

  card.onclick = async () => {
    currentStrategyId = docSnap.id;
    currentStep = 1;
    Object.keys(stepStates).forEach(k => delete stepStates[k]);

    document.querySelectorAll(".strategy-card").forEach(c => c.classList.remove("active"));
    card.classList.add("active");

    showEditor();
    loadSteps();
    highlightActiveStep();
    await loadStepFromDB(1);
  };

  (isMine
    ? data.isPublic ? myPublicList : myPrivateList
    : publicList
  ).appendChild(card);
}

// =======================
// 🔹 CREATE STRATEGY
// =======================
createStrategyBtn.onclick = async () => {
  const name = newStrategyInput.value.trim();
  if (!name) return;

  await addDoc(collection(db, "strategies"), {
    name,
    map: "dust2",
    ownerId: currentUserId,
    isPublic: false,
    createdAt: new Date()
  });

  newStrategyInput.value = "";
  loadStrategies();
};

// =======================
// 🔹 EDITOR VISIBILITY
// =======================
function showEditor() {
  editorEmpty.style.display = "none";
  editorContent.style.display = "block";
}

function hideEditor() {
  editorContent.style.display = "none";
  editorEmpty.style.display = "flex";
}

// =======================
// 🔹 STEPS
// =======================
function loadSteps() {
  const c = document.getElementById("stepButtons");
  c.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const b = document.createElement("button");
    b.textContent = i;
    b.onclick = async () => {
      await saveCurrentStep();
      currentStep = i;
      await loadStepFromDB(i);
      highlightActiveStep();
    };
    c.appendChild(b);
  }
}

function highlightActiveStep() {
  document.querySelectorAll("#stepButtons button")
    .forEach(b => b.classList.toggle("active", Number(b.textContent) === currentStep));
}

// =======================
// 🔹 STEP STATE
// =======================
function ensureStepState(step) {
  if (!stepStates[step]) stepStates[step] = { players: [], grenades: [], bomb: null };
}

// =======================
// 🔹 ADD ELEMENTS
// =======================
addPlayerBtn.onclick = async () => {
  if (!currentStrategyId) return;
  ensureStepState(currentStep);
  stepStates[currentStep].players.push({
    id: `p${Date.now()}`,
    x: 100,
    y: 100
  });
  renderStep();
  saveCurrentStep();
};

document.querySelectorAll("[data-type]").forEach(btn => {
  btn.onclick = async () => {
    if (!currentStrategyId) return;
    ensureStepState(currentStep);

    const type = btn.dataset.type;

    if (type === "bomb") {
      stepStates[currentStep].bomb = stepStates[currentStep].bomb
        ? null
        : { x: 200, y: 200, planted: false };
    } else {
      stepStates[currentStep].grenades.push({
        id: `g${Date.now()}`,
        type,
        x: 150,
        y: 150,
        youtubeId: null
      });
    }

    renderStep();
    saveCurrentStep();
  };
});

// =======================
// 🔹 RENDER STEP
// =======================
function renderStep() {
  mapContainer.querySelectorAll(".player,.grenade,.bomb").forEach(e => e.remove());
  const state = stepStates[currentStep];
  if (!state) return;

  state.players.forEach(p => createElement("player", p, state.players));
  state.grenades.forEach(g => createElement(`grenade ${g.type}`, g, state.grenades, true));
  if (state.bomb) createElement("bomb", state.bomb, null);
}

function createElement(cls, data, list, isGrenade = false) {
  const el = document.createElement("div");
  el.className = cls;
  el.style.left = `${data.x}px`;
  el.style.top = `${data.y}px`;

  el.oncontextmenu = async e => {
    e.preventDefault();
    if (list) list.splice(list.indexOf(data), 1);
    else stepStates[currentStep].bomb = null;
    renderStep();
    saveCurrentStep();
  };

  el.onmousedown = e => {
    draggingEl = el;
    draggingData = data;
    offsetX = e.offsetX;
    offsetY = e.offsetY;
  };

  if (isGrenade && data.youtubeId) {
    el.addEventListener("mouseenter", e => showVideoPreview(data.youtubeId, el));
    el.addEventListener("mouseleave", scheduleHidePreview);
    el.ondblclick = () => openGrenadeEditor(data);
  }

  mapContainer.appendChild(el);
}

// =======================
// 🔹 DRAG GLOBAL
// =======================
document.addEventListener("mousemove", e => {
  if (!draggingEl) return;
  const r = mapContainer.getBoundingClientRect();
  draggingData.x = Math.max(0, Math.min(e.clientX - r.left - offsetX, r.width));
  draggingData.y = Math.max(0, Math.min(e.clientY - r.top - offsetY, r.height));
  draggingEl.style.left = `${draggingData.x}px`;
  draggingEl.style.top = `${draggingData.y}px`;
});

document.addEventListener("mouseup", async () => {
  if (!draggingEl) return;
  draggingEl = null;
  draggingData = null;
  saveCurrentStep();
});

// =======================
// 🔹 VIDEO PREVIEW
// =======================
let hideTimeout = null;

function showVideoPreview(id, anchor) {
  const p = document.getElementById("video-preview");
  const f = document.getElementById("video-frame");

  const r = anchor.getBoundingClientRect();
  p.style.left = `${r.right + 8}px`;
  p.style.top = `${r.top}px`;

  f.src = `https://www.youtube.com/embed/${id}`;
  p.classList.remove("hidden");
}

function scheduleHidePreview() {
  hideTimeout = setTimeout(hideVideoPreview, 200);
}

function hideVideoPreview() {
  const p = document.getElementById("video-preview");
  const f = document.getElementById("video-frame");
  f.src = "";
  p.classList.add("hidden");
}

// =======================
// 🔹 GRENADE MODAL
// =======================
function openGrenadeEditor(grenade) {
  const modal = document.getElementById("grenade-modal");
  if (!modal) return;

  const input = modal.querySelector("#grenadeVideoInput");
  input.value = grenade.youtubeId
    ? `https://www.youtube.com/watch?v=${grenade.youtubeId}`
    : "";

  modal.classList.add("open");

  modal.querySelector("#saveGrenadeVideo").onclick = async () => {
    grenade.youtubeId = extractYoutubeId(input.value);
    modal.classList.remove("open");
    saveCurrentStep();
    renderStep();
  };

  modal.querySelector("#removeGrenadeVideo").onclick = async () => {
    grenade.youtubeId = null;
    modal.classList.remove("open");
    saveCurrentStep();
    renderStep();
  };
}

function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get("v") || u.pathname.replace("/", "");
  } catch {
    return null;
  }
}

// =======================
// 🔹 FIRESTORE
// =======================
async function saveCurrentStep() {
  if (!currentStrategyId) return;
  ensureStepState(currentStep);
  await setDoc(
    doc(db, "strategies", currentStrategyId, "steps", String(currentStep)),
    { stepNumber: currentStep, state: stepStates[currentStep] }
  );
}

async function loadStepFromDB(step) {
  const snap = await getDoc(
    doc(db, "strategies", currentStrategyId, "steps", String(step))
  );
  stepStates[step] = snap.exists() ? snap.data().state : {};
  ensureStepState(step);
  renderStep();
}

// =======================
// 🔹 UI
// =======================
function showLoader() {
  document.getElementById("loader").classList.remove("hidden");
}
function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}
