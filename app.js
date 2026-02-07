// =======================
// 🔹 IMPORTS
// =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
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

// =======================
// 🔹 DOM
// =======================
const loginBtn = document.getElementById("loginBtn");
const status = document.getElementById("status");

const newStrategyInput = document.getElementById("newStrategyName");
const createStrategyBtn = document.getElementById("createStrategyBtn");

const myPrivateList = document.getElementById("myPrivateStrategyList");
const myPublicList = document.getElementById("myPublicStrategyList");
const publicList = document.getElementById("publicStrategyList");

const addPlayerBtn = document.getElementById("addPlayerBtn");
const addBombBtn = document.getElementById("addBombBtn");

const mapContainer = document.getElementById("map-container");

const editorEmpty = document.getElementById("editor-empty");
const editorContent = document.getElementById("editor-content");

// =======================
// 🔹 AUTH
// =======================
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const userNameEl = document.getElementById("userName");
const logoutBtn = document.getElementById("logoutBtn");

// LOGIN
loginBtn.onclick = async () => {
  showLoader();
  await signInWithPopup(auth, provider);
  hideLoader();
};

// AUTH STATE
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginView.style.display = "flex";
    appView.style.display = "none";
    hideEditor();
    return;    
  }

  // LOGADO
  currentUserId = user.uid;
  userNameEl.textContent = user.displayName;

  loginView.style.display = "none";
  appView.style.display = "block";

  showLoader();
  await loadStrategies();
  hideLoader();
});

// LOGOUT
logoutBtn.onclick = async () => {
  showLoader();
  await auth.signOut();
  hideLoader();
};

// =======================
// 🔹 LOAD STRATEGIES
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

  mySnap.forEach(docSnap => {
    renderStrategy(docSnap, true);
  });

  pubSnap.forEach(docSnap => {
    if (docSnap.data().ownerId !== currentUserId) {
      renderStrategy(docSnap, false);
    }
  });

  // 🔹 EMPTY STATES (APÓS renderizar)
  if (!myPrivateList.children.length) {
    myPrivateList.innerHTML = `
      <div class="empty-state">
        Você ainda não criou estratégias privadas
      </div>`;
  }

  if (!myPublicList.children.length) {
    myPublicList.innerHTML = `
      <div class="empty-state">
        Nenhuma estratégia pública sua ainda
      </div>`;
  }

  if (!publicList.children.length) {
    publicList.innerHTML = `
      <div class="empty-state">
        Nenhuma estratégia pública disponível
      </div>`;
  }
}


// =======================
// 🔹 RENDER STRATEGY CARD
// =======================
function renderStrategy(docSnap, isMine) {
  const data = docSnap.data();

  const card = document.createElement("div");
  card.className = "strategy-card";
  card.dataset.id = docSnap.id;

  const info = document.createElement("div");
  info.className = "strategy-info";

  const icon = document.createElement("span");
  icon.className = "strategy-icon";
  icon.textContent = data.isPublic ? "👁️" : "🔒";

  const name = document.createElement("span");
  name.className = "strategy-name";
  name.textContent = data.name;

  info.appendChild(icon);
  info.appendChild(name);

  const actions = document.createElement("div");
  actions.className = "strategy-actions";

  // Toggle public/private
  if (isMine) {
    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "🔁";
    toggleBtn.title = "Alterar visibilidade";

    toggleBtn.onclick = async (e) => {
      e.stopPropagation();
      await updateDoc(
        doc(db, "strategies", docSnap.id),
        { isPublic: !data.isPublic }
      );
      loadStrategies();
    };

    actions.appendChild(toggleBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.title = "Excluir estratégia";

    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      if (currentStrategyId === docSnap.id) {
        currentStrategyId = null;
        hideEditor();
      }
      if (!confirm("Excluir esta estratégia?")) return;

      await setDoc(
        doc(db, "strategies", docSnap.id),
        {},
        { merge: false }
      );

      if (currentStrategyId === docSnap.id) {
        currentStrategyId = null;
        mapContainer.querySelectorAll(".player, .grenade, .bomb")
          .forEach(el => el.remove());
      }

      loadStrategies();
    };

    actions.appendChild(deleteBtn);
  }

  card.appendChild(info);
  card.appendChild(actions);

  card.onclick = async () => {
    currentStrategyId = docSnap.id;
    currentStep = 1;
  
    // 🔥 RESET TOTAL DE ESTADO
    Object.keys(stepStates).forEach(k => delete stepStates[k]);
  
    // 🔥 UI
    showEditor();
  
    document.querySelectorAll(".strategy-card")
      .forEach(c => c.classList.remove("active"));
    card.classList.add("active");
  
    // 🔥 PASSOS PRIMEIRO
    loadSteps();
    highlightActiveStep();
  
    // 🔥 AGORA CARREGA O STEP
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

// =======================
// 🔹 CREATE STRATEGY
// =======================
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
// 🔹 STEP STATE
// =======================
function ensureStepState(step) {
  if (!stepStates[step]) stepStates[step] = {};
  stepStates[step].players ||= [];
  stepStates[step].grenades ||= [];
  stepStates[step].bomb ||= null;
}

// =======================
// 🔹 STEPS UI
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
      btn.classList.toggle(
        "active",
        Number(btn.textContent) === currentStep
      );
    });
}

