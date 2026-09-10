// ==============================================================================
// UNICORN GOODS - User Application Logic (app.js)
// Instagram-Style Multi-Device Auth | Realtime Banners | Saved Items | Maintenance
// ==============================================================================

import { 
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  db, 
  ref, 
  set,
  get,
  child,
  onValue, 
  push,
  remove as dbRemove
} from "./firebase-config.js";

// --- Application State ---
const AppState = {
  currentUser: null,
  userProfile: null,
  savedItems: new Set(JSON.parse(localStorage.getItem('unicorn_saved_items') || '[]')),
  theme: localStorage.getItem('unicorn_theme') || 'dark',
  allProducts: [],
  filteredProducts: [],
  currentCategory: 'all',
  searchQuery: '',
  notifications: [],
  banners: [],
  allRequests: [],
  allReports: [],
  lastReadNotifTimestamp: parseInt(localStorage.getItem('unicorn_last_read_notif') || '0', 10),
  isInitialLoad: true
};

// --- DOM Cache Resolver ---
function getDOM() {
  return {
    html: document.documentElement,
    splashScreen: document.getElementById('splashScreen'),
    appFavicon: document.getElementById('appFavicon'),
    brandLogoImg: document.getElementById('brandLogoImg'),
    defaultBrandIcon: document.getElementById('defaultBrandIcon'),
    brandTitleText: document.getElementById('brandTitleText'),
    brandTaglineText: document.getElementById('brandTaglineText'),
    
    // User Auth & Profile
    userBadgeBtn: document.getElementById('userBadgeBtn'),
    userGreetingText: document.getElementById('userGreetingText'),
    userAuthModal: document.getElementById('userAuthModal'),
    userAuthFormsWrapper: document.getElementById('userAuthFormsWrapper'),
    userProfileWrapper: document.getElementById('userProfileWrapper'),
    tabUserLoginBtn: document.getElementById('tabUserLoginBtn'),
    tabUserSignupBtn: document.getElementById('tabUserSignupBtn'),
    userLoginForm: document.getElementById('userLoginForm'),
    loginEmailInput: document.getElementById('loginEmailInput'),
    loginPasswordInput: document.getElementById('loginPasswordInput'),
    btnLoginSubmit: document.getElementById('btnLoginSubmit'),
    userSignupForm: document.getElementById('userSignupForm'),
    signupUsernameInput: document.getElementById('signupUsernameInput'),
    signupEmailInput: document.getElementById('signupEmailInput'),
    signupPasswordInput: document.getElementById('signupPasswordInput'),
    btnSignupSubmit: document.getElementById('btnSignupSubmit'),
    userAuthErrorAlert: document.getElementById('userAuthErrorAlert'),
    userAuthErrorMsg: document.getElementById('userAuthErrorMsg'),
    profileUsername: document.getElementById('profileUsername'),
    profileEmail: document.getElementById('profileEmail'),
    profileSavedCount: document.getElementById('profileSavedCount'),
    profileViewSavedBtn: document.getElementById('profileViewSavedBtn'),
    profileRequestBtn: document.getElementById('profileRequestBtn'),
    btnUserLogout: document.getElementById('btnUserLogout'),

    // In-Profile Theme Switcher
    btnThemeDark: document.getElementById('btnThemeDark'),
    btnThemeLight: document.getElementById('btnThemeLight'),

    // Navbar & Top Modal Tabs
    navAboutBtn: document.getElementById('navAboutBtn'),
    footerAboutLink: document.getElementById('footerAboutLink'),
    topTabAccountBtn: document.getElementById('topTabAccountBtn'),
    topTabAboutBtn: document.getElementById('topTabAboutBtn'),
    userAccountSection: document.getElementById('userAccountSection'),
    mainAboutSection: document.getElementById('mainAboutSection'),

    // User Submissions & About Activity Tracker
    tabMyRequestsBtn: document.getElementById('tabMyRequestsBtn'),
    tabMyReportsBtn: document.getElementById('tabMyReportsBtn'),
    userRequestsCountBadge: document.getElementById('userRequestsCountBadge'),
    userReportsCountBadge: document.getElementById('userReportsCountBadge'),
    userRequestsContainer: document.getElementById('userRequestsContainer'),
    userReportsContainer: document.getElementById('userReportsContainer'),
    userRequestsList: document.getElementById('userRequestsList'),
    userReportsList: document.getElementById('userReportsList'),
    profileAboutTitle: document.getElementById('profileAboutTitle'),
    profileAboutTagline: document.getElementById('profileAboutTagline'),
    profileAboutContent: document.getElementById('profileAboutContent'),
    profileAboutVersion: document.getElementById('profileAboutVersion'),
    profileAboutContactBtn: document.getElementById('profileAboutContactBtn'),
    profileAboutContactText: document.getElementById('profileAboutContactText'),

    // Saved Items
    navSavedBtn: document.getElementById('navSavedBtn'),
    navSavedBadge: document.getElementById('navSavedBadge'),
    categorySavedCount: document.getElementById('categorySavedCount'),

    // Maintenance Overlay
    maintenanceOverlay: document.getElementById('maintenanceOverlay'),
    maintenanceTitle: document.getElementById('maintenanceTitle'),
    maintenanceMessage: document.getElementById('maintenanceMessage'),

    // Announcement / Starting Popup
    startPopupModal: document.getElementById('startPopupModal'),
    startPopupImg: document.getElementById('startPopupImg'),
    startPopupTitle: document.getElementById('startPopupTitle'),
    startPopupMessage: document.getElementById('startPopupMessage'),
    startPopupCtaBtn: document.getElementById('startPopupCtaBtn'),
    btnDismissPopup: document.getElementById('btnDismissPopup'),

    // Banners & Hero
    dynamicPromoBannerWrapper: document.getElementById('dynamicPromoBannerWrapper'),
    defaultHeroBanner: document.getElementById('defaultHeroBanner'),

    // Search & Feed
    searchInput: document.getElementById('searchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    categoryNav: document.getElementById('categoryNav'),
    feedSectionTitle: document.getElementById('feedSectionTitle'),
    feedSectionSubtitle: document.getElementById('feedSectionSubtitle'),
    feedCountText: document.getElementById('feedCountText'),
    statTotalItems: document.getElementById('statTotalItems'),

    productsGrid: document.getElementById('productsGrid'),
    emptyState: document.getElementById('emptyState'),
    resetSearchBtn: document.getElementById('resetSearchBtn'),

    // Notifications & Broadcast
    notifBellBtn: document.getElementById('notifBellBtn'),
    notifBadge: document.getElementById('notifBadge'),
    notifDropdown: document.getElementById('notifDropdown'),
    notifList: document.getElementById('notifList'),
    notifClearBtn: document.getElementById('notifClearBtn'),
    broadcastBar: document.getElementById('broadcastBar'),
    broadcastMessage: document.getElementById('broadcastMessage'),
    broadcastCloseBtn: document.getElementById('broadcastCloseBtn'),

    // Request & Report Modals
    fabRequestBtn: document.getElementById('fabRequestBtn'),
    requestModal: document.getElementById('requestModal'),
    requestForm: document.getElementById('requestForm'),
    reqItemName: document.getElementById('reqItemName'),
    reqCategory: document.getElementById('reqCategory'),
    reqDetails: document.getElementById('reqDetails'),
    btnSubmitRequest: document.getElementById('btnSubmitRequest'),

    reportModal: document.getElementById('reportModal'),
    reportForm: document.getElementById('reportForm'),
    reportProductId: document.getElementById('reportProductId'),
    reportProductTitle: document.getElementById('reportProductTitle'),
    reportReason: document.getElementById('reportReason'),
    reportIssue: document.getElementById('reportIssue'),
    btnSubmitReport: document.getElementById('btnSubmitReport'),

    // Product Detail Modal
    productDetailModal: document.getElementById('productDetailModal'),
    detailBadge: document.getElementById('detailBadge'),
    detailTitle: document.getElementById('detailTitle'),
    detailImg: document.getElementById('detailImg'),
    detailDate: document.getElementById('detailDate'),
    detailDesc: document.getElementById('detailDesc'),
    detailDownloadBtn: document.getElementById('detailDownloadBtn'),
    detailSaveBtn: document.getElementById('detailSaveBtn'),
    detailSaveText: document.getElementById('detailSaveText'),
    detailShareBtn: document.getElementById('detailShareBtn'),
    detailReportBtn: document.getElementById('detailReportBtn'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),
    metaDescription: document.getElementById('metaDescription'),
    ogTitle: document.getElementById('ogTitle'),
    ogDescription: document.getElementById('ogDescription'),
    ogImage: document.getElementById('ogImage')
  };
}

let DOM = getDOM();

// ==============================================================================
// 1. INITIALIZATION & THEME
// ==============================================================================

function initApp() {
  DOM = getDOM();
  initSplashScreen();
  initTheme();
  initAuthObserver();
  initRouter();
  initFirebaseListeners();
  initEventListeners();
  updateSavedBadges();
}

function initSplashScreen() {
  if (!DOM.splashScreen) return;
  setTimeout(() => {
    if (DOM.splashScreen) {
      DOM.splashScreen.classList.add('fade-out');
      setTimeout(() => {
        if (DOM.splashScreen) DOM.splashScreen.remove();
      }, 500);
    }
  }, 1600);
}

function initTheme() {
  if (!localStorage.getItem('unicorn_theme')) {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    AppState.theme = prefersDark ? 'dark' : 'light';
  }
  applyTheme(AppState.theme);
}

function applyTheme(theme) {
  AppState.theme = theme;
  if (DOM.html) DOM.html.setAttribute('data-theme', theme);
  localStorage.setItem('unicorn_theme', theme);

  if (DOM.btnThemeDark && DOM.btnThemeLight) {
    if (theme === 'dark') {
      DOM.btnThemeDark.classList.add('active');
      DOM.btnThemeLight.classList.remove('active');
    } else {
      DOM.btnThemeLight.classList.add('active');
      DOM.btnThemeDark.classList.remove('active');
    }
  }

  if (DOM.themeToggleBtn) {
    DOM.themeToggleBtn.innerHTML = theme === 'dark' 
      ? `<svg class="svg-icon icon-md" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
      : `<svg class="svg-icon icon-md" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    DOM.themeToggleBtn.setAttribute('title', `Current: ${theme === 'dark' ? 'Dark' : 'Light'} Mode`);
  }
}

function toggleTheme() {
  const newTheme = AppState.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  showToast(`Switched to ${newTheme.toUpperCase()} mode`, 'info');
}

// ==============================================================================
// 2. INSTAGRAM-STYLE USER AUTHENTICATION & MULTI-DEVICE SYNC
// ==============================================================================

function initAuthObserver() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      AppState.currentUser = user;
      
      // Fetch user profile
      try {
        const userSnapshot = await get(child(ref(db), `users/${user.uid}`));
        if (userSnapshot.exists()) {
          AppState.userProfile = userSnapshot.val();
        } else {
          AppState.userProfile = {
            username: user.email.split('@')[0],
            email: user.email
          };
        }
      } catch (err) {
        AppState.userProfile = { username: user.email.split('@')[0], email: user.email };
      }

      // Sync saved items from database
      syncSavedItemsFromDB(user.uid);

      // Update UI for logged-in user
      const displayName = AppState.userProfile.username ? `@${AppState.userProfile.username}` : user.email.split('@')[0];
      if (DOM.userGreetingText) DOM.userGreetingText.textContent = `Hi, ${displayName}`;
      if (DOM.profileUsername) DOM.profileUsername.textContent = displayName.startsWith('@') ? displayName : `@${displayName}`;
      if (DOM.profileEmail) DOM.profileEmail.textContent = user.email;

      if (DOM.userAuthFormsWrapper) DOM.userAuthFormsWrapper.style.display = 'none';
      if (DOM.userProfileWrapper) DOM.userProfileWrapper.style.display = 'block';

      showToast(`Logged in as ${displayName}`, 'success');
    } else {
      AppState.currentUser = null;
      AppState.userProfile = null;

      if (DOM.userGreetingText) DOM.userGreetingText.textContent = "Log In / Sign Up";
      if (DOM.userAuthFormsWrapper) DOM.userAuthFormsWrapper.style.display = 'block';
      if (DOM.userProfileWrapper) DOM.userProfileWrapper.style.display = 'none';
    }
    updateSavedBadges();
  });
}

