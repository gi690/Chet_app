import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  setDoc,
  doc,
  getDocs,
  deleteDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  projectId: "chattybot-xvkr3",
  appId: "1:483565624410:web:91d32a0d4ede2b7aac4c63",
  apiKey: "AIzaSyD-hGEbt22iMcNCt2dZnV193jwNiiMLToc",
  authDomain: "chattybot-xvkr3.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// DOM Elements
const loginView = document.getElementById("login-view");
const appWrapper = document.getElementById("app-wrapper");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const mobileLogoutBtn = document.getElementById("mobile-logout-btn");
const sideUserName = document.getElementById("side-user-name");
const sideUserAvatar = document.getElementById("side-user-avatar");
const messagesContainer = document.getElementById("messages-container");
const sendForm = document.getElementById("send-form");
const messageInput = document.getElementById("message-input");
const attachmentBtn = document.getElementById("attachment-btn");
const imageUpload = document.getElementById("image-upload");

// Navigation Elements
const navBtns = document.querySelectorAll(".nav-btn");
const appSections = document.querySelectorAll(".app-section");
const headerTitle = document.getElementById("header-title");

// Profile Elements
const profileName = document.getElementById("profile-name");
const profileEmail = document.getElementById("profile-email");
const profileAvatar = document.getElementById("profile-avatar");
const profileUid = document.getElementById("profile-uid");

// Mobile Menu Elements
const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const mobileNavOverlay = document.getElementById("mobile-nav-overlay");
const mobileNavMenu = document.getElementById("mobile-nav-menu");
const closeMobileNav = document.getElementById("close-mobile-nav");
const mobileMainNav = document.getElementById("mobile-main-nav");
const desktopMainNav = document.getElementById("main-nav");

let currentUser = null;
let unsubscribeMessages = null;
let currentRoomId = "global";
let currentRoomName = "Global Lounge";

// Clone nav for mobile
if (desktopMainNav && mobileMainNav) {
  mobileMainNav.innerHTML = desktopMainNav.innerHTML;
  // Re-bind buttons after cloning
  document.querySelectorAll("#mobile-main-nav .nav-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      handleNavClick(e);
      closeMobileMenu();
    });
  });
}

function openMobileMenu() {
  mobileNavOverlay.classList.remove("hidden");
  setTimeout(() => mobileNavOverlay.classList.remove("opacity-0"), 10);
  mobileNavMenu.classList.remove("-translate-x-full");
}

function closeMobileMenu() {
  mobileNavOverlay.classList.add("opacity-0");
  mobileNavMenu.classList.add("-translate-x-full");
  setTimeout(() => mobileNavOverlay.classList.add("hidden"), 300);
}

if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openMobileMenu);
if (closeMobileNav) closeMobileNav.addEventListener("click", closeMobileMenu);
if (mobileNavOverlay)
  mobileNavOverlay.addEventListener("click", closeMobileMenu);

function switchView(targetId) {
  // Update Buttons
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    if (btn.dataset.target === targetId) {
      // Don't highlight Global Chat button if we are in a private chat
      if (
        targetId === "chat-section" &&
        currentRoomId !== "global" &&
        btn.textContent.includes("Global")
      ) {
        btn.classList.remove("bg-brand-600", "text-white", "shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]");
        btn.classList.add("hover:bg-white/5", "text-slate-400", "hover:text-white");
      } else {
        btn.classList.add("bg-brand-600", "text-white", "shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]");
        btn.classList.remove("hover:bg-white/5", "text-slate-400", "hover:text-white");
      }
    } else {
      btn.classList.remove("bg-brand-600", "text-white", "shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]");
      btn.classList.add("hover:bg-white/5", "text-slate-400", "hover:text-white");
    }
  });

  // Clear friends active states if we leave the chat section or are in global chat
  if (targetId !== "chat-section" || currentRoomId === "global") {
    document.querySelectorAll(".friend-nav-btn").forEach((btn) => {
      btn.classList.remove("bg-brand-600", "text-white", "shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]");
      btn.classList.add("hover:bg-white/5", "text-slate-400", "hover:text-white");
    });
  }

  // Update Sections
  appSections.forEach((section) => {
    if (section.id === targetId) {
      section.classList.remove("opacity-0", "pointer-events-none");
      section.classList.add("z-10");
    } else {
      section.classList.add("opacity-0", "pointer-events-none");
      section.classList.remove("z-10");
    }
  });

  // Update Header
  const titleMap = {
    "chat-section": currentRoomName,
    "users-section": "Find Friends",
    "profile-section": "My Profile",
    "admin-section": "Administration",
  };
  headerTitle.textContent = titleMap[targetId] || "ChatHub";
  
  const headerSubtitle = document.getElementById("header-subtitle");
  if (targetId === "chat-section" && currentRoomId !== "global") {
     headerSubtitle.classList.remove("hidden");
     headerSubtitle.textContent = "Private Chat";
  } else {
     headerSubtitle.classList.add("hidden");
  }

  if (targetId === "admin-section") loadAdminData();
  if (targetId === "users-section") loadUsers();
}

