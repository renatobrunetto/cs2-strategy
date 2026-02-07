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

const mapContainer = document.getElementById("map-container");

const videoPreview = document.getElementById("video-preview");
const videoFrame = document.getElementById("video-frame");

let previewLock = false;

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

  mySnap.forEach(d => renderStrategy(d, true));
  pubSnap.forEach(d => {
    if (d.data().ownerId !== currentUserId) {
      renderStrategy(d, false);
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

  card.appendChild(info);

  card.onclick = async () => {
    currentStrategyId = docSnap.id;
    currentStep = 1;
    Object.keys(stepStates).forEach(k => delete stepStates[k]);

    document.querySelectorAll(".strategy-card")
      .forEach(c => c.classList.remove("active"));
    card.classList.add("active");

    showEditor();
    loadSteps();
    await loadStepFromDB(1);
  };

  (isMine ? myPrivateList : publicList).appendChild(card);
}

createStrategyBtn.onclick = async () => {
  const name = newStrategyInput.value.trim();
  if (!name) return;

  await addDoc(collection(db, "strategies"), {
    name,
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
  const container = document.getElementById("stepButtons");
  container.innerHTML = "";

  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;

    btn.onclick = async () => {
      await saveCurrentStep();
      currentStep = i;
      await loadStepFromDB(i);
    };

    container.appendChild(btn);
  }
}

function ensureStepState(step) {
  if (!stepStates[step]) {
    stepStates[step] = { players: [], grenades: [], bomb: null };
  }
}

// =======================
// 🔹 TOOLS (UNIFICADO)
// =======================
document.querySelectorAll("[data-type]").forEach(btn => {
  btn.onclick = async () => {
    if (!currentStrategyId) return;
    const type = btn.dataset.type;

    ensureStepState(currentStep);

    if (type === "player") {
      stepStates[currentStep].players.push({
        id: Date.now(),
        x: 100,
        y: 100
      });
    } else if (type === "bomb") {
      stepStates[currentStep].bomb =
        stepStates[currentStep].bomb ? null : { x: 200, y: 200, planted: false };
    } else {
      stepStates[currentStep].grenades.push({
        id: Date.now(),
        type,
        x: 150,
        y: 150,
        youtubeId: null
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
  mapContainer.querySelectorAll(".player,.grenade,.bomb").forEach(e => e.remove());
  const state = stepStates[currentStep];
  if (!state) return;

  state.players.forEach(p => {
    const el = document.createElement("div");
    el.className = "player";
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    mapContainer.appendChild(el);
    makeDraggable(el, p);
  });

  state.grenades.forEach(g => {
    const el = document.createElement("div");
    el.className = `grenade ${g.type}`;
    el.style.left = g.x + "px";
    el.style.top = g.y + "px";

    if (g.youtubeId) {
      el.classList.add("has-video");

      el.addEventListener("mouseenter", e => {
        previewLock = true;
        showVideoPreview(g.youtubeId, e.clientX, e.clientY);
      });

      el.addEventListener("mouseleave", () => {
        previewLock = false;
        setTimeout(hideVideoPreview, 200);
      });
    }

    el.addEventListener("dblclick", () => openGrenadeEditor(g));
    mapContainer.appendChild(el);
    makeDraggable(el, g);
  });
}

// =======================
// 🔹 VIDEO PREVIEW
// =======================
function showVideoPreview(id, x, y) {
  videoFrame.src = `https://www.youtube.com/embed/${id}`;
  videoPreview.style.left = x + 12 + "px";
  videoPreview.style.top = y + 12 + "px";
  videoPreview.classList.remove("hidden");
}

function hideVideoPreview() {
  if (previewLock) return;
  videoFrame.src = "";
  videoPreview.classList.add("hidden");
}

videoPreview.addEventListener("mouseenter", () => previewLock = true);
videoPreview.addEventListener("mouseleave", () => {
  previewLock = false;
  hideVideoPreview();
});

// =======================
// 🔹 DRAG
// =======================
function makeDraggable(el, data) {
  let dragging = false;
  let ox, oy;

  el.onmousedown = e => {
    dragging = true;
    ox = e.offsetX;
    oy = e.offsetY;
  };

  document.onmousemove = e => {
    if (!dragging) return;
    const rect = mapContainer.getBoundingClientRect();
    data.x = e.clientX - rect.left - ox;
    data.y = e.clientY - rect.top - oy;
    el.style.left = data.x + "px";
    el.style.top = data.y + "px";
  };

  document.onmouseup = async () => {
    if (!dragging) return;
    dragging = false;
    await saveCurrentStep();
  };
}

// =======================
// 🔹 GRENADE EDITOR
// =======================
function openGrenadeEditor(grenade) {
  const url = prompt("Cole o link do YouTube:");
  if (!url) return;
  grenade.youtubeId = extractYoutubeId(url);
  saveCurrentStep();
  renderStep();
}

function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get("v") || u.pathname.slice(1);
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
    { state: stepStates[currentStep] }
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
// 🔹 UI HELPERS
// =======================
function showLoader() {
  document.getElementById("loader").classList.remove("hidden");
}
function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}
