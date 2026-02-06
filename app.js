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
let currentStrategyOwner = null;
let currentStep = 1;

const stepStates = {};

// =======================
// 🔹 DOM
// =======================
const loginBtn = document.getElementById("loginBtn");
const status = document.getElementById("status");

const newStrategyInput = document.getElementById("newStrategyName");
const createStrategyBtn = document.getElementById("createStrategyBtn");
const deleteStrategyBtn = document.getElementById("deleteStrategyBtn");
const publicToggle = document.getElementById("publicToggle");
const publicCheckbox = document.getElementById("isPublicCheckbox");

const myStrategyList = document.getElementById("myStrategyList");
const publicStrategyList = document.getElementById("publicStrategyList");

const addPlayerBtn = document.getElementById("addPlayerBtn");
const addBombBtn = document.getElementById("addBombBtn");

const mapContainer = document.getElementById("map-container");

// =======================
// 🔹 AUTH
// =======================
loginBtn.onclick = async () => {
  await signInWithPopup(auth, provider);
};

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  currentUserId = user.uid;
  status.textContent = `Logado como ${user.displayName}`;
  loginBtn.style.display = "none";

  await loadStrategies();
});

// =======================
// 🔹 STRATEGIES (PUBLIC / PRIVATE)
// =======================
async function loadStrategies() {
  myStrategyList.innerHTML = "";
  publicStrategyList.innerHTML = "";

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
}

function renderStrategy(docSnap, isMine) {
  const li = document.createElement("li");
  li.textContent = docSnap.data().name;

  if (docSnap.data().isPublic) {
    const tag = document.createElement("span");
    tag.textContent = " 👁️";
    tag.className = "strategy-public";
    li.appendChild(tag);
  }

  li.onclick = async () => {
    currentStrategyId = docSnap.id;
    currentStrategyOwner = docSnap.data().ownerId;
    currentStep = 1;

    document.querySelectorAll("#myStrategyList li, #publicStrategyList li")
      .forEach(li => li.classList.remove("active"));
    li.classList.add("active");

    deleteStrategyBtn.style.display = isMine ? "block" : "none";
    publicToggle.style.display = isMine ? "block" : "none";
    publicCheckbox.checked = docSnap.data().isPublic;

    await loadStepFromDB(1);
    loadSteps();
    highlightActiveStep();
  };

  (isMine ? myStrategyList : publicStrategyList).appendChild(li);
}

// =======================
// 🔹 CREATE / DELETE / TOGGLE
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

publicCheckbox.onchange = async () => {
  if (!currentStrategyId) return;
  await updateDoc(
    doc(db, "strategies", currentStrategyId),
    { isPublic: publicCheckbox.checked }
  );
};

deleteStrategyBtn.onclick = async () => {
  if (!currentStrategyId) return;
  if (!confirm("Excluir esta estratégia?")) return;

  await setDoc(
    doc(db, "strategies", currentStrategyId),
    {},
    { merge: false }
  );

  currentStrategyId = null;
  deleteStrategyBtn.style.display = "none";
  publicToggle.style.display = "none";
  mapContainer.innerHTML = "";

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
// 🔹 RENDER
// =======================
function renderStep() {
  mapContainer.querySelectorAll(".player, .grenade, .bomb")
    .forEach(el => el.remove());

  const state = stepStates[currentStep];
  if (!state) return;

  // PLAYERS
  state.players.forEach(p => {
    const el = document.createElement("div");
    el.className = "player";
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    makeDraggable(el, p);
    mapContainer.appendChild(el);
  });

  // GRENADES
  state.grenades.forEach(g => {
    const el = document.createElement("div");
    el.className = `grenade ${g.type}`;
    el.style.left = `${g.x}px`;
    el.style.top = `${g.y}px`;
    makeDraggable(el, g);
    mapContainer.appendChild(el);
  });

  // BOMB
  if (state.bomb) {
    const el = document.createElement("div");
    el.className = state.bomb.planted ? "bomb planted" : "bomb";
    el.style.left = `${state.bomb.x}px`;
    el.style.top = `${state.bomb.y}px`;
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
