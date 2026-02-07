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
  updateDoc,
  deleteDoc
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
const SNAP_THRESHOLD = 6;

// =======================
// 🔹 DOM (SAFE)
// =======================
const $ = id => document.getElementById(id);

const loginView = $("login-view");
const appView = $("app-view");

const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");
const userNameEl = $("userName");

const newStrategyInput = $("newStrategyName");
const createStrategyBtn = $("createStrategyBtn");

const myPrivateList = $("myPrivateStrategyList");
const myPublicList = $("myPublicStrategyList");
const publicList = $("publicStrategyList");

const editorEmpty = $("editor-empty");
const editorContent = $("editor-content");
const mapContainer = $("map-container");

// =======================
// 🔹 AUTH
// =======================
loginBtn?.addEventListener("click", async () => {
  showLoader();
  await signInWithPopup(auth, provider);
  hideLoader();
});

logoutBtn?.addEventListener("click", async () => {
  showLoader();
  await signOut(auth);
  hideLoader();
});

onAuthStateChanged(auth, async user => {
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

  const myQuery = query(
    collection(db, "strategies"),
    where("ownerId", "==", currentUserId)
  );

  const publicQuery = query(
    collection(db, "strategies"),
    where("isPublic", "==", true)
  );

  const mySnap = await getDocs(myQuery);
  const pubSnap = await getDocs(publicQuery);

  mySnap.forEach(docSnap => renderStrategy(docSnap, true));
  pubSnap.forEach(docSnap => {
    if (docSnap.data().ownerId !== currentUserId) {
      renderStrategy(docSnap, false);
    }
  });

  if (!myPrivateList.children.length)
    myPrivateList.innerHTML = `<div class="empty-state">Sem estratégias privadas</div>`;

  if (!myPublicList.children.length)
    myPublicList.innerHTML = `<div class="empty-state">Sem estratégias públicas suas</div>`;

  if (!publicList.children.length)
    publicList.innerHTML = `<div class="empty-state">Nenhuma estratégia pública</div>`;
}

function renderStrategy(docSnap, isMine) {
  const data = docSnap.data();

  const card = document.createElement("div");
  card.className = "strategy-card";
  card.dataset.id = docSnap.id;

  const info = document.createElement("div");
  info.className = "strategy-info";
  info.textContent = data.name;

  const actions = document.createElement("div");
  actions.className = "strategy-actions";

  if (isMine) {
    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "🔁";
    toggleBtn.onclick = async e => {
      e.stopPropagation();
      await updateDoc(doc(db, "strategies", docSnap.id), {
        isPublic: !data.isPublic
      });
      loadStrategies();
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.onclick = async e => {
      e.stopPropagation();
      if (!confirm("Excluir estratégia?")) return;

      await deleteDoc(doc(db, "strategies", docSnap.id));
      if (currentStrategyId === docSnap.id) {
        currentStrategyId = null;
        hideEditor();
      }
      loadStrategies();
    };

    actions.append(toggleBtn, deleteBtn);
  }

  card.append(info, actions);

  card.onclick = async () => {
    currentStrategyId = docSnap.id;
    currentStep = 1;
    Object.keys(stepStates).forEach(k => delete stepStates[k]);

    document.querySelectorAll(".strategy-card")
      .forEach(c => c.classList.remove("active"));
    card.classList.add("active");

    showEditor();
    loadSteps();
    highlightActiveStep();

    showLoader();
    await loadStepFromDB(1);
    hideLoader();
  };

  if (isMine) {
    (data.isPublic ? myPublicList : myPrivateList).appendChild(card);
  } else {
    publicList.appendChild(card);
  }
}

createStrategyBtn?.addEventListener("click", async () => {
  const name = newStrategyInput.value.trim();
  if (!name) return;

  showLoader();
  await addDoc(collection(db, "strategies"), {
    name,
    map: "dust2",
    ownerId: currentUserId,
    isPublic: false,
    createdAt: new Date()
  });
  hideLoader();

  newStrategyInput.value = "";
  loadStrategies();
});

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
  const container = $("stepButtons");
  container.innerHTML = "";

  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;

    btn.onclick = async () => {
      await saveCurrentStep();
      currentStep = i;
      await loadStepFromDB(i);
      highlightActiveStep();
    };

    container.appendChild(btn);
  }
}

