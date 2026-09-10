// ==============================================================================
// UNICORN GOODS - Admin Dashboard Logic (admin.js)
// Firebase Auth Guard | Banners | Popups | Maintenance Mode | Pure Vector UI
// ==============================================================================

import { 
  auth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  db, 
  ref, 
  set,
  get,
  onValue, 
  push, 
  update, 
  remove 
} from "./firebase-config.js";

// ==============================================================================
// 🔑 IMGBB API CONFIGURATION
// ==============================================================================
const IMGBB_API_KEY = "f0449c4b717c2d5064ab074f1cd4897e";
const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";

// --- Admin State ---
const AdminState = {
  user: null,
  theme: localStorage.getItem('unicorn_theme') || 'dark',
  products: [],
  banners: [],
  requests: [],
  reports: [],
  notifications: [],
  popupSettings: { enabled: false, title: '', message: '', imgUrl: '', linkText: '', link: '' },
  maintenanceSettings: { enabled: false, title: '', message: '' },
  brandingSettings: { logoUrl: '', brandTitle: 'UNICORN GOODS', brandTagline: 'Digital Store' },
  currentTab: 'overviewTab',
  productSearchQuery: '',
  itemPendingDelete: null
};

// --- DOM Cache Resolver ---
function getDOM() {
  return {
    html: document.documentElement,
    adminThemeToggleBtn: document.getElementById('adminThemeToggleBtn'),

    // Auth Overlay & Master Pass
    adminAuthOverlay: document.getElementById('adminAuthOverlay'),
    adminDashboardLayout: document.getElementById('adminDashboardLayout'),
    tabMasterPassBtn: document.getElementById('tabMasterPassBtn'),
    tabAdminEmailBtn: document.getElementById('tabAdminEmailBtn'),
    adminMasterPassForm: document.getElementById('adminMasterPassForm'),
    adminMasterPassInput: document.getElementById('adminMasterPassInput'),
    btnMasterPassLogin: document.getElementById('btnMasterPassLogin'),
    adminLoginForm: document.getElementById('adminLoginForm'),
    adminEmailInput: document.getElementById('adminEmailInput'),
    adminPasswordInput: document.getElementById('adminPasswordInput'),
    btnAdminLogin: document.getElementById('btnAdminLogin'),
    authErrorAlert: document.getElementById('authErrorAlert'),
    authErrorMsg: document.getElementById('authErrorMsg'),
    adminUserEmail: document.getElementById('adminUserEmail'),
    btnLogout: document.getElementById('btnLogout'),
    btnTopLogout: document.getElementById('btnTopLogout'),

    // Navigation & Header
    adminSidebar: document.getElementById('adminSidebar'),
    sidebarNav: document.getElementById('adminSidebarNav'),
    btnMobileMenuToggle: document.getElementById('btnMobileMenuToggle'),
    btnCloseMobileSidebar: document.getElementById('btnCloseMobileSidebar'),
    adminSidebarOverlay: document.getElementById('adminSidebarOverlay'),
    adminHeaderTitle: document.getElementById('adminHeaderTitle'),
    tabPanes: document.querySelectorAll('.admin-tab-pane'),

    // Metrics
    statTotalProducts: document.getElementById('statTotalProducts'),
    statPublishedCount: document.getElementById('statPublishedCount'),
    statPendingRequests: document.getElementById('statPendingRequests'),
    statPendingReports: document.getElementById('statPendingReports'),
    badgeProductCount: document.getElementById('badgeProductCount'),
    badgeBannerCount: document.getElementById('badgeBannerCount'),
    badgeRequestCount: document.getElementById('badgeRequestCount'),
    badgeReportCount: document.getElementById('badgeReportCount'),
    requestsCountBadge: document.getElementById('requestsCountBadge'),
    reportsCountBadge: document.getElementById('reportsCountBadge'),

    // Tables
    overviewProductsTbody: document.getElementById('overviewProductsTbody'),
    productsTableBody: document.getElementById('productsTableBody'),
    bannersTableBody: document.getElementById('bannersTableBody'),
    requestsTableBody: document.getElementById('requestsTableBody'),
    reportsTableBody: document.getElementById('reportsTableBody'),
    broadcastTableBody: document.getElementById('broadcastTableBody'),
    adminProductSearch: document.getElementById('adminProductSearch'),

    // Product Modal & Form
    productModal: document.getElementById('productModal'),
    productModalTitle: document.getElementById('productModalTitle'),
    productForm: document.getElementById('productForm'),
    editProductId: document.getElementById('editProductId'),
    prodTitle: document.getElementById('prodTitle'),
    prodCategory: document.getElementById('prodCategory'),
    prodStatus: document.getElementById('prodStatus'),
    prodFileUrl: document.getElementById('prodFileUrl'),
    prodImgUrl: document.getElementById('prodImgUrl'),
    prodDesc: document.getElementById('prodDesc'),
    btnSaveProduct: document.getElementById('btnSaveProduct'),
    openAddProductModalBtn: document.getElementById('openAddProductModalBtn'),
    quickAddProductBtn: document.getElementById('quickAddProductBtn'),

    // Banner Modal & Form
    bannerModal: document.getElementById('bannerModal'),
    bannerModalTitle: document.getElementById('bannerModalTitle'),
    bannerForm: document.getElementById('bannerForm'),
    editBannerId: document.getElementById('editBannerId'),
    bannerBadge: document.getElementById('bannerBadge'),
    bannerTitle: document.getElementById('bannerTitle'),
    bannerSubtitle: document.getElementById('bannerSubtitle'),
    bannerImgUrl: document.getElementById('bannerImgUrl'),
    bannerLinkText: document.getElementById('bannerLinkText'),
    bannerLink: document.getElementById('bannerLink'),
    btnSaveBanner: document.getElementById('btnSaveBanner'),
    openAddBannerModalBtn: document.getElementById('openAddBannerModalBtn'),
    quickAddBannerBtn: document.getElementById('quickAddBannerBtn'),

    // Admin Reply & Review Modal
    adminReplyModal: document.getElementById('adminReplyModal'),
    adminReplyForm: document.getElementById('adminReplyForm'),
    replyTargetType: document.getElementById('replyTargetType'),
    replyTargetId: document.getElementById('replyTargetId'),
    replyTargetUser: document.getElementById('replyTargetUser'),
    replyTargetTitle: document.getElementById('replyTargetTitle'),
    replyTargetDetails: document.getElementById('replyTargetDetails'),
    replyStatusSelect: document.getElementById('replyStatusSelect'),
    adminReplyMessageInput: document.getElementById('adminReplyMessageInput'),
    btnSaveAdminReply: document.getElementById('btnSaveAdminReply'),

    // Branding & Logo Form
    brandingSettingsForm: document.getElementById('brandingSettingsForm'),
    logoUploadZone: document.getElementById('logoUploadZone'),
    logoFileInput: document.getElementById('logoFileInput'),
    logoProgressBar: document.getElementById('logoProgressBar'),
    logoProgressFill: document.getElementById('logoProgressFill'),
    logoPreviewWrapper: document.getElementById('logoPreviewWrapper'),
    brandLogoPreviewThumb: document.getElementById('brandLogoPreviewThumb'),
    brandLogoUrlInput: document.getElementById('brandLogoUrlInput'),
    btnRemoveBrandLogo: document.getElementById('btnRemoveBrandLogo'),
    brandTitleInput: document.getElementById('brandTitleInput'),
    brandTaglineInput: document.getElementById('brandTaglineInput'),
    btnSaveBranding: document.getElementById('btnSaveBranding'),
    previewBrandIconBox: document.getElementById('previewBrandIconBox'),
    previewLogoImg: document.getElementById('previewLogoImg'),
    previewDefaultIcon: document.getElementById('previewDefaultIcon'),
    previewBrandTitle: document.getElementById('previewBrandTitle'),
    previewBrandTagline: document.getElementById('previewBrandTagline'),

    // About Section Form
    aboutSettingsForm: document.getElementById('aboutSettingsForm'),
    aboutTitleInput: document.getElementById('aboutTitleInput'),
    aboutTaglineInput: document.getElementById('aboutTaglineInput'),
    aboutContentInput: document.getElementById('aboutContentInput'),
    aboutVersionInput: document.getElementById('aboutVersionInput'),
    aboutContactTextInput: document.getElementById('aboutContactTextInput'),
    aboutContactLinkInput: document.getElementById('aboutContactLinkInput'),
    btnSaveAbout: document.getElementById('btnSaveAbout'),

    // Popup Settings Form
    popupSettingsForm: document.getElementById('popupSettingsForm'),
    togglePopupActive: document.getElementById('togglePopupActive'),
    popupTitleInput: document.getElementById('popupTitleInput'),
    popupMsgInput: document.getElementById('popupMsgInput'),
    popupImgInput: document.getElementById('popupImgInput'),
    popupLinkTextInput: document.getElementById('popupLinkTextInput'),
    popupLinkUrlInput: document.getElementById('popupLinkUrlInput'),
    btnSavePopupSettings: document.getElementById('btnSavePopupSettings'),
    quickPopupBtn: document.getElementById('quickPopupBtn'),

    // Maintenance Settings Form
    maintenanceForm: document.getElementById('maintenanceForm'),
    toggleMaintenanceActive: document.getElementById('toggleMaintenanceActive'),
    maintTitleInput: document.getElementById('maintTitleInput'),
    maintMessageInput: document.getElementById('maintMessageInput'),
    btnSaveMaintenance: document.getElementById('btnSaveMaintenance'),

    // ImgBB Upload Elements (Products)
    imgUploadZone: document.getElementById('imgUploadZone'),
    imgFileInput: document.getElementById('imgFileInput'),
    uploadProgressBar: document.getElementById('uploadProgressBar'),
    uploadProgressFill: document.getElementById('uploadProgressFill'),
    uploadPreviewWrapper: document.getElementById('uploadPreviewWrapper'),
    imgPreviewThumb: document.getElementById('imgPreviewThumb'),
    imgUploadStatusText: document.getElementById('imgUploadStatusText'),
    removeImgBtn: document.getElementById('removeImgBtn'),
    manualImgUrlToggle: document.getElementById('manualImgUrlToggle'),

    // ImgBB Upload Elements (Banners)
    bannerImgUploadZone: document.getElementById('bannerImgUploadZone'),
    bannerFileInput: document.getElementById('bannerFileInput'),
    bannerProgressBar: document.getElementById('bannerProgressBar'),
    bannerProgressFill: document.getElementById('bannerProgressFill'),
    bannerPreviewWrapper: document.getElementById('bannerPreviewWrapper'),
    bannerPreviewThumb: document.getElementById('bannerPreviewThumb'),
    btnRemoveBannerImg: document.getElementById('btnRemoveBannerImg'),

    // ImgBB Upload Elements (Popup)
    popupImgUploadZone: document.getElementById('popupImgUploadZone'),
    popupFileInput: document.getElementById('popupFileInput'),
    popupProgressBar: document.getElementById('popupProgressBar'),
    popupProgressFill: document.getElementById('popupProgressFill'),
    popupPreviewWrapper: document.getElementById('popupPreviewWrapper'),
    popupPreviewThumb: document.getElementById('popupPreviewThumb'),
    btnRemovePopupImg: document.getElementById('btnRemovePopupImg'),

    // Broadcast
    broadcastForm: document.getElementById('broadcastForm'),
    broadcastMsgInput: document.getElementById('broadcastMsgInput'),
    broadcastTypeInput: document.getElementById('broadcastTypeInput'),
    btnSendBroadcast: document.getElementById('btnSendBroadcast'),

    // Delete Modal
    deleteConfirmModal: document.getElementById('deleteConfirmModal'),
    deleteConfirmText: document.getElementById('deleteConfirmText'),
    btnConfirmDelete: document.getElementById('btnConfirmDelete'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
  };
}

let DOM = getDOM();

// ==============================================================================
// 1. INITIALIZATION & FIREBASE AUTH GUARD
// ==============================================================================

function initAdmin() {
  DOM = getDOM();
  initTheme();
  initAuthGuard();
  initTabNavigation();
  initAllImageUploaders();
  initEventListeners();
}

function initTheme() {
  applyTheme(AdminState.theme);
}

function applyTheme(theme) {
  AdminState.theme = theme;
  if (DOM.html) DOM.html.setAttribute('data-theme', theme);
  localStorage.setItem('unicorn_theme', theme);
  if (DOM.adminThemeToggleBtn) {
    DOM.adminThemeToggleBtn.innerHTML = theme === 'dark'
      ? `<svg class="svg-icon icon-md" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
      : `<svg class="svg-icon icon-md" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  }
}

function toggleTheme() {
  const newTheme = AdminState.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  showToast(`Switched to ${newTheme.toUpperCase()} mode`, 'info');
}

function showDashboard(user) {
  if (DOM.adminAuthOverlay) {
    DOM.adminAuthOverlay.classList.add('hidden');
    DOM.adminAuthOverlay.style.setProperty('display', 'none', 'important');
  }
  if (DOM.adminDashboardLayout) {
    DOM.adminDashboardLayout.classList.remove('hidden');
    DOM.adminDashboardLayout.style.setProperty('display', 'flex', 'important');
  }
  if (DOM.adminUserEmail) {
    DOM.adminUserEmail.textContent = user.email || 'Admin';
  }
}

function hideDashboard() {
  if (DOM.adminDashboardLayout) {
    DOM.adminDashboardLayout.classList.add('hidden');
    DOM.adminDashboardLayout.style.setProperty('display', 'none', 'important');
  }
  if (DOM.adminAuthOverlay) {
    DOM.adminAuthOverlay.classList.remove('hidden');
    DOM.adminAuthOverlay.style.setProperty('display', 'flex', 'important');
  }
}

function initAuthGuard() {
  hideDashboard();

  // Check if active Master Session exists
  if (sessionStorage.getItem('unicorn_master_auth') === 'true') {
    AdminState.user = { email: 'Master Admin (BABAUNICORN16)', uid: 'master-admin' };
    showDashboard(AdminState.user);
    initFirebaseDataSync();
  }

  onAuthStateChanged(auth, async (user) => {
    if (sessionStorage.getItem('unicorn_master_auth') === 'true') {
      return;
    }

    if (user) {
      try {
        // Strict Admin Verification: Check if UID exists in /admins/{uid} in Realtime Database
        const adminSnap = await get(ref(db, `admins/${user.uid}`));
        const isAdmin = adminSnap.exists() && (adminSnap.val().role === 'admin' || adminSnap.val().email === user.email);

        if (isAdmin) {
          AdminState.user = user;
          showDashboard(user);
          showToast(`Admin Authenticated: ${user.email}`, 'success');
          initFirebaseDataSync();
        } else {
          // Regular storefront customer attempting to access admin panel - BLOCK & SIGN OUT
          console.warn("Unauthorized admin access attempt by non-admin:", user.email);
          await signOut(auth);
          AdminState.user = null;
          hideDashboard();
          showAuthError("Access Denied: This account is not an authorized administrator. Use the Master Pass or register via UNIADMSCREATE.");
          clearFirebaseData();
        }
      } catch (err) {
        console.error("Admin verification error:", err);
        await signOut(auth);
        AdminState.user = null;
        hideDashboard();
        showAuthError("Security verification failed. Please log in with admin credentials.");
      }
    } else if (sessionStorage.getItem('unicorn_master_auth') !== 'true') {
      AdminState.user = null;
      hideDashboard();
      clearFirebaseData();
    }
  });

  // Auth Mode Tabs Switch
  if (DOM.tabMasterPassBtn && DOM.tabAdminEmailBtn) {
    DOM.tabMasterPassBtn.addEventListener('click', () => {
      DOM.tabMasterPassBtn.classList.add('active');
      DOM.tabAdminEmailBtn.classList.remove('active');
      if (DOM.adminMasterPassForm) DOM.adminMasterPassForm.style.display = 'block';
      if (DOM.adminLoginForm) DOM.adminLoginForm.style.display = 'none';
      hideAuthError();
    });

    DOM.tabAdminEmailBtn.addEventListener('click', () => {
      DOM.tabAdminEmailBtn.classList.add('active');
      DOM.tabMasterPassBtn.classList.remove('active');
      if (DOM.adminLoginForm) DOM.adminLoginForm.style.display = 'block';
      if (DOM.adminMasterPassForm) DOM.adminMasterPassForm.style.display = 'none';
      hideAuthError();
    });
  }

  // Master Passkey Submit (BABAUNICORN16)
  if (DOM.adminMasterPassForm) {
    DOM.adminMasterPassForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pass = (DOM.adminMasterPassInput?.value || '').trim();
      hideAuthError();

      if (pass === 'BABAUNICORN16') {
        sessionStorage.setItem('unicorn_master_auth', 'true');
        AdminState.user = { email: 'Master Admin (BABAUNICORN16)', uid: 'master-admin' };
        showDashboard(AdminState.user);
        showToast("Master Access Granted! Welcome to UNICORN Console.", "success");
        initFirebaseDataSync();
        DOM.adminMasterPassForm.reset();
      } else {
        showAuthError("Invalid Master Security Passkey. Access Denied.");
        showToast("Invalid Master Key", "error");
      }
    });
  }

  // Email / Password Form Submit
  if (DOM.adminLoginForm) {
    DOM.adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (DOM.adminEmailInput?.value || '').trim();
      const password = DOM.adminPasswordInput?.value || '';

      if (!email || !password) {
        showAuthError("Please enter both email and password.");
        return;
      }

      // Quick Master Key Bypass if password matches BABAUNICORN16
      if (password === 'BABAUNICORN16') {
        sessionStorage.setItem('unicorn_master_auth', 'true');
        AdminState.user = { email: email || 'Master Admin', uid: 'master-admin' };
        showDashboard(AdminState.user);
        showToast("Master Access Granted!", "success");
        initFirebaseDataSync();
        DOM.adminLoginForm.reset();
        return;
      }

      if (DOM.btnAdminLogin) {
        DOM.btnAdminLogin.disabled = true;
        DOM.btnAdminLogin.innerHTML = `<span>Verifying Admin Credentials...</span>`;
      }
      hideAuthError();

      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Verify if user is registered in /admins/{uid}
        const adminSnap = await get(ref(db, `admins/${user.uid}`));
        const isAdmin = adminSnap.exists() && (adminSnap.val().role === 'admin' || adminSnap.val().email === user.email);

        if (!isAdmin) {
          await signOut(auth);
          showAuthError("Access Denied: This account does not have Admin access. Register via UNIADMSCREATE.");
          showToast("Access Denied: Not an admin account.", "error");
          return;
        }

        DOM.adminLoginForm.reset();
      } catch (err) {
        let msg = "Authentication failed. Please check credentials.";
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
          msg = "Invalid admin email or password.";
        } else if (err.code === 'auth/too-many-requests') {
          msg = "Too many failed attempts. Temporarily locked for security.";
        } else if (err.code === 'auth/invalid-email') {
          msg = "Please enter a valid email format.";
        }
        showAuthError(msg);
        showToast(msg, "error");
      } finally {
        if (DOM.btnAdminLogin) {
          DOM.btnAdminLogin.disabled = false;
          DOM.btnAdminLogin.innerHTML = `
            <svg class="svg-icon icon-sm" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Authenticate & Enter
          `;
        }
      }
    });
  }

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem('unicorn_master_auth');
      await signOut(auth);
      AdminState.user = null;
      hideDashboard();
      showToast("Signed out from admin session.", "info");
    } catch (err) {
      showToast("Logout error: " + err.message, "error");
    }
  };

  if (DOM.btnLogout) DOM.btnLogout.addEventListener('click', handleLogout);
  if (DOM.btnTopLogout) DOM.btnTopLogout.addEventListener('click', handleLogout);
}