function syncSavedItemsFromDB(uid) {
  try {
    const savedRef = ref(db, `users/${uid}/saved`);
    onValue(savedRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        Object.keys(data).forEach(id => AppState.savedItems.add(id));
      }
      localStorage.setItem('unicorn_saved_items', JSON.stringify([...AppState.savedItems]));
      updateSavedBadges();
      if (AppState.currentCategory === 'saved') {
        filterAndRenderProducts();
      }
    });
  } catch (err) {
    console.warn("Saved items sync notice:", err);
  }
}

// User Login Handler
async function handleUserLogin(e) {
  e.preventDefault();
  hideAuthError();

  const loginInput = (DOM.loginEmailInput?.value || '').trim();
  const password = DOM.loginPasswordInput?.value || '';

  if (!loginInput || !password) {
    showAuthError("Please fill in both fields.");
    return;
  }

  // Support username as well as email (if username entered without @, check email format)
  let email = loginInput;
  if (!email.includes('@')) {
    email = `${email.toLowerCase().replace(/[^a-z0-9_]/g, '')}@unicorngoods.local`;
  }

  if (DOM.btnLoginSubmit) {
    DOM.btnLoginSubmit.disabled = true;
    DOM.btnLoginSubmit.innerHTML = `<span>Logging in...</span>`;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    if (DOM.userLoginForm) DOM.userLoginForm.reset();
    if (DOM.userAuthModal) closeModal(DOM.userAuthModal);
  } catch (err) {
    let msg = "Invalid username or password.";
    if (err.code === 'auth/invalid-email' || err.code === 'auth/user-not-found') {
      msg = "Account not found with this username or email.";
    } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      msg = "Incorrect password. Please try again.";
    }
    showAuthError(msg);
    showToast(msg, "error");
  } finally {
    if (DOM.btnLoginSubmit) {
      DOM.btnLoginSubmit.disabled = false;
      DOM.btnLoginSubmit.innerHTML = `<span>Log In to Account</span>`;
    }
  }
}