function handleNavClick(e) {
  const targetId = e.currentTarget.dataset.target;

  if (targetId === "chat-section") {
    // If user clicked Global Chat button manually, reset to global
    currentRoomId = "global";
    currentRoomName = "Global Lounge";
    loadMessages();
  }

  switchView(targetId);
}

navBtns.forEach((btn) => btn.addEventListener("click", handleNavClick));

let heartbeatInterval = null;

// Auth Logic
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loginView.classList.add("hidden");
    appWrapper.classList.remove("hidden");

    const avatarUrl =
      user.photoURL ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
    const displayName = user.displayName || "Anonymous";
    const isAdmin = user.email === "gs931461@gmail.com";

    // Set initial user data
    setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName,
      photoURL: avatarUrl,
      lastSeen: serverTimestamp()
    }, { merge: true }).catch(e => console.error("Could not write user doc", e));

    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      setDoc(doc(db, "users", user.uid), { lastSeen: serverTimestamp() }, { merge: true })
        .catch(error => handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`));
    }, 60000);

    // Set Sidebar
    sideUserName.textContent = displayName;
    sideUserAvatar.src = avatarUrl;
    document.getElementById("side-user-role").textContent = isAdmin
      ? "Super Admin"
      : "User";

    // Set Profile
    profileName.textContent = displayName;
    profileEmail.textContent = user.email || "No email provided";
    profileAvatar.src = avatarUrl;
    profileUid.textContent = user.uid;

    document.getElementById("profile-role-badge").textContent = isAdmin
      ? "Super Admin"
      : "Member";
    document.getElementById("profile-role-badge").className = isAdmin
      ? "px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold uppercase tracking-widest border border-indigo-200"
      : "px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-widest border border-slate-200";
    document.getElementById("profile-access-level").textContent = isAdmin
      ? "Administrator"
      : "Standard User";

    const joinDate = user.metadata?.creationTime ? new Date(user.metadata.creationTime) : new Date();
    document.getElementById("profile-join-date").textContent = joinDate.toLocaleDateString();

    // Query global messages for count (optional, can just show "Active")
    const msgCountEl = document.getElementById("profile-msg-count");
    getDocs(query(collection(db, "messages"), where("senderId", "==", user.uid))).then(snap => {
       msgCountEl.textContent = snap.size;
    }).catch(() => {});

    // Show Admin button only for admin
    document.querySelectorAll('[data-target="admin-section"]').forEach((el) => {
      if (isAdmin) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    });

    switchView("chat-section");
    loadMessages();
    listenForFriends();
  } else {
    currentUser = null;
    loginView.classList.remove("hidden");
    appWrapper.classList.add("hidden");

    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
    stopListeningForFriends();
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }
});

const handleLogin = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Login error:", err);
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "Login failed. Please try again.";
    errorEl.classList.remove("hidden");
  }
};

const handleLogout = () => {
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }
  stopListeningForFriends();
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  signOut(auth);
};

loginBtn.addEventListener("click", handleLogin);
logoutBtn.addEventListener("click", handleLogout);
if (mobileLogoutBtn) mobileLogoutBtn.addEventListener("click", handleLogout);

// Chat Logic
const loadMessages = () => {
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }

  messagesContainer.innerHTML =
    '<div class="flex items-center justify-center h-full"><div class="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>';

  const q = query(
    collection(
      db,
      currentRoomId === "global"
        ? "messages"
        : `rooms/${currentRoomId}/messages`,
    ),
    orderBy("createdAt", "asc"),
    limit(100),
  );

  unsubscribeMessages = onSnapshot(
    q,
    (snapshot) => {
      messagesContainer.innerHTML = "";
      if (snapshot.empty) {
        messagesContainer.innerHTML =
          `<div class="h-full flex flex-col items-center justify-center text-center pb-12">
            <div class="w-32 h-32 mb-6 rounded-full bg-brand-50 flex items-center justify-center">
              <svg class="w-16 h-16 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-slate-800 tracking-tight mb-2">It's quiet in here...</h3>
            <p class="text-slate-500 font-medium max-w-[280px]">There are no messages yet. Break the ice and be the first to say hello!</p>
          </div>`;
        return;
      }

      snapshot.forEach((doc) => {
        const msg = doc.data();
        const isMe = msg.senderId === currentUser.uid;

        const msgEl = document.createElement("div");
        msgEl.className = `flex items-start gap-3 ${isMe ? "flex-row-reverse" : "flex-row"} mb-4`;

        const time = msg.createdAt
          ? msg.createdAt
              .toDate()
              .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "";

        const safeName = escapeHTML(msg.senderName || "");
        const safePhoto = escapeHTML(msg.senderPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`);

        msgEl.innerHTML = `
        <div class="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-inner bg-slate-100">
          <img src="${safePhoto}" alt="" />
        </div>
        <div class="max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}">
          <div class="flex items-center gap-2 mb-1 ${isMe ? "flex-row-reverse" : "flex-row"}">
             <span class="text-[10px] font-extrabold text-slate-800 uppercase tracking-widest">${isMe ? "You" : safeName}</span>
             <span class="text-[9px] font-bold text-slate-400">${time}</span>
             ${isMe ? `<button onclick="window.deleteMessage('${doc.id}')" class="text-slate-300 hover:text-red-500 transition-colors ml-1" title="Delete message"><i data-lucide="trash-2" class="w-3 h-3"></i></button>` : ""}
          </div>
          ${msg.imageUrl ? `
            <div class="rounded-2xl overflow-hidden mb-1 shadow-sm border border-slate-100 max-w-sm">
                <img src="${escapeHTML(msg.imageUrl)}" alt="Attached photo" class="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity" onclick="window.open(this.src)" />
            </div>
          ` : ""}
          ${msg.text ? `
          <div class="px-4 py-2.5 rounded-2xl text-[15px] font-medium leading-[1.5] ${
            isMe
              ? "bg-brand-600 text-white rounded-tr-sm shadow-md shadow-brand-500/30"
              : "bg-white text-slate-700 rounded-tl-sm border border-slate-100 shadow-sm"
          }">${formatMessage(msg.text, isMe)}</div>
          ` : ""}
        </div>
      `;

      messagesContainer.appendChild(msgEl);
    });

    // Re-initialize lucide icons for the newly added HTML
    if (window.lucide) {
      window.lucide.createIcons({
        root: messagesContainer
      });
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },
    (error) => {
      messagesContainer.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-center"><p class="text-red-500">Error loading messages. Please check rules or permission.</p></div>`;
      handleFirestoreError(error, OperationType.LIST, currentRoomId === "global" ? "messages" : `rooms/${currentRoomId}/messages`);
    },
  );
};

sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !currentUser) return;

  messageInput.value = "";
  
  const targetPath = currentRoomId === "global" ? "messages" : `rooms/${currentRoomId}/messages`;

  try {
    await addDoc(
      collection(
        db,
        targetPath
      ),
      {
        text: text,
        imageUrl: null,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || "Anonymous",
        senderPhoto: currentUser.photoURL || "",
        roomId: currentRoomId,
        createdAt: serverTimestamp(),
      },
    );
  } catch (error) {
    alert("Could not send message.");
    handleFirestoreError(error, OperationType.CREATE, targetPath);
  }
});

attachmentBtn.addEventListener("click", () => {
  imageUpload.click();
});

imageUpload.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !currentUser) return;
  e.target.value = ""; // Reset input

  // Resize image using canvas to avoid large base64 strings
  const MAX_WIDTH = 400;
  const MAX_HEIGHT = 400;
  
  const img = new Image();
  const reader = new FileReader();

  reader.onload = (e) => {
    img.src = e.target.result;
  };

  img.onload = async () => {
    let width = img.width;
    let height = img.height;

    if (width > height) {
      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
    } else {
      if (height > MAX_HEIGHT) {
        width *= MAX_HEIGHT / height;
        height = MAX_HEIGHT;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    
    // Compress to 0.7 quality JPEG
    const base64Image = canvas.toDataURL("image/jpeg", 0.7);

    const targetPath = currentRoomId === "global" ? "messages" : `rooms/${currentRoomId}/messages`;

    try {
      await addDoc(
        collection(
          db,
          targetPath
        ),
        {
          text: "", // Optional text, here we send just image
          imageUrl: base64Image,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || "Anonymous",
          senderPhoto: currentUser.photoURL || "",
          roomId: currentRoomId,
          createdAt: serverTimestamp(),
        },
      );
    } catch (error) {
      alert("Could not send image.");
      handleFirestoreError(error, OperationType.CREATE, targetPath);
    }
  };

  reader.readAsDataURL(file);
});