function showAuthError(msg) {
  if (DOM.authErrorMsg) DOM.authErrorMsg.textContent = msg;
  if (DOM.authErrorAlert) DOM.authErrorAlert.classList.add('visible');
}

function hideAuthError() {
  if (DOM.authErrorAlert) DOM.authErrorAlert.classList.remove('visible');
}

function clearFirebaseData() {
  AdminState.products = [];
  AdminState.banners = [];
  AdminState.requests = [];
  AdminState.reports = [];
  AdminState.notifications = [];
}

// ==============================================================================
// 2. TAB NAVIGATION
// ==============================================================================

function initTabNavigation() {
  const tabTitles = {
    overviewTab: 'Dashboard Overview',
    productsTab: 'Product Management',
    bannersTab: 'Promo Banners Manager',
    brandingTab: 'Logo & Site Branding',
    aboutTab: 'Profile About Section & Community',
    popupTab: 'Starting Announcement Popup',
    maintenanceTab: 'Maintenance Mode Settings',
    requestsTab: 'User Requests',
    reportsTab: 'Issue Reports',
    broadcastTab: 'Live Broadcast Alert'
  };

  if (DOM.sidebarNav) {
    DOM.sidebarNav.addEventListener('click', (e) => {
      const navItem = e.target.closest('.admin-nav-item');
      if (!navItem || !navItem.dataset.tab) return;
      switchTab(navItem.dataset.tab);
    });
  }

  document.addEventListener('click', (e) => {
    const tabLink = e.target.closest('[data-tab-link]');
    if (tabLink && tabLink.dataset.tabLink) {
      switchTab(tabLink.dataset.tabLink);
    }
  });

  function switchTab(tabId) {
    AdminState.currentTab = tabId;

    document.querySelectorAll('.admin-nav-item').forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.admin-tab-pane').forEach(pane => {
      if (pane.id === tabId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    if (DOM.adminHeaderTitle) {
      DOM.adminHeaderTitle.textContent = tabTitles[tabId] || 'Admin Console';
    }

    // Auto-close mobile drawer on tab switch
    if (DOM.adminSidebar) DOM.adminSidebar.classList.remove('mobile-open');
    if (DOM.adminSidebarOverlay) DOM.adminSidebarOverlay.classList.remove('active');
  }
}

// ==============================================================================
// 3. IMGBB API IMAGE UPLOAD SYSTEM
// ==============================================================================

// --- Global Uploader References ---
let ProductUploader, LogoUploader, BannerUploader, PopupUploader;

function setupImageUploader({
  dropZone,
  fileInput,
  progressBar,
  progressFill,
  previewWrapper,
  previewThumb,
  urlInput,
  removeBtn,
  statusText,
  onImageSet
}) {
  if (!dropZone || !fileInput) return { setPreview: () => {}, reset: () => {} };

  const reset = () => {
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (previewThumb) previewThumb.src = '';
    if (previewWrapper) previewWrapper.style.display = 'none';
    if (dropZone) dropZone.style.display = 'block';
    if (progressBar) progressBar.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
    if (onImageSet) onImageSet('');
  };

  const setPreview = (url) => {
    if (!url) {
      reset();
      return;
    }
    if (urlInput) urlInput.value = url;
    if (previewThumb) previewThumb.src = url;
    if (dropZone) dropZone.style.display = 'none';
    if (previewWrapper) previewWrapper.style.display = 'flex';
    if (statusText) statusText.textContent = "Image ready";
    if (onImageSet) onImageSet(url);
  };

  dropZone.addEventListener('click', () => fileInput.click());

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast("Please select a valid image file (PNG, JPG, WebP).", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("Image size must be under 10MB.", "error");
      return;
    }

    // 1. Instant local preview (0ms lag)
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    if (progressBar) progressBar.style.display = 'block';
    if (progressFill) progressFill.style.width = '35%';

    // 2. Upload to ImgBB
    const formData = new FormData();
    formData.append('image', file);

    try {
      if (progressFill) progressFill.style.width = '70%';
      const response = await fetch(`${IMGBB_UPLOAD_URL}?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
      });
      const result = await response.json();

      if (result.success && result.data) {
        if (progressFill) progressFill.style.width = '100%';
        setTimeout(() => {
          if (progressBar) progressBar.style.display = 'none';
        }, 300);

        const directUrl = result.data.display_url || result.data.url;
        setPreview(directUrl);
        showToast("Image hosted on ImgBB successfully!", "success");
      } else {
        throw new Error(result.error?.message || "ImgBB upload error");
      }
    } catch (err) {
      if (progressBar) progressBar.style.display = 'none';
      showToast("Local preview active (Upload note: " + err.message + ")", "info");
    }
  };

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-active', 'dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-active', 'dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active', 'dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  if (removeBtn) removeBtn.addEventListener('click', reset);

  if (urlInput) {
    urlInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) {
        if (previewThumb) previewThumb.src = val;
        if (onImageSet) onImageSet(val);
      }
    });
  }

  return { setPreview, reset };
}

function initAllImageUploaders() {
  // 1. Product Modal Uploader
  ProductUploader = setupImageUploader({
    dropZone: DOM.imgUploadZone,
    fileInput: DOM.imgFileInput,
    progressBar: DOM.uploadProgressBar,
    progressFill: DOM.uploadProgressFill,
    previewWrapper: DOM.uploadPreviewWrapper,
    previewThumb: DOM.imgPreviewThumb,
    urlInput: DOM.prodImgUrl,
    removeBtn: DOM.removeImgBtn,
    statusText: DOM.imgUploadStatusText
  });

  if (DOM.manualImgUrlToggle) {
    DOM.manualImgUrlToggle.addEventListener('click', () => {
      if (DOM.imgUploadZone) DOM.imgUploadZone.style.display = 'none';
      if (DOM.uploadPreviewWrapper) DOM.uploadPreviewWrapper.style.display = 'flex';
      if (DOM.prodImgUrl) DOM.prodImgUrl.focus();
    });
  }

  // 2. Branding Logo Uploader
  LogoUploader = setupImageUploader({
    dropZone: DOM.logoUploadZone,
    fileInput: DOM.logoFileInput,
    progressBar: DOM.logoProgressBar,
    progressFill: DOM.logoProgressFill,
    previewWrapper: DOM.logoPreviewWrapper,
    previewThumb: DOM.brandLogoPreviewThumb,
    urlInput: DOM.brandLogoUrlInput,
    removeBtn: DOM.btnRemoveBrandLogo,
    onImageSet: (url) => {
      const title = (DOM.brandTitleInput?.value || 'UNICORN GOODS').trim();
      const tagline = (DOM.brandTaglineInput?.value || 'Digital Store').trim();
      updateBrandingPreview(title, tagline, url);
    }
  });

  // 3. Banner Modal Uploader
  BannerUploader = setupImageUploader({
    dropZone: DOM.bannerImgUploadZone,
    fileInput: DOM.bannerFileInput,
    progressBar: DOM.bannerProgressBar,
    progressFill: DOM.bannerProgressFill,
    previewWrapper: DOM.bannerPreviewWrapper,
    previewThumb: DOM.bannerPreviewThumb,
    urlInput: DOM.bannerImgUrl,
    removeBtn: DOM.btnRemoveBannerImg
  });

  // 4. Starting Popup Uploader
  PopupUploader = setupImageUploader({
    dropZone: DOM.popupImgUploadZone,
    fileInput: DOM.popupFileInput,
    progressBar: DOM.popupProgressBar,
    progressFill: DOM.popupProgressFill,
    previewWrapper: DOM.popupPreviewWrapper,
    previewThumb: DOM.popupPreviewThumb,
    urlInput: DOM.popupImgInput,
    removeBtn: DOM.btnRemovePopupImg
  });
}

function resetImageUpload() {
  if (ProductUploader) ProductUploader.reset();
}

function setImagePreview(url) {
  if (ProductUploader) ProductUploader.setPreview(url);
}

// ==============================================================================
// 4. FIREBASE REALTIME SYNC (PRODUCTS, BANNERS, POPUP, MAINTENANCE, ETC.)
// ==============================================================================

function initFirebaseDataSync() {
  try {
    // 1. Products
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
        AdminState.products = list;
        updateProductsUI();
      } catch (err) {
        console.warn("Product sync warning:", err);
      }
    });

    // 2. Banners
    onValue(ref(db, 'banners'), (snapshot) => {
      try {
        const data = snapshot.val();
        const list = [];
        if (data) {
          Object.keys(data).forEach(key => {
            list.push({ id: key, ...data[key] });
          });
        }
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        AdminState.banners = list;
        updateBannersUI();
      } catch (err) {
        console.warn("Banners sync warning:", err);
      }
    });

    // 2.5 Branding Settings
    onValue(ref(db, 'settings/branding'), (snapshot) => {
      const branding = snapshot.val();
      if (branding) {
        AdminState.brandingSettings = branding;
        if (DOM.brandTitleInput && document.activeElement !== DOM.brandTitleInput) {
          DOM.brandTitleInput.value = branding.brandTitle || 'UNICORN GOODS';
        }
        if (DOM.brandTaglineInput && document.activeElement !== DOM.brandTaglineInput) {
          DOM.brandTaglineInput.value = branding.brandTagline || 'Digital Store';
        }
        if (DOM.brandLogoUrlInput && document.activeElement !== DOM.brandLogoUrlInput) {
          DOM.brandLogoUrlInput.value = branding.logoUrl || '';
        }
        setLogoPreview(branding.logoUrl || '');
        updateBrandingPreview(branding.brandTitle || 'UNICORN GOODS', branding.brandTagline || 'Digital Store', branding.logoUrl || '');
      }
    });

    // 2.7 About & Community Settings
    onValue(ref(db, 'settings/about'), (snapshot) => {
      const about = snapshot.val();
      if (about) {
        if (DOM.aboutTitleInput && document.activeElement !== DOM.aboutTitleInput) {
          DOM.aboutTitleInput.value = about.title || 'About UNICORN GOODS';
        }
        if (DOM.aboutTaglineInput && document.activeElement !== DOM.aboutTaglineInput) {
          DOM.aboutTaglineInput.value = about.tagline || '';
        }
        if (DOM.aboutContentInput && document.activeElement !== DOM.aboutContentInput) {
          DOM.aboutContentInput.value = about.content || '';
        }
        if (DOM.aboutVersionInput && document.activeElement !== DOM.aboutVersionInput) {
          DOM.aboutVersionInput.value = about.version || 'v2.4.0';
        }
        if (DOM.aboutContactTextInput && document.activeElement !== DOM.aboutContactTextInput) {
          DOM.aboutContactTextInput.value = about.contactText || '';
        }
        if (DOM.aboutContactLinkInput && document.activeElement !== DOM.aboutContactLinkInput) {
          DOM.aboutContactLinkInput.value = about.contactLink || '';
        }
      }
    });

    // 3. Starting Popup Settings
    onValue(ref(db, 'settings/popup'), (snapshot) => {
      const popup = snapshot.val();
      if (popup) {
        AdminState.popupSettings = popup;
        if (DOM.togglePopupActive) DOM.togglePopupActive.checked = popup.enabled === true;
        if (DOM.popupTitleInput && document.activeElement !== DOM.popupTitleInput) DOM.popupTitleInput.value = popup.title || '';
        if (DOM.popupMsgInput && document.activeElement !== DOM.popupMsgInput) DOM.popupMsgInput.value = popup.message || '';
        if (DOM.popupImgInput && document.activeElement !== DOM.popupImgInput) DOM.popupImgInput.value = popup.imgUrl || '';
        if (DOM.popupLinkTextInput && document.activeElement !== DOM.popupLinkTextInput) DOM.popupLinkTextInput.value = popup.linkText || '';
        if (DOM.popupLinkUrlInput && document.activeElement !== DOM.popupLinkUrlInput) DOM.popupLinkUrlInput.value = popup.link || '';
        if (PopupUploader) {
          if (popup.imgUrl) PopupUploader.setPreview(popup.imgUrl);
          else PopupUploader.reset();
        }
      }
    });

    // 4. Maintenance Settings
    onValue(ref(db, 'settings/maintenance'), (snapshot) => {
      const maint = snapshot.val();
      if (maint) {
        AdminState.maintenanceSettings = maint;
        if (DOM.toggleMaintenanceActive) DOM.toggleMaintenanceActive.checked = maint.enabled === true;
        if (DOM.maintTitleInput) DOM.maintTitleInput.value = maint.title || '';
        if (DOM.maintMessageInput) DOM.maintMessageInput.value = maint.message || '';
      }
    });

    // 5. Requests
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
        AdminState.requests = list;
        updateRequestsUI();
      } catch (err) {
        console.warn("Request sync warning:", err);
      }
    });

    // 6. Reports
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
        AdminState.reports = list;
        updateReportsUI();
      } catch (err) {
        console.warn("Report sync warning:", err);
      }
    });

    // 7. Notifications
    onValue(ref(db, 'notifications'), (snapshot) => {
      try {
        const data = snapshot.val();
        const list = [];
        if (data) {
          Object.keys(data).forEach(key => {
            list.push({ id: key, ...data[key] });
          });
        }
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        AdminState.notifications = list;
        updateBroadcastUI();
      } catch (err) {
        console.warn("Notification sync warning:", err);
      }
    });
  } catch (err) {
    showToast("Database synchronization notice.", "error");
  }
}

// ==============================================================================
// 5. PRODUCTS MANAGEMENT & CRUD
// ==============================================================================

function updateProductsUI() {
  const all = AdminState.products;
  const publishedCount = all.filter(p => p.status === 'published').length;

  if (DOM.statTotalProducts) DOM.statTotalProducts.textContent = all.length;
  if (DOM.statPublishedCount) DOM.statPublishedCount.textContent = publishedCount;
  if (DOM.badgeProductCount) DOM.badgeProductCount.textContent = all.length;

  const query = (AdminState.productSearchQuery || '').toLowerCase().trim();
  const filtered = all.filter(p => {
    return !query || 
      (p.title && p.title.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query)) ||
      (p.desc && p.desc.toLowerCase().includes(query));
  });

  if (DOM.overviewProductsTbody) {
    if (all.length === 0) {
      DOM.overviewProductsTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No products yet. Click "Add Product" to publish items.</td></tr>`;
    } else {
      DOM.overviewProductsTbody.innerHTML = all.slice(0, 5).map(p => `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${escapeHTML(p.imgUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.title || 'Item') + '&background=6366f1&color=fff')}" class="table-img-thumb" alt="icon">
              <span style="font-weight: 600;">${escapeHTML(p.title || 'Untitled')}</span>
            </div>
          </td>
          <td><span class="card-category-badge">${escapeHTML(p.category || 'Other')}</span></td>
          <td><span class="status-badge ${p.status === 'published' ? 'status-published' : 'status-draft'}">${p.status === 'published' ? 'Published' : 'Draft'}</span></td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">${formatDate(p.timestamp)}</td>
          <td>
            <button class="btn-table-action btn-edit-product" data-id="${p.id}">
              <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  if (DOM.productsTableBody) {
    if (filtered.length === 0) {
      DOM.productsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No matching products found.</td></tr>`;
      return;
    }

    DOM.productsTableBody.innerHTML = filtered.map(p => {
      const isPublished = p.status === 'published';
      const fallbackImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.title || 'Item')}&background=6366f1&color=fff`;

      return `
        <tr>
          <td>
            <img src="${escapeHTML(p.imgUrl || fallbackImg)}" class="table-img-thumb" alt="thumb" onerror="this.src='${fallbackImg}'">
          </td>
          <td>
            <strong style="display: block; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHTML(p.title || 'Untitled')}
            </strong>
            <span style="font-size: 0.75rem; color: var(--text-muted); display: block; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHTML(p.desc || 'No description')}
            </span>
          </td>
          <td>
            <span class="card-category-badge" data-cat="${escapeHTML(p.category || 'Other')}">${escapeHTML(p.category || 'Other')}</span>
          </td>
          <td>
            <a href="${escapeHTML(p.fileUrl || '#')}" target="_blank" rel="noopener" style="color: var(--accent-primary); font-size: 0.8rem; text-decoration: underline; max-width: 140px; display: inline-block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              Download Link ↗
            </a>
          </td>
          <td>
            <button class="status-badge ${isPublished ? 'status-published' : 'status-draft'} btn-toggle-status" data-id="${p.id}" data-current="${p.status || 'draft'}" title="Click to toggle status" style="cursor: pointer;">
              ${isPublished ? 'Published' : 'Draft'}
            </button>
          </td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">
            ${formatDate(p.timestamp)}
          </td>
          <td>
            <div class="table-actions">
              <button class="btn-table-action btn-edit-product" data-id="${p.id}" title="Edit">
                <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
              <button class="btn-table-action btn-delete btn-delete-product" data-id="${p.id}" data-title="${escapeHTML(p.title || '')}" title="Delete">
                <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
}

function openProductModal(product = null) {
  if (DOM.productForm) DOM.productForm.reset();
  resetImageUpload();

  if (product) {
    if (DOM.productModalTitle) DOM.productModalTitle.textContent = "Edit Product";
    if (DOM.editProductId) DOM.editProductId.value = product.id;
    if (DOM.prodTitle) DOM.prodTitle.value = product.title || '';
    if (DOM.prodCategory) DOM.prodCategory.value = product.category || 'Study Material';
    if (DOM.prodStatus) DOM.prodStatus.value = product.status || 'published';
    if (DOM.prodFileUrl) DOM.prodFileUrl.value = product.fileUrl || '';
    if (DOM.prodDesc) DOM.prodDesc.value = product.desc || '';
    
    if (product.imgUrl) {
      setImagePreview(product.imgUrl);
    }
  } else {
    if (DOM.productModalTitle) DOM.productModalTitle.textContent = "Add New Product";
    if (DOM.editProductId) DOM.editProductId.value = '';
    if (DOM.prodStatus) DOM.prodStatus.value = 'published';
  }

  if (DOM.productModal) openModal(DOM.productModal);
}

async function handleProductSave(e) {
  e.preventDefault();

  const title = (DOM.prodTitle?.value || '').trim();
  const category = DOM.prodCategory?.value || 'Other';
  const status = DOM.prodStatus?.value || 'published';
  const fileUrl = (DOM.prodFileUrl?.value || '').trim();
  const imgUrl = (DOM.prodImgUrl?.value || '').trim();
  const desc = (DOM.prodDesc?.value || '').trim();
  const editId = DOM.editProductId?.value;

  if (!title || !fileUrl) {
    showToast("Please provide a title and download URL.", "error");
    return;
  }

  if (DOM.btnSaveProduct) {
    DOM.btnSaveProduct.disabled = true;
    DOM.btnSaveProduct.textContent = "Saving...";
  }

  try {
    const productPayload = {
      title,
      category,
      status,
      fileUrl,
      imgUrl: imgUrl || '',
      desc: desc || '',
      timestamp: Date.now()
    };

    if (editId) {
      await update(ref(db, `products/${editId}`), productPayload);
      showToast("Product updated successfully.", "success");
    } else {
      await push(ref(db, 'products'), productPayload);
      showToast("Product published to store catalog.", "success");
    }

    if (DOM.productModal) closeModal(DOM.productModal);
  } catch (err) {
    showToast(`Error saving product: ${err.message}`, "error");
  } finally {
    if (DOM.btnSaveProduct) {
      DOM.btnSaveProduct.disabled = false;
      DOM.btnSaveProduct.textContent = "Save Product";
    }
  }
}

async function toggleProductStatus(id, currentStatus) {
  const newStatus = currentStatus === 'published' ? 'draft' : 'published';
  try {
    await update(ref(db, `products/${id}`), { status: newStatus });
    showToast(`Status updated to ${newStatus.toUpperCase()}`, "info");
  } catch (err) {
    showToast("Failed to update status", "error");
  }
}

// ==============================================================================
// 6. BANNERS MANAGEMENT
// ==============================================================================

function updateBannersUI() {
  const list = AdminState.banners;
  if (DOM.badgeBannerCount) DOM.badgeBannerCount.textContent = list.length;
  if (!DOM.bannersTableBody) return;

  if (list.length === 0) {
    DOM.bannersTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No promo banners configured yet.</td></tr>`;
    return;
  }

  DOM.bannersTableBody.innerHTML = list.map(b => {
    const isActive = b.active !== false;
    return `
      <tr>
        <td>
          <img src="${escapeHTML(b.imgUrl || 'https://ui-avatars.com/api/?name=Banner&background=6366f1&color=fff')}" class="table-img-thumb" alt="thumb">
        </td>
        <td><span class="card-category-badge">${escapeHTML(b.badge || 'PROMO')}</span></td>
        <td><strong>${escapeHTML(b.title || 'Untitled')}</strong></td>
        <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 200px;">${escapeHTML(b.subtitle || '')}</td>
        <td><a href="${escapeHTML(b.link || '#')}" target="_blank" style="color: var(--accent-primary); font-size: 0.8rem; text-decoration: underline;">${escapeHTML(b.linkText || 'Link ↗')}</a></td>
        <td>
          <button class="status-badge ${isActive ? 'status-published' : 'status-draft'} btn-toggle-banner-status" data-id="${b.id}" data-active="${isActive}">
            ${isActive ? 'Active' : 'Inactive'}
          </button>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-table-action btn-edit-banner" data-id="${b.id}" title="Edit banner">
              <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-table-action btn-delete btn-delete-banner" data-id="${b.id}" data-title="${escapeHTML(b.title || '')}" title="Delete banner">
              <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openBannerModal(banner = null) {
  if (DOM.bannerForm) DOM.bannerForm.reset();
  if (banner) {
    if (DOM.bannerModalTitle) DOM.bannerModalTitle.textContent = "Edit Promo Banner";
    if (DOM.editBannerId) DOM.editBannerId.value = banner.id;
    if (DOM.bannerBadge) DOM.bannerBadge.value = banner.badge || '';
    if (DOM.bannerTitle) DOM.bannerTitle.value = banner.title || '';
    if (DOM.bannerSubtitle) DOM.bannerSubtitle.value = banner.subtitle || '';
    if (DOM.bannerImgUrl) DOM.bannerImgUrl.value = banner.imgUrl || '';
    if (DOM.bannerLinkText) DOM.bannerLinkText.value = banner.linkText || '';
    if (DOM.bannerLink) DOM.bannerLink.value = banner.link || '';
    if (BannerUploader) {
      if (banner.imgUrl) BannerUploader.setPreview(banner.imgUrl);
      else BannerUploader.reset();
    }
  } else {
    if (DOM.bannerModalTitle) DOM.bannerModalTitle.textContent = "Create Promo Banner";
    if (DOM.editBannerId) DOM.editBannerId.value = '';
    if (DOM.bannerBadge) DOM.bannerBadge.value = "SPECIAL UPDATE";
    if (BannerUploader) BannerUploader.reset();
  }
  if (DOM.bannerModal) openModal(DOM.bannerModal);
}

async function handleBannerSave(e) {
  e.preventDefault();
  const title = (DOM.bannerTitle?.value || '').trim();
  const badge = (DOM.bannerBadge?.value || '').trim() || 'PROMO';
  const subtitle = (DOM.bannerSubtitle?.value || '').trim();
  const imgUrl = (DOM.bannerImgUrl?.value || '').trim();
  const linkText = (DOM.bannerLinkText?.value || '').trim() || 'Check It Out';
  const link = (DOM.bannerLink?.value || '').trim();
  const editId = DOM.editBannerId?.value;

  if (!title) {
    showToast("Banner title is required.", "error");
    return;
  }

  try {
    const payload = {
      title,
      badge,
      subtitle,
      imgUrl,
      linkText,
      link,
      active: true,
      timestamp: Date.now()
    };

    if (editId) {
      await update(ref(db, `banners/${editId}`), payload);
      showToast("Banner updated.", "success");
    } else {
      await push(ref(db, 'banners'), payload);
      showToast("New banner live on user panel.", "success");
    }

    if (DOM.bannerModal) closeModal(DOM.bannerModal);
  } catch (err) {
    showToast("Failed to save banner", "error");
  }
}

async function toggleBannerStatus(id, currentActive) {
  const next = currentActive !== 'true';
  try {
    await update(ref(db, `banners/${id}`), { active: next });
    showToast(`Banner set to ${next ? 'ACTIVE' : 'INACTIVE'}`, "info");
  } catch (err) {
    showToast("Status update failed", "error");
  }
}

// ==============================================================================
// 7. BRANDING & LOGO SETTINGS
// ==============================================================================

function setLogoPreview(url) {
  if (LogoUploader) LogoUploader.setPreview(url);
}

function resetLogoUpload() {
  if (LogoUploader) LogoUploader.reset();
}

function updateBrandingPreview(title, tagline, logoUrl) {
  if (DOM.previewBrandTitle) DOM.previewBrandTitle.textContent = title || 'UNICORN GOODS';
  if (DOM.previewBrandTagline) DOM.previewBrandTagline.textContent = tagline || 'Digital Store';
  
  if (logoUrl && DOM.previewLogoImg && DOM.previewDefaultIcon) {
    DOM.previewLogoImg.src = logoUrl;
    DOM.previewLogoImg.style.display = 'block';
    DOM.previewDefaultIcon.style.display = 'none';
  } else if (DOM.previewLogoImg && DOM.previewDefaultIcon) {
    DOM.previewLogoImg.style.display = 'none';
    DOM.previewDefaultIcon.style.display = 'block';
  }
}

async function handleBrandingSave(e) {
  e.preventDefault();
  const brandTitle = (DOM.brandTitleInput?.value || 'UNICORN GOODS').trim();
  const brandTagline = (DOM.brandTaglineInput?.value || 'Digital Store').trim();
  const logoUrl = (DOM.brandLogoUrlInput?.value || '').trim();

  if (!brandTitle) {
    showToast("Brand title is required.", "error");
    return;
  }

  if (DOM.btnSaveBranding) {
    DOM.btnSaveBranding.disabled = true;
    DOM.btnSaveBranding.innerHTML = `<span>Saving...</span>`;
  }

  try {
    await set(ref(db, 'settings/branding'), {
      brandTitle,
      brandTagline,
      logoUrl,
      updatedAt: Date.now()
    });
    showToast("Site branding and logo updated successfully!", "success");
  } catch (err) {
    showToast("Failed to save branding: " + err.message, "error");
  } finally {
    if (DOM.btnSaveBranding) {
      DOM.btnSaveBranding.disabled = false;
      DOM.btnSaveBranding.innerHTML = `
        <svg class="svg-icon icon-sm" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
        Update Brand Settings
      `;
    }
  }
}

// ==============================================================================
// 7.5 ABOUT SECTION & COMMUNITY SETTINGS
// ==============================================================================

async function handleAboutSettingsSave(e) {
  e.preventDefault();
  const title = (DOM.aboutTitleInput?.value || '').trim() || 'About UNICORN GOODS';
  const tagline = (DOM.aboutTaglineInput?.value || '').trim();
  const content = (DOM.aboutContentInput?.value || '').trim();
  const version = (DOM.aboutVersionInput?.value || '').trim() || 'v2.4.0';
  const contactText = (DOM.aboutContactTextInput?.value || '').trim();
  const contactLink = (DOM.aboutContactLinkInput?.value || '').trim();

  if (!content) {
    showToast("About description/content is required.", "error");
    return;
  }

  if (DOM.btnSaveAbout) {
    DOM.btnSaveAbout.disabled = true;
    DOM.btnSaveAbout.innerHTML = `<span>Saving About Info...</span>`;
  }

  try {
    await set(ref(db, 'settings/about'), {
      title,
      tagline,
      content,
      version,
      contactText,
      contactLink,
      updatedAt: Date.now()
    });
    showToast("About settings saved! Instantly live on User Profile.", "success");
  } catch (err) {
    showToast("Failed to save about info: " + err.message, "error");
  } finally {
    if (DOM.btnSaveAbout) {
      DOM.btnSaveAbout.disabled = false;
      DOM.btnSaveAbout.innerHTML = `
        <svg class="svg-icon icon-sm" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
        Save About Settings
      `;
    }
  }
}

// ==============================================================================
// 8. STARTING POPUP SETTINGS
// ==============================================================================

async function handlePopupSettingsSave(e) {
  e.preventDefault();
  const enabled = DOM.togglePopupActive?.checked || false;
  const title = (DOM.popupTitleInput?.value || '').trim();
  const message = (DOM.popupMsgInput?.value || '').trim();
  const imgUrl = (DOM.popupImgInput?.value || '').trim();
  const linkText = (DOM.popupLinkTextInput?.value || '').trim();
  const link = (DOM.popupLinkUrlInput?.value || '').trim();

  try {
    await set(ref(db, 'settings/popup'), {
      enabled,
      title,
      message,
      imgUrl,
      linkText,
      link,
      updatedAt: Date.now()
    });
    showToast(`Starting popup ${enabled ? 'ENABLED' : 'DISABLED'} successfully.`, "success");
  } catch (err) {
    showToast("Failed to update popup settings", "error");
  }
}

// ==============================================================================
// 8. MAINTENANCE MODE
// ==============================================================================

async function handleMaintenanceSave(e) {
  e.preventDefault();
  const enabled = DOM.toggleMaintenanceActive?.checked || false;
  const title = (DOM.maintTitleInput?.value || '').trim() || "Under Maintenance";
  const message = (DOM.maintMessageInput?.value || '').trim() || "We are currently performing server maintenance. We will be back shortly!";

  try {
    await set(ref(db, 'settings/maintenance'), {
      enabled,
      title,
      message,
      updatedAt: Date.now()
    });
    showToast(`Maintenance mode ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}!`, enabled ? "warning" : "success");
  } catch (err) {
    showToast("Failed to update maintenance settings", "error");
  }
}

// ==============================================================================
// 9. REQUESTS, REPORTS, BROADCAST
// ==============================================================================

function updateRequestsUI() {
  const list = AdminState.requests;
  const pendingCount = list.filter(r => r.status === 'pending').length;

  if (DOM.statPendingRequests) DOM.statPendingRequests.textContent = pendingCount;
  if (DOM.badgeRequestCount) DOM.badgeRequestCount.textContent = pendingCount;
  if (DOM.requestsCountBadge) DOM.requestsCountBadge.textContent = `${list.length} Requests (${pendingCount} Pending)`;

  if (!DOM.requestsTableBody) return;

  if (list.length === 0) {
    DOM.requestsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No user requests yet.</td></tr>`;
    return;
  }

  DOM.requestsTableBody.innerHTML = list.map(r => {
    const status = (r.status || 'pending').toLowerCase();
    const hasReply = !!r.adminReply;
    return `
      <tr>
        <td><strong>${escapeHTML(r.userName || 'Anonymous')}</strong></td>
        <td><strong style="color: var(--accent-primary);">${escapeHTML(r.itemName || 'Item')}</strong></td>
        <td><span class="card-category-badge">${escapeHTML(r.category || 'Item')}</span></td>
        <td style="font-size: 0.82rem; color: var(--text-secondary); max-width: 250px;">
          ${escapeHTML(r.details || 'No extra details')}
          ${hasReply ? `<div style="font-size: 0.72rem; color: var(--accent-primary); margin-top: 3px; font-weight: 600;">💬 Admin Note: ${escapeHTML(r.adminReply)}</div>` : ''}
        </td>
        <td><span class="status-pill status-pill-${status}">${status.toUpperCase()}</span></td>
        <td style="color: var(--text-muted); font-size: 0.8rem;">${formatDate(r.timestamp)}</td>
        <td>
          <div class="table-actions">
            <button class="btn-table-action btn-reply-request" data-id="${r.id}" style="color: var(--accent-primary); font-weight: 700;">
              Review / Reply
            </button>
            <button class="btn-table-action btn-delete btn-delete-request" data-id="${r.id}" data-title="${escapeHTML(r.itemName || '')}">
              <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAdminReplyModal(type, item) {
  if (!item || !DOM.adminReplyModal) return;
  if (DOM.replyTargetType) DOM.replyTargetType.value = type;
  if (DOM.replyTargetId) DOM.replyTargetId.value = item.id;
  if (DOM.replyTargetUser) DOM.replyTargetUser.textContent = `Submitted by: ${item.userName || item.userEmail || 'Community User'}`;
  if (DOM.replyTargetTitle) DOM.replyTargetTitle.textContent = item.itemName || item.productTitle || 'Item';
  if (DOM.replyTargetDetails) DOM.replyTargetDetails.textContent = item.details || item.issue || 'No extra notes provided.';
  if (DOM.replyStatusSelect) DOM.replyStatusSelect.value = item.status || 'pending';
  if (DOM.adminReplyMessageInput) DOM.adminReplyMessageInput.value = item.adminReply || '';
  openModal(DOM.adminReplyModal);
}

async function handleAdminReplySubmit(e) {
  e.preventDefault();
  const type = DOM.replyTargetType?.value || 'request';
  const id = DOM.replyTargetId?.value;
  const status = DOM.replyStatusSelect?.value || 'pending';
  const adminReply = (DOM.adminReplyMessageInput?.value || '').trim();

  if (!id) return;

  if (DOM.btnSaveAdminReply) {
    DOM.btnSaveAdminReply.disabled = true;
    DOM.btnSaveAdminReply.textContent = "Saving...";
  }

  try {
    const table = type === 'request' ? 'requests' : 'reports';
    await update(ref(db, `${table}/${id}`), {
      status,
      adminReply: adminReply || null,
      replyTimestamp: Date.now()
    });
    showToast("Status & reply saved! User can now view progress in their profile.", "success");
    if (DOM.adminReplyModal) closeModal(DOM.adminReplyModal);
  } catch (err) {
    showToast(`Failed to save reply: ${err.message}`, "error");
  } finally {
    if (DOM.btnSaveAdminReply) {
      DOM.btnSaveAdminReply.disabled = false;
      DOM.btnSaveAdminReply.textContent = "Save & Send Reply";
    }
  }
}

async function toggleRequestStatus(id, currentStatus) {
  const next = currentStatus === 'done' ? 'pending' : 'done';
  try {
    await update(ref(db, `requests/${id}`), { status: next });
    showToast(`Request marked as ${next.toUpperCase()}`, "success");
  } catch (err) {
    showToast("Failed to update request", "error");
  }
}

function updateReportsUI() {
  const list = AdminState.reports;
  const pendingCount = list.filter(r => r.status === 'pending').length;

  if (DOM.statPendingReports) DOM.statPendingReports.textContent = pendingCount;
  if (DOM.badgeReportCount) DOM.badgeReportCount.textContent = pendingCount;
  if (DOM.reportsCountBadge) DOM.reportsCountBadge.textContent = `${list.length} Reports (${pendingCount} Open)`;

  if (!DOM.reportsTableBody) return;

  if (list.length === 0) {
    DOM.reportsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No reports filed. All downloads operational.</td></tr>`;
    return;
  }

  DOM.reportsTableBody.innerHTML = list.map(r => {
    const status = (r.status || 'pending').toLowerCase();
    const hasReply = !!r.adminReply;
    return `
      <tr>
        <td><strong>${escapeHTML(r.userName || 'User')}</strong></td>
        <td><span style="font-weight: 600; color: var(--text-primary);">${escapeHTML(r.productTitle || r.productId || 'Item')}</span></td>
        <td><span class="card-category-badge" style="background: var(--color-danger-bg); color: var(--color-danger);">${escapeHTML(r.reason || 'Issue')}</span></td>
        <td style="font-size: 0.82rem; color: var(--text-secondary); max-width: 250px;">
          ${escapeHTML(r.issue || 'No details provided.')}
          ${hasReply ? `<div style="font-size: 0.72rem; color: var(--accent-primary); margin-top: 3px; font-weight: 600;">💬 Admin Note: ${escapeHTML(r.adminReply)}</div>` : ''}
        </td>
        <td><span class="status-pill status-pill-${status}">${status.toUpperCase()}</span></td>
        <td style="color: var(--text-muted); font-size: 0.8rem;">${formatDate(r.timestamp)}</td>
        <td>
          <div class="table-actions">
            <button class="btn-table-action btn-reply-report" data-id="${r.id}" style="color: var(--accent-primary); font-weight: 700;">
              Review / Reply
            </button>
            <button class="btn-table-action btn-delete btn-delete-report" data-id="${r.id}">
              <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleReportStatus(id, currentStatus) {
  const next = currentStatus === 'resolved' ? 'pending' : 'resolved';
  try {
    await update(ref(db, `reports/${id}`), { status: next });
    showToast(`Report marked as ${next.toUpperCase()}`, "success");
  } catch (err) {
    showToast("Failed to update report", "error");
  }
}

function updateBroadcastUI() {
  const list = AdminState.notifications;
  if (!DOM.broadcastTableBody) return;

  if (list.length === 0) {
    DOM.broadcastTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No broadcasts sent yet.</td></tr>`;
    return;
  }

  DOM.broadcastTableBody.innerHTML = list.map(n => `
    <tr>
      <td><span class="card-category-badge">${escapeHTML(n.type || 'info')}</span></td>
      <td style="font-weight: 500; max-width: 260px;">${escapeHTML(n.message || '')}</td>
      <td style="color: var(--text-muted); font-size: 0.8rem;">${formatDate(n.timestamp)}</td>
      <td>
        <button class="btn-table-action btn-delete btn-delete-notif" data-id="${n.id}">
          <svg class="svg-icon icon-xs" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

async function handleBroadcastSubmit(e) {
  e.preventDefault();
  const message = (DOM.broadcastMsgInput?.value || '').trim();
  const type = DOM.broadcastTypeInput?.value || 'info';

  if (!message) {
    showToast("Please enter an announcement message.", "error");
    return;
  }

  if (DOM.btnSendBroadcast) {
    DOM.btnSendBroadcast.disabled = true;
    DOM.btnSendBroadcast.textContent = "Broadcasting...";
  }

  try {
    await push(ref(db, 'notifications'), {
      message,
      type,
      timestamp: Date.now()
    });
    showToast("Broadcast message sent to all active users.", "success");
    if (DOM.broadcastForm) DOM.broadcastForm.reset();
  } catch (err) {
    showToast("Failed to send broadcast", "error");
  } finally {
    if (DOM.btnSendBroadcast) {
      DOM.btnSendBroadcast.disabled = false;
      DOM.btnSendBroadcast.textContent = "Push Broadcast to All Users";
    }
  }
}

// ==============================================================================
// 10. DELETE ACTIONS
// ==============================================================================

function requestDelete(type, id, title = '') {
  AdminState.itemPendingDelete = { type, id };
  if (DOM.deleteConfirmText) {
    DOM.deleteConfirmText.textContent = `Are you sure you want to delete "${title || type}"? This cannot be undone.`;
  }
  if (DOM.deleteConfirmModal) openModal(DOM.deleteConfirmModal);
}

async function executeDelete() {
  if (!AdminState.itemPendingDelete) return;
  const { type, id } = AdminState.itemPendingDelete;

  try {
    const pathMap = {
      product: `products/${id}`,
      banner: `banners/${id}`,
      request: `requests/${id}`,
      report: `reports/${id}`,
      notification: `notifications/${id}`
    };

    const targetPath = pathMap[type];
    if (targetPath) {
      await remove(ref(db, targetPath));
      showToast(`${type.toUpperCase()} deleted successfully.`, "info");
    }
  } catch (err) {
    showToast(`Delete notice: ${err.message}`, "error");
  } finally {
    if (DOM.deleteConfirmModal) closeModal(DOM.deleteConfirmModal);
    AdminState.itemPendingDelete = null;
  }
}

// ==============================================================================
// 11. EVENT BINDINGS
// ==============================================================================

function initEventListeners() {
  if (DOM.adminThemeToggleBtn) DOM.adminThemeToggleBtn.addEventListener('click', toggleTheme);

  if (DOM.openAddProductModalBtn) DOM.openAddProductModalBtn.addEventListener('click', () => openProductModal(null));
  if (DOM.quickAddProductBtn) DOM.quickAddProductBtn.addEventListener('click', () => openProductModal(null));

  if (DOM.openAddBannerModalBtn) DOM.openAddBannerModalBtn.addEventListener('click', () => openBannerModal(null));
  if (DOM.quickAddBannerBtn) DOM.quickAddBannerBtn.addEventListener('click', () => openBannerModal(null));

  if (DOM.quickPopupBtn) {
    DOM.quickPopupBtn.addEventListener('click', () => {
      const popupNav = document.querySelector('[data-tab="popupTab"]');
      if (popupNav) popupNav.click();
    });
  }

  // Mobile Sidebar Drawer Toggle
  const openMobileSidebar = () => {
    if (DOM.adminSidebar) DOM.adminSidebar.classList.add('mobile-open');
    if (DOM.adminSidebarOverlay) DOM.adminSidebarOverlay.classList.add('active');
  };

  const closeMobileSidebar = () => {
    if (DOM.adminSidebar) DOM.adminSidebar.classList.remove('mobile-open');
    if (DOM.adminSidebarOverlay) DOM.adminSidebarOverlay.classList.remove('active');
  };

  if (DOM.btnMobileMenuToggle) DOM.btnMobileMenuToggle.addEventListener('click', openMobileSidebar);
  if (DOM.btnCloseMobileSidebar) DOM.btnCloseMobileSidebar.addEventListener('click', closeMobileSidebar);
  if (DOM.adminSidebarOverlay) DOM.adminSidebarOverlay.addEventListener('click', closeMobileSidebar);

  if (DOM.productForm) DOM.productForm.addEventListener('submit', handleProductSave);
  if (DOM.bannerForm) DOM.bannerForm.addEventListener('submit', handleBannerSave);
  if (DOM.brandingSettingsForm) DOM.brandingSettingsForm.addEventListener('submit', handleBrandingSave);
  if (DOM.aboutSettingsForm) DOM.aboutSettingsForm.addEventListener('submit', handleAboutSettingsSave);
  if (DOM.popupSettingsForm) DOM.popupSettingsForm.addEventListener('submit', handlePopupSettingsSave);
  if (DOM.maintenanceForm) DOM.maintenanceForm.addEventListener('submit', handleMaintenanceSave);
  if (DOM.broadcastForm) DOM.broadcastForm.addEventListener('submit', handleBroadcastSubmit);
  if (DOM.adminReplyForm) DOM.adminReplyForm.addEventListener('submit', handleAdminReplySubmit);
  if (DOM.btnConfirmDelete) DOM.btnConfirmDelete.addEventListener('click', executeDelete);

  // Debounced live search for 60fps performance
  let searchDebounceTimer;
  if (DOM.adminProductSearch) {
    DOM.adminProductSearch.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        AdminState.productSearchQuery = e.target.value;
        updateProductsUI();
      }, 150);
    });
  }

  // Table clicks
  if (DOM.productsTableBody) {
    DOM.productsTableBody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit-product');
      if (editBtn) {
        const prod = AdminState.products.find(p => p.id === editBtn.dataset.id);
        if (prod) openProductModal(prod);
        return;
      }
      const statusBtn = e.target.closest('.btn-toggle-status');
      if (statusBtn) {
        toggleProductStatus(statusBtn.dataset.id, statusBtn.dataset.current);
        return;
      }
      const deleteBtn = e.target.closest('.btn-delete-product');
      if (deleteBtn) {
        requestDelete('product', deleteBtn.dataset.id, deleteBtn.dataset.title);
        return;
      }
    });
  }

  if (DOM.bannersTableBody) {
    DOM.bannersTableBody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit-banner');
      if (editBtn) {
        const banner = AdminState.banners.find(b => b.id === editBtn.dataset.id);
        if (banner) openBannerModal(banner);
        return;
      }
      const statusBtn = e.target.closest('.btn-toggle-banner-status');
      if (statusBtn) {
        toggleBannerStatus(statusBtn.dataset.id, statusBtn.dataset.active);
        return;
      }
      const deleteBtn = e.target.closest('.btn-delete-banner');
      if (deleteBtn) {
        requestDelete('banner', deleteBtn.dataset.id, deleteBtn.dataset.title);
        return;
      }
    });
  }

  if (DOM.requestsTableBody) {
    DOM.requestsTableBody.addEventListener('click', (e) => {
      const replyBtn = e.target.closest('.btn-reply-request');
      if (replyBtn) {
        const item = AdminState.requests.find(r => r.id === replyBtn.dataset.id);
        if (item) openAdminReplyModal('request', item);
        return;
      }
      const toggleBtn = e.target.closest('.btn-toggle-request-status');
      if (toggleBtn) {
        toggleRequestStatus(toggleBtn.dataset.id, toggleBtn.dataset.status);
        return;
      }
      const deleteBtn = e.target.closest('.btn-delete-request');
      if (deleteBtn) {
        requestDelete('request', deleteBtn.dataset.id, deleteBtn.dataset.title);
        return;
      }
    });
  }

  if (DOM.reportsTableBody) {
    DOM.reportsTableBody.addEventListener('click', (e) => {
      const replyBtn = e.target.closest('.btn-reply-report');
      if (replyBtn) {
        const item = AdminState.reports.find(r => r.id === replyBtn.dataset.id);
        if (item) openAdminReplyModal('report', item);
        return;
      }
      const toggleBtn = e.target.closest('.btn-toggle-report-status');
      if (toggleBtn) {
        toggleReportStatus(toggleBtn.dataset.id, toggleBtn.dataset.status);
        return;
      }
      const deleteBtn = e.target.closest('.btn-delete-report');
      if (deleteBtn) {
        requestDelete('report', deleteBtn.dataset.id, 'Report');
        return;
      }
    });
  }

  if (DOM.broadcastTableBody) {
    DOM.broadcastTableBody.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.btn-delete-notif');
      if (deleteBtn) {
        requestDelete('notification', deleteBtn.dataset.id, 'Broadcast');
      }
    });
  }

  // Modals
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.getAttribute('data-close-modal'));
      if (target) closeModal(target);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
    }
  });
}

// ==============================================================================
// 12. UI HELPERS
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
  } else if (type === 'warning') {
    iconSvg = `<svg class="svg-icon icon-sm" style="color: var(--color-warning);" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`;
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

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Boot Admin Logic
initAdmin();