// User Sign Up Handler (Instagram style)
async function handleUserSignup(e) {
  e.preventDefault();
  hideAuthError();

  const username = (DOM.signupUsernameInput?.value || '').trim().replace(/^@/, '').toLowerCase();
  let email = (DOM.signupEmailInput?.value || '').trim();
  const password = DOM.signupPasswordInput?.value || '';

  if (!username || !password) {
    showAuthError("Username and password are required.");
    return;
  }

  if (password.length < 6) {
    showAuthError("Password must be at least 6 characters.");
    return;
  }

  if (!email) {
    email = `${username}@unicorngoods.local`;
  }

  if (DOM.btnSignupSubmit) {
    DOM.btnSignupSubmit.disabled = true;
    DOM.btnSignupSubmit.innerHTML = `<span>Creating Account...</span>`;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // Save User Profile in Realtime DB
    await set(ref(db, `users/${user.uid}`), {
      uid: user.uid,
      username: username,
      email: email,
      createdAt: Date.now()
    });

    if (DOM.userSignupForm) DOM.userSignupForm.reset();
    if (DOM.userAuthModal) closeModal(DOM.userAuthModal);
    showToast(`Welcome to UNICORN GOODS, @${username}!`, "success");
  } catch (err) {
    let msg = err.message;
    if (err.code === 'auth/email-already-in-use') {
      msg = "This email or username is already taken. Please log in.";
    } else if (err.code === 'auth/weak-password') {
      msg = "Password is too weak. Please use a stronger password.";
    }
    showAuthError(msg);
    showToast(msg, "error");
  } finally {
    if (DOM.btnSignupSubmit) {
      DOM.btnSignupSubmit.disabled = false;
      DOM.btnSignupSubmit.innerHTML = `<span>Create Account</span>`;
    }
  }
}

function showAuthError(msg) {
  if (DOM.userAuthErrorMsg) DOM.userAuthErrorMsg.textContent = msg;
  if (DOM.userAuthErrorAlert) DOM.userAuthErrorAlert.classList.add('visible');
}

function hideAuthError() {
  if (DOM.userAuthErrorAlert) DOM.userAuthErrorAlert.classList.remove('visible');
}

// ==============================================================================
// 3. SAVED / BOOKMARKS SYSTEM
// ==============================================================================

async function toggleSaveProduct(productId) {
  const isSaved = AppState.savedItems.has(productId);

  if (isSaved) {
    AppState.savedItems.delete(productId);
    showToast("Removed from saved items", "info");
    if (AppState.currentUser) {
      try {
        await dbRemove(ref(db, `users/${AppState.currentUser.uid}/saved/${productId}`));
      } catch (err) {
        console.warn("DB unsave error:", err);
      }
    }
  } else {
    AppState.savedItems.add(productId);
    showToast("Item saved to your library", "success");
    if (AppState.currentUser) {
      try {
        await set(ref(db, `users/${AppState.currentUser.uid}/saved/${productId}`), {
          productId: productId,
          savedAt: Date.now()
        });
      } catch (err) {
        console.warn("DB save error:", err);
      }
    }
  }

  localStorage.setItem('unicorn_saved_items', JSON.stringify([...AppState.savedItems]));
  updateSavedBadges();
  filterAndRenderProducts();

  // Update detail modal save button if open
  if (DOM.detailSaveBtn && DOM.detailSaveText) {
    const currentlySaved = AppState.savedItems.has(productId);
    DOM.detailSaveBtn.classList.toggle('saved', currentlySaved);
    DOM.detailSaveText.textContent = currentlySaved ? "Saved" : "Save Item";
  }
}

function updateSavedBadges() {
  const count = AppState.savedItems.size;
  if (DOM.navSavedBadge) {
    DOM.navSavedBadge.textContent = count;
    DOM.navSavedBadge.style.display = count > 0 ? 'flex' : 'none';
  }
  if (DOM.categorySavedCount) {
    DOM.categorySavedCount.textContent = count;
  }
  if (DOM.profileSavedCount) {
    DOM.profileSavedCount.textContent = count;
  }
}

// ==============================================================================
// 4. SPA ROUTING & DYNAMIC SEO
// ==============================================================================

const ROUTES = {
  '/': { title: 'All Goods — UNICORN GOODS', category: 'all', desc: 'Browse verified study notes, PDFs, APKs, and digital software.' },
  '/home': { title: 'All Goods — UNICORN GOODS', category: 'all', desc: 'Browse verified study notes, PDFs, APKs, and digital software.' },
  '/saved': { title: 'Saved Goods — UNICORN GOODS', category: 'saved', desc: 'Your personal bookmarked notes and software library.' },
  '/study-material': { title: 'Study Materials — UNICORN GOODS', category: 'Study Material', desc: 'Download textbooks, lecture slides, and curriculum study materials.' },
  '/notes': { title: 'Notes & PDFs — UNICORN GOODS', category: 'Notes', desc: 'Comprehensive hand-written and revision notes for exams.' },
  '/apks': { title: 'APKs & Mobile Software — UNICORN GOODS', category: 'APK', desc: 'Verified Android APKs and utilities.' },
  '/software': { title: 'Software & Tools — UNICORN GOODS', category: 'Software', desc: 'Premium desktop tools, productivity software, and apps.' },
  '/tools': { title: 'Developer & Student Tools — UNICORN GOODS', category: 'Tools', desc: 'Free utilities, calculators, and digital tools.' }
};