window.deleteMessage = async (msgId) => {
  if (!confirm("Are you sure you want to delete this message?")) return;
  const targetPath = currentRoomId === "global" ? "messages" : `rooms/${currentRoomId}/messages`;
  try {
    await deleteDoc(doc(db, targetPath, msgId));
  } catch (error) {
    alert("Could not delete message.");
    handleFirestoreError(error, OperationType.DELETE, `${targetPath}/${msgId}`);
  }
};

function formatMessage(str, isMe) {
  let text = escapeHTML(str);
  
  // Basic URL regex
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    // Check if it's an image URL
    if (url.match(/\.(jpeg|jpg|gif|png|webp|bmp)(\?.*)?$/i)) {
      return `<img src="${url}" class="max-w-xs md:max-w-sm h-auto rounded-lg mt-2 mb-1 border ${isMe ? 'border-brand-400/30' : 'border-slate-200'} shadow-sm object-contain" loading="lazy" />`;
    }
    // Normal URL
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="underline break-all ${isMe ? 'text-brand-200 hover:text-white' : 'text-brand-600 hover:text-brand-700'}">${url}</a>`;
  });
}

function escapeHTML(str) {
  return str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[tag],
  );
}

// Mock Admin Data loader (If this was real, we'd query Firestore users/analytics)
function loadAdminData() {
  document.getElementById("admin-total-users").textContent = "1,248";
  document.getElementById("admin-total-messages").textContent = "14.2k";

  const userList = document.getElementById("admin-user-list");
  userList.innerHTML = `
    <tr class="hover:bg-slate-50 transition-colors">
       <td class="px-6 py-4">
          <div class="flex items-center gap-3">
             <div class="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs">AD</div>
             <div>
                <p class="text-sm font-bold text-slate-800">Admin User</p>
                <p class="text-xs text-slate-500">admin@chathub.app</p>
             </div>
          </div>
       </td>
       <td class="px-6 py-4">
          <span class="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase tracking-widest border border-indigo-100">Super Admin</span>
       </td>
       <td class="px-6 py-4">
          <p class="text-sm text-slate-600">Jan 1, 2024</p>
       </td>
       <td class="px-6 py-4 text-right">
          <button class="text-slate-400 hover:text-brand-600"><i data-lucide="more-horizontal" class="w-4 h-4"></i></button>
       </td>
    </tr>
    <tr class="hover:bg-slate-50 transition-colors border-t border-slate-50">
       <td class="px-6 py-4">
          <div class="flex items-center gap-3">
             <div class="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=mock" class="rounded-full"/></div>
             <div>
                <p class="text-sm font-bold text-slate-800">Test Account</p>
                <p class="text-xs text-slate-500">test@example.com</p>
             </div>
          </div>
       </td>
       <td class="px-6 py-4">
          <span class="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-widest border border-slate-200">User</span>
       </td>
       <td class="px-6 py-4">
          <p class="text-sm text-slate-600">Apr 29, 2026</p>
       </td>
       <td class="px-6 py-4 text-right">
          <button class="text-slate-400 hover:text-brand-600"><i data-lucide="more-horizontal" class="w-4 h-4"></i></button>
       </td>
    </tr>
  `;

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

window.startPrivateChat = (otherUid, otherName) => {
  const ids = [currentUser.uid, otherUid].sort();
  currentRoomId = ids.join("_");
  currentRoomName = otherName;

  switchView("chat-section");
  loadMessages();
};

window.addFriendAndChat = async (otherUid, otherName, otherPhoto) => {
  try {
    const friendRef = doc(db, "users", currentUser.uid, "friends", otherUid);
    await setDoc(
      friendRef,
      {
        uid: otherUid,
        displayName: otherName,
        photoURL: otherPhoto,
        addedAt: serverTimestamp(),
      },
      { merge: true },
    );

    window.startPrivateChat(otherUid, otherName);
  } catch (error) {
    alert("Could not add friend. Check console.");
    handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}/friends/${otherUid}`);
  }
};

