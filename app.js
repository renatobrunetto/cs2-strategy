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

let previewLock = false;

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
const stepButtons = document.getElementById("stepButtons");

const videoPreview = document.getElementById("video-preview");
const videoFrame = document.getElementById("video-frame");

// =======================
// 🔹 AUTH
// =======================
loginBtn.onclick = async () => {
  await signInWithPopup(auth, provider);
};

logoutBtn.onclick = async () => {
  await signOut(auth);
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
  await loadStrategies();
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

  const publicSnap = await getDocs(
    query(collection(db, "strategies"), where("isPublic", "==", true))
  );

  mySnap.forEach(d => {
    renderStrategy(d, true);
  });

  publicSnap.forEach(d => {
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

  const actions = document.createElement("div");
  actions.className = "strategy-actions";

  if (isMine) {
    const toggle = document.createElement("button");
    toggle.textContent = data.isPublic ? "🌐" : "🔒";
    toggle.onclick = async e => {
      e.stopPropagation();
      await updateDoc(doc(db, "strategies", docSnap.id), {
        isPublic: !data.isPublic
      });
      loadStrategies();
    };

    const del = document.createElement("button");
    del.textContent = "🗑️";
    del.onclick = async e => {
      e.stopPropagation();
      if (!confirm("Excluir estratégia?")) return;
      await deleteDoc(doc(db, "strategies", docSnap.id));
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

    document.querySelectorAll(".strategy-card")
      .forEach(c => c.classList.remove("active"));
    card.classList.add("active");

    showEditor();
    loadSteps();
    await loadStepFromDB(1);
    highlightActiveStep();
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
  stepButtons.innerHTML = "";

  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;

    btn.onclick = async () => {
      await saveCurrentStep();
      currentStep = i;
      await loadStepFromDB(i);
      highlightActiveStep();
    };

    stepButtons.appendChild(btn);
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
  if (!stepStates[step]) {
    stepStates[step] = { players: [], grenades: [], bomb: null };
  }
}

// =======================
// 🔹 TOOLS
// =======================
document.querySelectorAll("[data-type]").forEach(btn => {
  btn.onclick = async () => {
    if (!currentStrategyId) return;
    ensureStepState(currentStep);

    const type = btn.dataset.type;

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

    el.oncontextmenu = async e => {
      e.preventDefault();
      state.players = state.players.filter(x => x.id !== p.id);
      renderStep();
      await saveCurrentStep();
    };

    makeDraggable(el, p);
    mapContainer.appendChild(el);
  });

  state.grenades.forEach(g => {
    const el = document.createElement("div");
    el.className = `grenade ${g.type}`;
    el.style.left = g.x + "px";
    el.style.top = g.y + "px";

    if (g.youtubeId) {
      el.classList.add("has-video");
      el.onmouseenter = e => {
        showVideoPreview(grenade.youtubeId, e.clientX, e.clientY);
      };
      
      el.onmouseleave = hideVideoPreviewDelayed;
    }

    el.ondblclick = () => openGrenadeEditor(g);

    el.oncontextmenu = async e => {
      e.preventDefault();
      state.grenades = state.grenades.filter(x => x.id !== g.id);
      renderStep();
      await saveCurrentStep();
    };

    makeDraggable(el, g);
    mapContainer.appendChild(el);
  });

  if (state.bomb) {
    const el = document.createElement("div");
    el.className = state.bomb.planted ? "bomb planted" : "bomb";
    el.style.left = state.bomb.x + "px";
    el.style.top = state.bomb.y + "px";

    el.oncontextmenu = async e => {
      e.preventDefault();
      state.bomb = null;
      renderStep();
      await saveCurrentStep();
    };

    makeDraggable(el, state.bomb);
    mapContainer.appendChild(el);
  }
}

// =======================
// 🔹 DRAG
// =======================
function makeDraggable(el, data) {
  let dragging = false, ox = 0, oy = 0;

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
// 🔹 VIDEO PREVIEW
// =======================
let previewHover = false;

function showVideoPreview(youtubeId, x, y) {
  const preview = document.getElementById("video-preview");
  const frame = document.getElementById("video-frame");

  frame.src = `https://www.youtube.com/embed/${youtubeId}`;
  preview.style.left = `${x + 12}px`;
  preview.style.top = `${y + 12}px`;
  preview.classList.remove("hidden");

  previewHover = true;
}

function hideVideoPreviewDelayed() {
  previewHover = false;
  setTimeout(() => {
    if (!previewHover) {
      hideVideoPreview();
    }
  }, 200);
}

function hideVideoPreview() {
  const preview = document.getElementById("video-preview");
  const frame = document.getElementById("video-frame");

  frame.src = "";
  preview.classList.add("hidden");
}

// =======================
// 🔹 GRENADE EDITOR
// =======================
function openGrenadeEditor(grenade) {
  const url = prompt("Cole o link do YouTube");
  if (!url) return;
  grenade.youtubeId = extractYoutubeId(url);
  saveCurrentStep();
  renderStep();
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
// 🔹 VIDEO PREVIEW HOVER FIX
// =======================
let previewHover = false;

const videoPreview = document.getElementById("video-preview");

if (videoPreview) {
  videoPreview.addEventListener("mouseenter", () => {
    previewHover = true;
  });

  videoPreview.addEventListener("mouseleave", () => {
    previewHover = false;
    hideVideoPreviewDelayed();
  });
}