// =======================
// 🔹 EDITOR ACTIONS
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

document.querySelectorAll("#grenade-tools button")
  .forEach(btn => {
    btn.onclick = async () => {
      if (!currentStrategyId) return;
      ensureStepState(currentStep);

      stepStates[currentStep].grenades.push({
        id: `g${Date.now()}`,
        type: btn.dataset.type,
        x: 120,
        y: 120
      });

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

  // =======================
  // PLAYERS
  // =======================
  state.players.forEach(player => {
    const el = document.createElement("div");
    el.className = "player";
    el.style.left = `${player.x}px`;
    el.style.top = `${player.y}px`;

    // 🔥 REMOVER COM BOTÃO DIREITO
    el.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      state.players = state.players.filter(p => p.id !== player.id);
      renderStep();
      await saveCurrentStep();
    });

    makeDraggable(el, player);
    mapContainer.appendChild(el);
  });

  // =======================
  // GRENADES
  // =======================
  state.grenades.forEach(grenade => {
    const el = document.createElement("div");
    el.className = `grenade ${grenade.type}`;
    el.style.left = `${grenade.x}px`;
    el.style.top = `${grenade.y}px`;

    // 🔥 REMOVER COM BOTÃO DIREITO
    el.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      state.grenades = state.grenades.filter(g => g.id !== grenade.id);
      renderStep();
      await saveCurrentStep();
    });

    makeDraggable(el, grenade);
    mapContainer.appendChild(el);
  });

  // =======================
  // BOMB
  // =======================
  if (state.bomb) {
    const el = document.createElement("div");
    el.className = state.bomb.planted ? "bomb planted" : "bomb";
    el.style.left = `${state.bomb.x}px`;
    el.style.top = `${state.bomb.y}px`;

    // 🔥 PLANTAR / DESPLANTAR (DUPLO CLIQUE)
    el.addEventListener("dblclick", async () => {
      state.bomb.planted = !state.bomb.planted;
      renderStep();
      await saveCurrentStep();
    });

    // 🔥 REMOVER COM BOTÃO DIREITO
    el.addEventListener("contextmenu", async (e) => {
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
// 🔹 DRAG
// =======================
function makeDraggable(el, data) {
  let dragging = false;
  let ox = 0;
  let oy = 0;

  el.addEventListener("mousedown", e => {
    dragging = true;
    ox = e.offsetX;
    oy = e.offsetY;
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    const rect = mapContainer.getBoundingClientRect();
    data.x = e.clientX - rect.left - ox;
    data.y = e.clientY - rect.top - oy;
    el.style.left = `${data.x}px`;
    el.style.top = `${data.y}px`;
  });

  document.addEventListener("mouseup", async () => {
    if (!dragging) return;
    dragging = false;
    
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

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showLoader() {
  document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}

function showEditor() {
  editorEmpty.style.display = "none";
  editorContent.style.display = "block";
}

function hideEditor() {
  editorContent.style.display = "none";
  editorEmpty.style.display = "flex";
}

