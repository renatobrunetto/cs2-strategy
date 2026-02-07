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

// SNAP CONFIG
const SNAP_THRESHOLD = 6;

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
const addBombBtn = document.getElementById("addBombBtn");

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

  if (!myPrivateList.children.length) {
    myPrivateList.innerHTML = `<div class="empty-state">Sem estratégias privadas</div>`;
  }

  if (!myPublicList.children.length) {
    myPublicList.innerHTML = `<div class="empty-state">Sem estratégias públicas suas</div>`;
  }

  if (!publicList.children.length) {
    publicList.innerHTML = `<div class="empty-state">Nenhuma estratégia pública</div>`;
  }
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
    toggleBtn.onclick = async (e) => {
      e.stopPropagation();
      await updateDoc(doc(db, "strategies", docSnap.id), {
        isPublic: !data.isPublic
      });
      loadStrategies();
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Excluir estratégia?")) return;

      await setDoc(doc(db, "strategies", docSnap.id), {}, { merge: false });
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

createStrategyBtn.onclick = async () => {
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
  const container = document.getElementById("stepButtons");
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
    .forEach(btn => {
      btn.classList.toggle("active", Number(btn.textContent) === currentStep);
    });
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
// 🔹 TOOLS
// =======================
addPlayerBtn.onclick = async () => {
  if (!currentStrategyId) return;
  ensureStepState(currentStep);

  stepStates[currentStep].players.push({
    id: `p${Date.now()}`,
    x: 60,
    y: 60
  });

  renderStep();
  await saveCurrentStep();
};

addBombBtn.onclick = async () => {
  if (!currentStrategyId) return;
  ensureStepState(currentStep);

  stepStates[currentStep].bomb =
    stepStates[currentStep].bomb
      ? null
      : { x: 200, y: 200, planted: false };

  renderStep();
  await saveCurrentStep();
};

document.querySelectorAll("[data-type]")
  .forEach(btn => {
    btn.onclick = async () => {
      if (!currentStrategyId) return;

      const type = btn.dataset.type;

      // BOMBA
      if (type === "bomb") {
        ensureStepState(currentStep);

        stepStates[currentStep].bomb =
          stepStates[currentStep].bomb
            ? null
            : { x: 200, y: 200, planted: false };

      } 
      // GRANADAS
      else {
        ensureStepState(currentStep);

        stepStates[currentStep].grenades.push({
          id: `g${Date.now()}`,
          type,
          x: 120,
          y: 120
        });
      }

      renderStep();
      await saveCurrentStep();
    };
  });


// =======================
// 🔹 RENDER STEP
// =======================
function renderStep() {
  mapContainer.querySelectorAll(".player, .grenade, .bomb")
    .forEach(el => el.remove());

  const state = stepStates[currentStep];
  if (!state) return;

  state.players.forEach(player => {
    const el = document.createElement("div");
    el.className = "player";
    el.style.left = `${player.x}px`;
    el.style.top = `${player.y}px`;

    el.addEventListener("contextmenu", async e => {
      e.preventDefault();
      state.players = state.players.filter(p => p.id !== player.id);
      renderStep();
      await saveCurrentStep();
    });

    makeDraggable(el, player);
    mapContainer.appendChild(el);
  });

  state.grenades.forEach(grenade => {
    const el = document.createElement("div");
    el.className = `grenade ${grenade.type}`;
    el.style.left = `${grenade.x}px`;
    el.style.top = `${grenade.y}px`;

    el.addEventListener("contextmenu", async e => {
      e.preventDefault();
      state.grenades = state.grenades.filter(g => g.id !== grenade.id);
      renderStep();
      await saveCurrentStep();
    });

    makeDraggable(el, grenade);
    mapContainer.appendChild(el);
  });

  if (state.bomb) {
    const el = document.createElement("div");
    el.className = state.bomb.planted ? "bomb planted" : "bomb";
    el.style.left = `${state.bomb.x}px`;
    el.style.top = `${state.bomb.y}px`;

    el.addEventListener("dblclick", async () => {
      state.bomb.planted = !state.bomb.planted;
      renderStep();
      await saveCurrentStep();
    });

    el.addEventListener("contextmenu", async e => {
      e.preventDefault();
      state.bomb = null;
      renderStep();
      await saveCurrentStep();
    });

    makeDraggable(el, state.bomb);
    mapContainer.appendChild(el);
  }
}

// =======================
// 🔹 DRAG (SNAP + LIMITS)
// =======================
function makeDraggable(el, data) {
  let dragging = false;
  let ox = 0;
  let oy = 0;

  el.addEventListener("mousedown", e => {
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

    // 🔒 limites do mapa
    const maxX = rect.width - el.offsetWidth;
    const maxY = rect.height - el.offsetHeight;

    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    // 🎯 snap suave ao centro (opcional)
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
// 🔹 FIRESTORE STEPS
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
  document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}