function initRouter() {
  window.addEventListener('popstate', handleRoute);
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function navigateTo(path, addToHistory = true) {
  if (addToHistory) {
    if (window.location.protocol === 'file:') {
      window.location.hash = path.startsWith('#') ? path : '#' + path;
    } else {
      history.pushState(null, null, path);
    }
  }
  handleRoute();
}

function handleRoute() {
  let path = window.location.pathname || '/';
  const hash = window.location.hash;

  if (hash && hash.length > 1) {
    path = hash.replace(/^#/, '');
  }

  // Normalize path (strip trailing slash if not root)
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  if (path === '/index.html' || path === '/index' || !path) {
    path = '/';
  }

  if (path.startsWith('/product/')) {
    const productId = path.replace('/product/', '');
    openProductById(productId);
    return;
  }

  const route = ROUTES[path] || ROUTES['/'];
  AppState.currentCategory = route.category;

  updateSEO(route.title, route.desc);

  document.querySelectorAll('.category-pill').forEach(pill => {
    const cat = pill.getAttribute('data-category');
    if (cat === AppState.currentCategory || (AppState.currentCategory === 'all' && cat === 'all')) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  if (DOM.feedSectionTitle && DOM.feedSectionSubtitle) {
    if (AppState.currentCategory === 'all') {
      DOM.feedSectionTitle.textContent = 'Featured Downloads';
      DOM.feedSectionSubtitle.textContent = 'Explore top materials, notes and software';
    } else if (AppState.currentCategory === 'saved') {
      DOM.feedSectionTitle.textContent = 'Your Saved Goods';
      DOM.feedSectionSubtitle.textContent = 'Items bookmarked on your account across devices';
    } else {
      DOM.feedSectionTitle.textContent = `${AppState.currentCategory} Collection`;
      DOM.feedSectionSubtitle.textContent = `Showing all items in ${AppState.currentCategory}`;
    }
  }

  filterAndRenderProducts();
}

function updateSEO(title, description, image = 'https://i.ibb.co/vzR0hDq/unicorn-banner.png') {
  document.title = title;
  if (DOM.metaDescription) DOM.metaDescription.setAttribute('content', description);
  if (DOM.ogTitle) DOM.ogTitle.setAttribute('content', title);
  if (DOM.ogDescription) DOM.ogDescription.setAttribute('content', description);
  if (DOM.ogImage) DOM.ogImage.setAttribute('content', image);
}

// ==============================================================================
// 5. FIREBASE REALTIME LISTENERS (MAINTENANCE, POPUPS, BANNERS, PRODUCTS)
// ==============================================================================

function initFirebaseListeners() {
  try {
    // 0. Branding & Dynamic Logo Listener
    onValue(ref(db, 'settings/branding'), (snapshot) => {
      const branding = snapshot.val();
      if (branding) {
        if (branding.logoUrl && DOM.brandLogoImg) {
          DOM.brandLogoImg.src = branding.logoUrl;
          DOM.brandLogoImg.style.display = 'block';
          if (DOM.defaultBrandIcon) DOM.defaultBrandIcon.style.display = 'none';
        } else if (DOM.brandLogoImg && DOM.defaultBrandIcon) {
          DOM.brandLogoImg.style.display = 'none';
          DOM.defaultBrandIcon.style.display = 'block';
        }

        if (branding.brandTitle) {
          if (DOM.brandTitleText) DOM.brandTitleText.textContent = branding.brandTitle;
          document.title = `${branding.brandTitle} — Study Materials, Notes & Digital Software`;
        }

        if (branding.brandTagline && DOM.brandTaglineText) {
          DOM.brandTaglineText.textContent = branding.brandTagline;
        }

        if (branding.logoUrl && DOM.appFavicon) {
          DOM.appFavicon.href = branding.logoUrl;
        }
      }
    });

    // 1. Maintenance Mode Listener (Hard lock user panel)
    onValue(ref(db, 'settings/maintenance'), (snapshot) => {
      const val = snapshot.val();
      if (val && val.enabled === true) {
        AppState.isMaintenance = true;
        document.body.style.overflow = 'hidden';
        if (DOM.maintenanceOverlay) {
          DOM.maintenanceOverlay.style.setProperty('display', 'flex', 'important');
          if (DOM.maintenanceTitle) DOM.maintenanceTitle.textContent = val.title || "Under Maintenance";
          if (DOM.maintenanceMessage) DOM.maintenanceMessage.textContent = val.message || "We are currently performing scheduled maintenance. Access and downloads are temporarily locked.";
        }
      } else {
        AppState.isMaintenance = false;
        document.body.style.overflow = '';
        if (DOM.maintenanceOverlay) {
          DOM.maintenanceOverlay.style.setProperty('display', 'none', 'important');
        }
      }
    });

    // 1.5 Realtime About & Community Settings Listener
    onValue(ref(db, 'settings/about'), (snapshot) => {
      const about = snapshot.val();
      if (about) {
        if (DOM.profileAboutTitle) DOM.profileAboutTitle.textContent = about.title || "About UNICORN GOODS";
        if (DOM.profileAboutTagline) DOM.profileAboutTagline.textContent = about.tagline || "Curated Free Digital Library & Study Hub";
        if (DOM.profileAboutContent) DOM.profileAboutContent.textContent = about.content || "Welcome to UNICORN GOODS — a community-driven digital download platform.";
        if (DOM.profileAboutVersion) DOM.profileAboutVersion.textContent = about.version ? `v${about.version.replace(/^v/, '')}` : "v2.4.0";
        if (DOM.profileAboutContactBtn) {
          if (about.contactLink) {
            DOM.profileAboutContactBtn.href = about.contactLink;
            DOM.profileAboutContactBtn.style.display = 'inline-flex';
            if (DOM.profileAboutContactText) DOM.profileAboutContactText.textContent = about.contactText || "Join Community & Support ↗";
          } else {
            DOM.profileAboutContactBtn.style.display = 'none';
          }
        }
      }
    });

    // 2. Starting Popup Listener (Live & Reliable)
    onValue(ref(db, 'settings/popup'), (snapshot) => {
      const popup = snapshot.val();
      if (popup && (popup.enabled === true || popup.enabled === 'true')) {
        const lastSeen = sessionStorage.getItem('unicorn_popup_seen_id');
        const currentId = `${popup.title || ''}_${popup.updatedAt || 0}`;
        if (lastSeen !== currentId) {
          showStartingPopup(popup, currentId);
        }
      } else {
        if (DOM.startPopupModal && DOM.startPopupModal.classList.contains('active')) {
          closeModal(DOM.startPopupModal);
        }
      }
    });

    // 3. Dynamic Banners Listener
    onValue(ref(db, 'banners'), (snapshot) => {
      const data = snapshot.val();
      const list = [];
      if (data) {
        Object.keys(data).forEach(key => {
          list.push({ id: key, ...data[key] });
        });
      }
      AppState.banners = list.filter(b => b.active !== false);
      renderDynamicBanners();
    });

    // 4. Products Listener
    onValue(ref(db, 'products'), (snapshot) => {
      try {
        const data = snapshot.val();
        const list = [];
        if (data) {
          Object.keys(data).forEach(key => {
            list.push({ id: key, ...data[key] });
          });
        }

        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        AppState.allProducts = list.filter(item => item.status === 'published');
        
        if (DOM.statTotalItems) {
          DOM.statTotalItems.textContent = AppState.allProducts.length;
        }

        filterAndRenderProducts();
        updateCategoryCounts();
      } catch (err) {
        console.error("Error processing products:", err);
      }
    });

    // 5. Notifications Listener
    onValue(ref(db, 'notifications'), (snapshot) => {
      try {
        const data = snapshot.val();
        const notifs = [];
        if (data) {
          Object.keys(data).forEach(key => {
            notifs.push({ id: key, ...data[key] });
          });
        }
        notifs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        AppState.notifications = notifs;
        updateNotificationUI();
        if (notifs.length > 0) {
          showBroadcastBanner(notifs[0]);
        }
      } catch (err) {
        console.warn("Notification sync warning:", err);
      }
    });

    // 6. Community Requests Listener
    onValue(ref(db, 'requests'), (snapshot) => {
      try {
        const data = snapshot.val();
        const list = [];
        if (data) {
          Object.keys(data).forEach(key => {
            list.push({ id: key, ...data[key] });
          });
        }
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        AppState.allRequests = list;
        renderUserActivity();
      } catch (err) {
        console.warn("Requests sync notice:", err);
      }
    });

    // 7. Issue Reports Listener
    onValue(ref(db, 'reports'), (snapshot) => {
      try {
        const data = snapshot.val();
        const list = [];
        if (data) {
          Object.keys(data).forEach(key => {
            list.push({ id: key, ...data[key] });
          });
        }
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        AppState.allReports = list;
        renderUserActivity();
      } catch (err) {
        console.warn("Reports sync notice:", err);
      }
    });
  } catch (error) {
    console.error("Firebase sync error:", error);
  }
}

// Starting Popup Render
function showStartingPopup(popup, currentId = '') {
  if (!DOM.startPopupModal) return;

  if (DOM.startPopupTitle) DOM.startPopupTitle.textContent = popup.title || "Announcement";
  if (DOM.startPopupMessage) DOM.startPopupMessage.textContent = popup.message || "";

  if (popup.imgUrl && DOM.startPopupImg) {
    DOM.startPopupImg.src = popup.imgUrl;
    DOM.startPopupImg.style.display = 'block';
  } else if (DOM.startPopupImg) {
    DOM.startPopupImg.style.display = 'none';
  }

  if (popup.link && DOM.startPopupCtaBtn) {
    DOM.startPopupCtaBtn.href = popup.link;
    DOM.startPopupCtaBtn.style.display = 'inline-flex';
    if (popup.linkText) DOM.startPopupCtaBtn.querySelector('span').textContent = popup.linkText;
  } else if (DOM.startPopupCtaBtn) {
    DOM.startPopupCtaBtn.style.display = 'none';
  }

  openModal(DOM.startPopupModal);
  if (currentId) {
    sessionStorage.setItem('unicorn_popup_seen_id', currentId);
  }
}

// Dynamic Banner Render
function renderDynamicBanners() {
  if (!DOM.dynamicPromoBannerWrapper) return;

  if (AppState.banners.length === 0) {
    DOM.dynamicPromoBannerWrapper.innerHTML = '';
    if (DOM.defaultHeroBanner) DOM.defaultHeroBanner.style.display = 'block';
    return;
  }

  if (DOM.defaultHeroBanner) DOM.defaultHeroBanner.style.display = 'none';

  DOM.dynamicPromoBannerWrapper.innerHTML = AppState.banners.map(b => {
    const fallbackImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(b.title || 'Promo')}&background=6366f1&color=fff&size=200&bold=true`;
    const imgSrc = b.imgUrl || fallbackImg;
    const linkUrl = b.link || '#';
    const linkText = b.linkText || 'Check It Out';
    const hasLink = Boolean(b.link && b.link !== '#');

    return `
      <div class="promo-banner-card">
        <img src="${escapeHTML(imgSrc)}" alt="${escapeHTML(b.title || 'Banner')}" class="promo-banner-img" loading="lazy" decoding="async" onerror="this.src='${fallbackImg}'">
        <div style="flex: 1; min-width: 0;">
          <div class="hero-badge" style="margin-bottom: 8px;">
            <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            ${escapeHTML(b.badge || 'PROMO')}
          </div>
          <h2 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 6px;">${escapeHTML(b.title || 'Special Announcement')}</h2>
          <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 14px;">${escapeHTML(b.subtitle || '')}</p>
          ${hasLink ? `
            <a href="${escapeHTML(linkUrl)}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="display: inline-flex; align-items: center; gap: 6px; padding: 9px 20px; font-size: 0.84rem;">
              <span>${escapeHTML(linkText)}</span>
              <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ==============================================================================
// 6. PRODUCT RENDERING & LIVE SEARCH
// ==============================================================================

function filterAndRenderProducts() {
  const query = (AppState.searchQuery || '').toLowerCase().trim();
  const category = AppState.currentCategory;

  AppState.filteredProducts = AppState.allProducts.filter(item => {
    let matchesCategory = true;
    if (category === 'saved') {
      matchesCategory = AppState.savedItems.has(item.id);
    } else if (category !== 'all') {
      matchesCategory = (item.category === category);
    }

    const matchesSearch = !query || 
      (item.title && item.title.toLowerCase().includes(query)) ||
      (item.desc && item.desc.toLowerCase().includes(query)) ||
      (item.category && item.category.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });

  if (DOM.feedCountText) {
    DOM.feedCountText.textContent = `${AppState.filteredProducts.length} item${AppState.filteredProducts.length === 1 ? '' : 's'}`;
  }

  renderProductsGrid(AppState.filteredProducts);
}

function renderProductsGrid(products) {
  if (!DOM.productsGrid) return;

  if (products.length === 0) {
    DOM.productsGrid.style.display = 'none';
    if (DOM.emptyState) DOM.emptyState.style.display = 'block';
    return;
  }

  if (DOM.emptyState) DOM.emptyState.style.display = 'none';
  DOM.productsGrid.style.display = 'grid';

  DOM.productsGrid.innerHTML = products.map(item => {
    const formattedDate = item.timestamp ? formatDate(item.timestamp) : 'Recent';
    const fallbackImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title || 'Item')}&background=6366f1&color=fff&size=128&bold=true`;
    const imgSrc = item.imgUrl || fallbackImg;
    const isSaved = AppState.savedItems.has(item.id);

    return `
      <article class="product-card" data-product-id="${item.id}">
        <div class="card-top">
          <img src="${escapeHTML(imgSrc)}" alt="${escapeHTML(item.title || '')}" class="card-app-icon" loading="lazy" decoding="async" onerror="this.src='${fallbackImg}'">
          <div class="card-info">
            <span class="card-category-badge" data-cat="${escapeHTML(item.category || 'Other')}">${escapeHTML(item.category || 'Item')}</span>
            <h3 class="card-title" title="${escapeHTML(item.title || '')}">${escapeHTML(item.title || 'Untitled')}</h3>
            <p class="card-desc">${escapeHTML(item.desc || 'No description provided.')}</p>
          </div>
        </div>

        <div class="card-meta">
          <div class="card-date">
            <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>${formattedDate}</span>
          </div>

          <div class="card-actions">
            <!-- Bookmark / Save Button -->
            <button class="card-save-btn btn-save-trigger ${isSaved ? 'saved' : ''}" data-id="${item.id}" title="${isSaved ? 'Remove from saved' : 'Save item'}">
              <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>

            <!-- Report Issue Button -->
            <button class="card-report-btn btn-report-trigger" data-id="${item.id}" data-title="${escapeHTML(item.title || '')}" title="Report issue">
              <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            </button>

            <!-- App Store GET NOW Button -->
            <a href="${escapeHTML(item.fileUrl || '#')}" target="_blank" rel="noopener noreferrer" class="btn-get btn-download-trigger" data-id="${item.id}" data-title="${escapeHTML(item.title || '')}">
              <span>GET NOW</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// ==============================================================================
// 7. NOTIFICATION SYSTEM
// ==============================================================================

function updateNotificationUI() {
  if (!DOM.notifBadge || !DOM.notifList) return;

  const unread = AppState.notifications.filter(n => (n.timestamp || 0) > AppState.lastReadNotifTimestamp);
  
  if (unread.length > 0) {
    DOM.notifBadge.textContent = unread.length > 9 ? '9+' : unread.length;
    DOM.notifBadge.style.display = 'flex';
  } else {
    DOM.notifBadge.style.display = 'none';
  }

  if (AppState.notifications.length === 0) {
    DOM.notifList.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        No notifications yet.
      </div>
    `;
    return;
  }

  DOM.notifList.innerHTML = AppState.notifications.map(n => {
    let iconSvg = `<svg class="svg-icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    if (n.type === 'alert') {
      iconSvg = `<svg class="svg-icon icon-sm" style="color: var(--color-danger);" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else if (n.type === 'update') {
      iconSvg = `<svg class="svg-icon icon-sm" style="color: var(--color-success);" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
    }

    return `
      <div class="notif-item">
        <div class="notif-icon">${iconSvg}</div>
        <div class="notif-item-body">
          <div class="notif-item-text">${escapeHTML(n.message || '')}</div>
          <div class="notif-item-time">${formatTimeAgo(n.timestamp)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function showBroadcastBanner(latest) {
  if (!DOM.broadcastBar || !DOM.broadcastMessage) return;
  if (!latest || !latest.message) {
    DOM.broadcastBar.classList.add('hidden');
    return;
  }
  DOM.broadcastMessage.textContent = latest.message;
  DOM.broadcastBar.classList.remove('hidden');
}

function markAllNotificationsRead(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  AppState.lastReadNotifTimestamp = Date.now();
  localStorage.setItem('unicorn_last_read_notif', AppState.lastReadNotifTimestamp.toString());
  if (DOM.notifBadge) DOM.notifBadge.style.display = 'none';
  showToast("All notifications marked as read", "info");
  updateNotificationUI();
}

// Helper for guest device activity identification
function getOrCreateGuestUid() {
  let uid = localStorage.getItem('unicorn_guest_uid');
  if (!uid) {
    uid = 'guest_' + Math.random().toString(36).slice(2, 11);
    localStorage.setItem('unicorn_guest_uid', uid);
  }
  return uid;
}

// ==============================================================================
// 8. COMMUNITY REQUESTS, REPORTS & PROFILE ACTIVITY TRACKER
// ==============================================================================

function renderUserActivity() {
  const currentUid = AppState.currentUser ? AppState.currentUser.uid : null;
  const currentEmail = AppState.currentUser ? (AppState.currentUser.email || '').toLowerCase() : null;
  const guestUid = localStorage.getItem('unicorn_guest_uid');

  // Filter requests for current user
  const userRequests = AppState.allRequests.filter(r => {
    if (currentUid && r.userId === currentUid) return true;
    if (currentEmail && r.userEmail && r.userEmail.toLowerCase() === currentEmail) return true;
    if (guestUid && r.userId === guestUid) return true;
    return false;
  }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Filter reports for current user
  const userReports = AppState.allReports.filter(r => {
    if (currentUid && r.userId === currentUid) return true;
    if (currentEmail && r.userEmail && r.userEmail.toLowerCase() === currentEmail) return true;
    if (guestUid && r.userId === guestUid) return true;
    return false;
  }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (DOM.userRequestsCountBadge) DOM.userRequestsCountBadge.textContent = userRequests.length;
  if (DOM.userReportsCountBadge) DOM.userReportsCountBadge.textContent = userReports.length;

  // Render Requests List in Profile
  if (DOM.userRequestsList) {
    if (userRequests.length === 0) {
      DOM.userRequestsList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 18px; font-size: 0.82rem;">No item requests submitted yet.</div>`;
    } else {
      DOM.userRequestsList.innerHTML = userRequests.map(item => {
        const dateStr = item.timestamp ? formatDate(item.timestamp) : 'Recent';
        const status = (item.status || 'pending').toLowerCase();
        const statusLabel = {
          'pending': 'Pending Review',
          'in_progress': 'In Progress',
          'approved': 'Approved',
          'resolved': 'Resolved',
          'rejected': 'Rejected'
        }[status] || 'Pending';

        return `
          <div class="activity-card">
            <div class="activity-card-top">
              <span class="activity-card-title">${escapeHTML(item.itemName || item.title || 'Requested Material')}</span>
              <span class="status-pill status-pill-${status}">${statusLabel}</span>
            </div>
            <div class="activity-card-meta">
              <span>Category: ${escapeHTML(item.category || 'General')}</span> • <span>${dateStr}</span>
            </div>
            ${item.details ? `<p style="font-size: 0.8rem; color: var(--text-secondary); margin: 3px 0;">${escapeHTML(item.details)}</p>` : ''}
            ${item.adminReply ? `
              <div class="admin-reply-box">
                <div class="admin-reply-header">
                  <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Admin Response:
                </div>
                <div class="admin-reply-text">${escapeHTML(item.adminReply)}</div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  }

  // Render Reports List in Profile
  if (DOM.userReportsList) {
    if (userReports.length === 0) {
      DOM.userReportsList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 18px; font-size: 0.82rem;">No issue reports submitted yet.</div>`;
    } else {
      DOM.userReportsList.innerHTML = userReports.map(item => {
        const dateStr = item.timestamp ? formatDate(item.timestamp) : 'Recent';
        const status = (item.status || 'pending').toLowerCase();
        const statusLabel = {
          'pending': 'Pending Review',
          'in_progress': 'In Review',
          'resolved': 'Resolved / Fixed',
          'rejected': 'Rejected'
        }[status] || 'Pending';

        return `
          <div class="activity-card">
            <div class="activity-card-top">
              <span class="activity-card-title">Issue: ${escapeHTML(item.reason || 'Reported Issue')}</span>
              <span class="status-pill status-pill-${status}">${statusLabel}</span>
            </div>
            <div class="activity-card-meta">
              <span>Item: ${escapeHTML(item.productTitle || 'Product')}</span> • <span>${dateStr}</span>
            </div>
            ${item.issue ? `<p style="font-size: 0.8rem; color: var(--text-secondary); margin: 3px 0;">${escapeHTML(item.issue)}</p>` : ''}
            ${item.adminReply ? `
              <div class="admin-reply-box">
                <div class="admin-reply-header">
                  <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Admin Response:
                </div>
                <div class="admin-reply-text">${escapeHTML(item.adminReply)}</div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  }
}

async function handleRequestSubmit(e) {
  e.preventDefault();
  const itemName = (DOM.reqTitleInput?.value || DOM.reqItemName?.value || '').trim();
  const category = DOM.reqCategorySelect?.value || DOM.reqCategory?.value || 'Other';
  const details = (DOM.reqDescInput?.value || DOM.reqDetails?.value || '').trim();

  if (!itemName) {
    showToast("Please enter an item name.", "error");
    return;
  }

  if (DOM.btnSubmitRequest) {
    DOM.btnSubmitRequest.disabled = true;
    DOM.btnSubmitRequest.textContent = "Submitting...";
  }

  try {
    const author = AppState.userProfile?.username ? `@${AppState.userProfile.username}` : (AppState.currentUser?.email || 'Guest User');
    const requestsRef = ref(db, 'requests');
    const newRequest = {
      userId: AppState.currentUser?.uid || getOrCreateGuestUid(),
      userEmail: AppState.currentUser?.email || '',
      userName: author,
      itemName: itemName,
      category: category,
      details: details || 'No additional details provided.',
      status: 'pending',
      timestamp: Date.now()
    };

    await push(requestsRef, newRequest);
    showToast("Request submitted for admin review.", "success");
    if (DOM.requestForm) DOM.requestForm.reset();
    if (DOM.requestModal) closeModal(DOM.requestModal);
  } catch (error) {
    showToast("Failed to submit request. Please try again.", "error");
  } finally {
    if (DOM.btnSubmitRequest) {
      DOM.btnSubmitRequest.disabled = false;
      DOM.btnSubmitRequest.textContent = "Submit Request";
    }
  }
}

function openReportModal(productId, productTitle) {
  if (DOM.reportProductId) DOM.reportProductId.value = productId;
  if (DOM.reportProductTitle) DOM.reportProductTitle.value = productTitle;
  if (DOM.reportIssue) DOM.reportIssue.value = '';
  AppState.reportingProductId = productId;
  AppState.reportingProductTitle = productTitle;
  if (DOM.reportModal) openModal(DOM.reportModal);
}

async function handleReportSubmit(e) {
  e.preventDefault();
  const productId = DOM.reportProductId?.value || AppState.reportingProductId || 'unknown';
  const productTitle = DOM.reportProductTitle?.value || AppState.reportingProductTitle || 'Untitled';
  const reason = DOM.reportReason?.value || 'Broken Download Link';
  const issue = (DOM.reportIssue?.value || '').trim();

  if (!issue) {
    showToast("Please describe the issue.", "error");
    return;
  }

  if (DOM.btnSubmitReport) {
    DOM.btnSubmitReport.disabled = true;
    DOM.btnSubmitReport.textContent = "Reporting...";
  }

  try {
    const author = AppState.userProfile?.username ? `@${AppState.userProfile.username}` : (AppState.currentUser?.email || 'Guest User');
    const reportsRef = ref(db, 'reports');
    const newReport = {
      userId: AppState.currentUser?.uid || getOrCreateGuestUid(),
      userEmail: AppState.currentUser?.email || '',
      userName: author,
      productId: productId,
      productTitle: productTitle,
      reason: reason,
      issue: issue,
      status: 'pending',
      timestamp: Date.now()
    };

    await push(reportsRef, newReport);
    showToast("Issue report filed. Thank you!", "success");
    if (DOM.reportForm) DOM.reportForm.reset();
    if (DOM.reportModal) closeModal(DOM.reportModal);
  } catch (error) {
    showToast("Failed to send report. Please try again.", "error");
  } finally {
    if (DOM.btnSubmitReport) {
      DOM.btnSubmitReport.disabled = false;
      DOM.btnSubmitReport.textContent = "Send Report";
    }
  }
}

// ==============================================================================
// 9. PRODUCT QUICK-VIEW & DETAIL
// ==============================================================================

function openProductById(productId) {
  const item = AppState.allProducts.find(p => p.id === productId);
  if (!item) return;

  const fallbackImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title || 'Item')}&background=6366f1&color=fff&size=128&bold=true`;
  const isSaved = AppState.savedItems.has(item.id);

  if (DOM.detailBadge) {
    DOM.detailBadge.textContent = item.category || 'Product';
    DOM.detailBadge.setAttribute('data-cat', item.category || 'Other');
  }
  if (DOM.detailTitle) DOM.detailTitle.textContent = item.title;
  if (DOM.detailImg) DOM.detailImg.src = item.imgUrl || fallbackImg;
  if (DOM.detailDate) DOM.detailDate.textContent = `Published: ${formatDate(item.timestamp)}`;
  if (DOM.detailDesc) DOM.detailDesc.textContent = item.desc || 'No detailed description provided.';
  if (DOM.detailDownloadBtn) DOM.detailDownloadBtn.href = item.fileUrl || '#';

  if (DOM.detailSaveBtn && DOM.detailSaveText) {
    DOM.detailSaveBtn.classList.toggle('saved', isSaved);
    DOM.detailSaveText.textContent = isSaved ? "Saved" : "Save Item";
    DOM.detailSaveBtn.onclick = () => toggleSaveProduct(item.id);
  }

  if (DOM.detailShareBtn) {
    DOM.detailShareBtn.onclick = () => copyProductShareLink(item.id);
  }
  if (DOM.detailReportBtn) {
    DOM.detailReportBtn.onclick = () => {
      closeModal(DOM.productDetailModal);
      openReportModal(item.id, item.title);
    };
  }

  updateSEO(
    `${item.title} — Download from UNICORN GOODS`,
    item.desc || `Download ${item.title} for free.`,
    item.imgUrl || fallbackImg
  );

  openModal(DOM.productDetailModal);
}

function copyProductShareLink(id) {
  const link = `${window.location.origin}${window.location.pathname}#/product/${id}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => {
      showToast("Direct share link copied to clipboard.", "success");
    }).catch(() => {
      prompt("Copy product link:", link);
    });
  } else {
    prompt("Copy product link:", link);
  }
}

// ==============================================================================
// 10. EVENT LISTENERS
// ==============================================================================

function initEventListeners() {
  if (DOM.themeToggleBtn) DOM.themeToggleBtn.addEventListener('click', toggleTheme);

  // In-Profile Theme Switcher
  if (DOM.btnThemeDark) {
    DOM.btnThemeDark.addEventListener('click', () => applyTheme('dark'));
  }
  if (DOM.btnThemeLight) {
    DOM.btnThemeLight.addEventListener('click', () => applyTheme('light'));
  }

  // Top Modal Switcher (Account & Activity vs About Platform)
  const openAboutSection = () => {
    if (DOM.topTabAboutBtn && DOM.topTabAccountBtn) {
      DOM.topTabAboutBtn.classList.add('active');
      DOM.topTabAccountBtn.classList.remove('active');
    }
    if (DOM.mainAboutSection) DOM.mainAboutSection.style.display = 'block';
    if (DOM.userAccountSection) DOM.userAccountSection.style.display = 'none';
    openModal(DOM.userAuthModal);
  };

  const openAccountSection = () => {
    if (DOM.topTabAccountBtn && DOM.topTabAboutBtn) {
      DOM.topTabAccountBtn.classList.add('active');
      DOM.topTabAboutBtn.classList.remove('active');
    }
    if (DOM.userAccountSection) DOM.userAccountSection.style.display = 'block';
    if (DOM.mainAboutSection) DOM.mainAboutSection.style.display = 'none';
    hideAuthError();
    renderUserActivity();
    openModal(DOM.userAuthModal);
  };

  if (DOM.topTabAccountBtn) DOM.topTabAccountBtn.addEventListener('click', openAccountSection);
  if (DOM.topTabAboutBtn) DOM.topTabAboutBtn.addEventListener('click', openAboutSection);
  if (DOM.navAboutBtn) DOM.navAboutBtn.addEventListener('click', openAboutSection);
  if (DOM.footerAboutLink) DOM.footerAboutLink.addEventListener('click', openAboutSection);
  if (DOM.userBadgeBtn) DOM.userBadgeBtn.addEventListener('click', openAccountSection);

  // Submissions Activity Tabs (My Requests vs My Reports)
  if (DOM.tabMyRequestsBtn) {
    DOM.tabMyRequestsBtn.addEventListener('click', () => {
      DOM.tabMyRequestsBtn.classList.add('active');
      if (DOM.tabMyReportsBtn) DOM.tabMyReportsBtn.classList.remove('active');
      if (DOM.userRequestsContainer) DOM.userRequestsContainer.style.display = 'block';
      if (DOM.userReportsContainer) DOM.userReportsContainer.style.display = 'none';
    });
  }

  if (DOM.tabMyReportsBtn) {
    DOM.tabMyReportsBtn.addEventListener('click', () => {
      DOM.tabMyReportsBtn.classList.add('active');
      if (DOM.tabMyRequestsBtn) DOM.tabMyRequestsBtn.classList.remove('active');
      if (DOM.userReportsContainer) DOM.userReportsContainer.style.display = 'block';
      if (DOM.userRequestsContainer) DOM.userRequestsContainer.style.display = 'none';
    });
  }

  // Global Ctrl+K / Cmd+K Search Focus
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (DOM.searchInput) {
        DOM.searchInput.focus();
        DOM.searchInput.select();
      }
    }
  });

  // Auth Tabs (Login / Sign Up)
  if (DOM.tabUserLoginBtn && DOM.tabUserSignupBtn) {
    DOM.tabUserLoginBtn.addEventListener('click', () => {
      DOM.tabUserLoginBtn.classList.add('active');
      DOM.tabUserSignupBtn.classList.remove('active');
      if (DOM.userLoginForm) DOM.userLoginForm.style.display = 'block';
      if (DOM.userSignupForm) DOM.userSignupForm.style.display = 'none';
      hideAuthError();
    });

    DOM.tabUserSignupBtn.addEventListener('click', () => {
      DOM.tabUserSignupBtn.classList.add('active');
      DOM.tabUserLoginBtn.classList.remove('active');
      if (DOM.userSignupForm) DOM.userSignupForm.style.display = 'block';
      if (DOM.userLoginForm) DOM.userLoginForm.style.display = 'none';
      hideAuthError();
    });
  }

  if (DOM.userLoginForm) DOM.userLoginForm.addEventListener('submit', handleUserLogin);
  if (DOM.userSignupForm) DOM.userSignupForm.addEventListener('submit', handleUserSignup);

  if (DOM.btnUserLogout) {
    DOM.btnUserLogout.addEventListener('click', async () => {
      await signOut(auth);
      closeModal(DOM.userAuthModal);
      showToast("Signed out of your account", "info");
    });
  }

  // Saved Goods Quick Button
  if (DOM.navSavedBtn) {
    DOM.navSavedBtn.addEventListener('click', () => {
      navigateTo('/saved');
    });
  }

  if (DOM.profileViewSavedBtn) {
    DOM.profileViewSavedBtn.addEventListener('click', () => {
      closeModal(DOM.userAuthModal);
      navigateTo('/saved');
    });
  }

  if (DOM.profileRequestBtn) {
    DOM.profileRequestBtn.addEventListener('click', () => {
      closeModal(DOM.userAuthModal);
      openModal(DOM.requestModal);
    });
  }

  // Lag-Free Debounced Live Search
  let userSearchDebounceTimer;
  if (DOM.searchInput) {
    DOM.searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (DOM.searchClearBtn) {
        if (val) DOM.searchClearBtn.classList.add('visible');
        else DOM.searchClearBtn.classList.remove('visible');
      }
      clearTimeout(userSearchDebounceTimer);
      userSearchDebounceTimer = setTimeout(() => {
        AppState.searchQuery = val;
        filterAndRenderProducts();
      }, 150);
    });
  }

  if (DOM.searchClearBtn) {
    DOM.searchClearBtn.addEventListener('click', () => {
      if (DOM.searchInput) {
        DOM.searchInput.value = '';
        DOM.searchInput.focus();
      }
      AppState.searchQuery = '';
      DOM.searchClearBtn.classList.remove('visible');
      filterAndRenderProducts();
    });
  }

  if (DOM.resetSearchBtn) {
    DOM.resetSearchBtn.addEventListener('click', () => {
      if (DOM.searchInput) DOM.searchInput.value = '';
      AppState.searchQuery = '';
      if (DOM.searchClearBtn) DOM.searchClearBtn.classList.remove('visible');
      navigateTo('/');
    });
  }

  // Category Navigation
  if (DOM.categoryNav) {
    DOM.categoryNav.addEventListener('click', (e) => {
      const pill = e.target.closest('.category-pill');
      if (!pill) return;
      const cat = pill.getAttribute('data-category');
      
      const routeMap = {
        'all': '/',
        'saved': '/saved',
        'Study Material': '/study-material',
        'Notes': '/notes',
        'APK': '/apks',
        'Software': '/software',
        'Tools': '/tools'
      };

      navigateTo(routeMap[cat] || '/');
    });
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-link]');
    if (link) {
      e.preventDefault();
      const href = link.getAttribute('href');
      navigateTo(href);
    }
  });

  // Product Grid Clicks (Save / Report / Download / Quick-View)
  if (DOM.productsGrid) {
    DOM.productsGrid.addEventListener('click', (e) => {
      if (AppState.isMaintenance) {
        showToast("Platform is currently in Maintenance Mode. Downloads are temporarily paused.", "warning");
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const saveBtn = e.target.closest('.btn-save-trigger');
      if (saveBtn) {
        e.stopPropagation();
        e.preventDefault();
        toggleSaveProduct(saveBtn.dataset.id);
        return;
      }

      const reportBtn = e.target.closest('.btn-report-trigger');
      if (reportBtn) {
        e.stopPropagation();
        e.preventDefault();
        openReportModal(reportBtn.dataset.id, reportBtn.dataset.title);
        return;
      }

      const getBtn = e.target.closest('.btn-download-trigger');
      if (getBtn) {
        e.stopPropagation();
        showToast(`GET NOW: Starting direct download for ${getBtn.dataset.title || 'item'}`, 'success');
        return;
      }

      const card = e.target.closest('.product-card');
      if (card) {
        openProductById(card.dataset.productId);
      }
    });
  }

  // Notification Bell
  if (DOM.notifBellBtn) {
    DOM.notifBellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (DOM.notifDropdown) DOM.notifDropdown.classList.toggle('active');
    });
  }

  if (DOM.notifDropdown) {
    DOM.notifDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  document.addEventListener('click', (e) => {
    if (DOM.notifDropdown && DOM.notifBellBtn) {
      if (!DOM.notifDropdown.contains(e.target) && !DOM.notifBellBtn.contains(e.target)) {
        DOM.notifDropdown.classList.remove('active');
      }
    }
  });

  if (DOM.notifClearBtn) DOM.notifClearBtn.addEventListener('click', markAllNotificationsRead);

  if (DOM.broadcastCloseBtn) {
    DOM.broadcastCloseBtn.addEventListener('click', () => {
      if (DOM.broadcastBar) DOM.broadcastBar.classList.add('hidden');
    });
  }

  if (DOM.fabRequestBtn) {
    DOM.fabRequestBtn.addEventListener('click', () => openModal(DOM.requestModal));
  }

  if (DOM.requestForm) DOM.requestForm.addEventListener('submit', handleRequestSubmit);
  if (DOM.reportForm) DOM.reportForm.addEventListener('submit', handleReportSubmit);

  // Modal Closures
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close-modal');
      const target = document.getElementById(modalId);
      if (target) closeModal(target);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
      if (DOM.notifDropdown) DOM.notifDropdown.classList.remove('active');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (DOM.searchInput) DOM.searchInput.focus();
    }
  });
}

// ==============================================================================
// 11. UI HELPERS
// ==============================================================================

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('active');
  document.body.style.overflow = '';
}

function showToast(message, type = 'info', duration = 3500) {
  if (!DOM.toastContainer) DOM.toastContainer = document.getElementById('toastContainer');
  if (!DOM.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = `<svg class="svg-icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  if (type === 'success') {
    iconSvg = `<svg class="svg-icon icon-sm" style="color: var(--color-success);" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg class="svg-icon icon-sm" style="color: var(--color-danger);" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  }

  toast.innerHTML = `<span>${iconSvg}</span> <span>${escapeHTML(message)}</span>`;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function formatDate(timestamp) {
  if (!timestamp) return 'Recent';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Boot User Application
initApp();