let unsubscribeFriends = null;

function listenForFriends() {
  if (unsubscribeFriends) unsubscribeFriends();

  const q = query(
    collection(db, "users", currentUser.uid, "friends"),
    orderBy("addedAt", "desc"),
  );
  const friendsContainer = document.getElementById("friends-list-sidebar");

  unsubscribeFriends = onSnapshot(
    q,
    (snapshot) => {
      document.getElementById("profile-friends-count").textContent = snapshot.size;
      
      if (snapshot.empty) {
        friendsContainer.innerHTML =
          `<div class="px-3 py-6 flex flex-col items-center text-center">
            <div class="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p class="text-xs text-slate-400 font-medium">No active chats.</p>
            <button onclick="document.querySelector('[data-target=\\'users-section\\']').click()" class="mt-3 text-[10px] uppercase font-bold tracking-widest text-brand-400 hover:text-brand-300 transition-colors py-1.5 px-3 bg-brand-500/10 hover:bg-brand-500/20 rounded-lg">Find Friends</button>
          </div>`;
        return;
      }

      friendsContainer.innerHTML = "";
      snapshot.forEach((docSnap) => {
        const friend = docSnap.data();
        const btn = document.createElement("button");
        btn.className =
          "friend-nav-btn w-full px-4 py-3 rounded-2xl cursor-pointer flex items-center gap-3 hover:bg-white/5 text-slate-400 hover:text-white font-semibold text-sm transition-all";
        btn.onclick = () => {
          // Find existing navs and remove active state
          document
            .querySelectorAll(".nav-btn, .friend-nav-btn")
            .forEach((b) => {
              b.classList.remove("bg-brand-600", "text-white", "shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]");
              b.classList.add("hover:bg-white/5", "text-slate-400", "hover:text-white");
            });
          btn.classList.add("bg-brand-600", "text-white", "shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]");
          btn.classList.remove("hover:bg-white/5", "text-slate-400", "hover:text-white");
          window.startPrivateChat(friend.uid, friend.displayName);
        };

        const safeName = escapeHTML(friend.displayName || "Unknown");
        const safePhoto = escapeHTML(friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`);

        btn.innerHTML = `
        <img src="${safePhoto}" class="w-6 h-6 rounded-md object-cover bg-slate-200" />
        <span class="truncate">${safeName}</span>
      `;
        friendsContainer.appendChild(btn);
      });
    },
    (error) => {
      friendsContainer.innerHTML =
        '<div class="px-3 py-2 text-xs text-red-500 font-medium">Error loading friends</div>';
      handleFirestoreError(error, OperationType.LIST, `users/${currentUser.uid}/friends`);
    },
  );
}

function stopListeningForFriends() {
  if (unsubscribeFriends) {
    unsubscribeFriends();
    unsubscribeFriends = null;
  }
}

async function loadUsers() {
  const container = document.getElementById("users-list-container");
  container.innerHTML =
    '<div class="col-span-full py-12 text-center text-slate-500 text-sm font-medium"><div class="flex justify-center mb-4"><div class="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>Loading users...</div>';

  try {
    const q = query(collection(db, "users"), limit(50));
    const querySnapshot = await getDocs(q);

    container.innerHTML = "";

    if (querySnapshot.empty) {
      container.innerHTML =
        `<div class="col-span-full py-20 flex flex-col items-center justify-center text-center">
          <div class="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <svg class="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-slate-800 tracking-tight mb-2">No users found</h3>
          <p class="text-slate-500 font-medium max-w-sm">It looks like there are no other users on this platform right now.</p>
        </div>`;
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const u = docSnap.data();
      if (u.uid === currentUser.uid) return;

      let isOnline = false;
      if (u.lastSeen) {
        // Online if within last 5 minutes
        const diff = Date.now() - u.lastSeen.toDate().getTime();
        if (diff < 5 * 60000) {
          isOnline = true;
        }
      }

      const card = document.createElement("div");
      card.className =
        "bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between hover:border-brand-300 hover:shadow-lg hover:shadow-brand-500/10 transition-all cursor-pointer group";
      card.onclick = () =>
        window.addFriendAndChat(u.uid, u.displayName, u.photoURL);

      const safeName = escapeHTML(u.displayName || "Unknown");
      const safeEmail = escapeHTML(u.email || "No email");
      const safePhoto = escapeHTML(u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`);

      card.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="relative">
             <img src="${safePhoto}" class="w-10 h-10 rounded-xl bg-slate-100 object-cover" />
             ${isOnline ? '<div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>' : '<div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-slate-300 border-2 border-white rounded-full"></div>'}
          </div>
          <div class="overflow-hidden">
            <h4 class="font-bold text-slate-800 text-sm truncate">${safeName}</h4>
            <p class="text-xs text-slate-500 truncate mt-0.5">${safeEmail}</p>
          </div>
        </div>
        <button class="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-brand-50 text-slate-400 group-hover:text-brand-600 flex items-center justify-center transition-colors shadow-sm cursor-pointer shrink-0">
          <i data-lucide="user-plus" class="w-4 h-4"></i>
        </button>
      `;
      container.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();

    // Add Client-side search listener
    const searchInput = document.getElementById("user-search-input");
    searchInput.oninput = (e) => {
      const val = e.target.value.toLowerCase();
      Array.from(container.children).forEach((child) => {
        if (!child.querySelector) return;
        const name = child.querySelector("h4").textContent.toLowerCase();
        if (name.includes(val)) {
          child.style.display = "flex";
        } else {
          child.style.display = "none";
        }
      });
    };
  } catch (error) {
    container.innerHTML =
      '<div class="col-span-full py-12 text-center text-red-500 text-sm font-medium">Could not load users. Check permissions.</div>';
    handleFirestoreError(error, OperationType.LIST, "users");
  }
}

const profileAvatarContainer = document.getElementById("profile-avatar-container");
const profileUpload = document.getElementById("profile-upload");

if (profileAvatarContainer && profileUpload) {
  profileAvatarContainer.addEventListener("click", () => profileUpload.click());

  profileUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;
    e.target.value = ""; // Reset

    const MAX_WIDTH = 200;
    const MAX_HEIGHT = 200;
    
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = async () => {
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      } else {
        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      
      const base64Image = canvas.toDataURL("image/jpeg", 0.6);
      
      try {
        await setDoc(doc(db, "users", currentUser.uid), { photoURL: base64Image }, { merge: true });
        
        currentUser.photoURL = base64Image; // Manually assign it to keep state in sync
        
        // Update UI
        const profileAvatar = document.getElementById("profile-avatar");
        if (profileAvatar) profileAvatar.src = base64Image;
        const myAvatars = document.querySelectorAll(`img[src="${currentUser.photoURL}"]`);
        myAvatars.forEach(img => img.src = base64Image);
      } catch(err) {
        alert("Failed to update profile picture.");
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
  });
}