function highlightActiveStep() {
  document.querySelectorAll("#stepButtons button")
    .forEach(btn =>
      btn.classList.toggle("active", Number(btn.textContent) === currentStep)
    );
}

// =======================
// 🔹 STEP STATE
// =======================
function ensureStepState(step) {
  if (!stepStates[step]) stepStates[step] = {};
  stepStates[step].players ||= [];
  stepStates[step].grenades ||= [];
  stepStates[step].bomb ||= null;
}

// =======================
// 🔹 TOOLS (UNIFIED)
// =======================
document.querySelectorAll("[data-type]").forEach(btn => {
  btn.addEventListener("click", async () => {
    if (!currentStrategyId) return;

    const type = btn.dataset.type;
    ensureStepState(currentStep);

    if (type === "player") {
      stepStates[currentStep].players.push({
        id: `p${Date.now()}`,
        x: 60,
        y: 60
      });
    } else if (type === "bomb") {
      stepStates[currentStep].bomb =
        stepStates[currentStep].bomb
          ? null
          : { x: 200, y: 200, planted: false };
    } else {
      stepStates[currentStep].grenades.push({
        id: `g${Date.now()}`,
        type,
        x: 120,
        y: 120
      });
    }

    renderStep();
    await saveCurrentStep();
  });
});

// =======================
// 🔹 RENDER STEP
// =======================
function renderStep() {
  mapContainer.querySelectorAll(".player, .grenade, .bomb")
    .forEach(el => el.remove());

  const state = stepStates[currentStep];
  if (!state) return;

  state.players.forEach(p => createElement("player", p));
  state.grenades.forEach(g => createElement(`grenade ${g.type}`, g));

  if (state.bomb) createElement(state.bomb.planted ? "bomb planted" : "bomb", state.bomb);
}

function createElement(className, data) {
  const el = document.createElement("div");
  el.className = className;
  el.style.left = `${data.x}px`;
  el.style.top = `${data.y}px`;

  el.addEventListener("contextmenu", async e => {
    e.preventDefault();
    const state = stepStates[currentStep];
    state.players = state.players.filter(p => p !== data);
    state.grenades = state.grenades.filter(g => g !== data);
    if (state.bomb === data) state.bomb = null;
    renderStep();
    await saveCurrentStep();
  });

  if (className.includes("bomb")) {
    el.addEventListener("dblclick", async () => {
      data.planted = !data.planted;
      renderStep();
      await saveCurrentStep();
    });
  }

  makeDraggable(el, data);
  mapContainer.appendChild(el);
}

// =======================
// 🔹 DRAG
// =======================
function makeDraggable(el, data) {
  let dragging = false;
  let ox = 0;
  let oy = 0;

  el.addEventListener("mousedown", e => {
    e.preventDefault();
    dragging = true;
    ox = e.offsetX;
    oy = e.offsetY;
    el.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;

    const rect = mapContainer.getBoundingClientRect();
    let x = e.clientX - rect.left - ox;
    let y = e.clientY - rect.top - oy;

    const maxX = rect.width - el.offsetWidth;
    const maxY = rect.height - el.offsetHeight;

    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    const centerX = (rect.width - el.offsetWidth) / 2;
    const centerY = (rect.height - el.offsetHeight) / 2;

    if (Math.abs(x - centerX) < SNAP_THRESHOLD) x = centerX;
    if (Math.abs(y - centerY) < SNAP_THRESHOLD) y = centerY;

    data.x = x;
    data.y = y;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  });

  document.addEventListener("mouseup", async () => {
    if (!dragging) return;
    dragging = false;
    el.style.cursor = "grab";
    await saveCurrentStep();
  });
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
  const ref = doc(db, "strategies", currentStrategyId, "steps", String(step));
  const snap = await getDoc(ref);
  stepStates[step] = snap.exists() ? snap.data().state : {};
  ensureStepState(step);
  renderStep();
}

// =======================
// 🔹 UI HELPERS
// =======================
function showLoader() {
  $("loader")?.classList.remove("hidden");
}

function hideLoader() {
  $("loader")?.classList.add("hidden");
}
