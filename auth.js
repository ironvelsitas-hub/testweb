// ============ AUTHENTICATION SYSTEM ============
let currentUser = null;

// Check if user is logged in
function checkAuth() {
  const savedUser = localStorage.getItem('kios_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

// Get current user
function getCurrentUser() {
  return currentUser;
}

// Login function
async function login(username, password) {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      currentUser = data.user;
      localStorage.setItem('kios_user', JSON.stringify(currentUser));
      return { success: true, user: currentUser };
    } else {
      return { success: false, error: data.error || 'Login gagal' };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Gagal terhubung ke server' };
  }
}

// Logout function
function logout() {
  currentUser = null;
  localStorage.removeItem('kios_user');
  // Redirect to login page
  showLoginPage();
}

// Check role permissions
function hasRole(roles) {
  if (!currentUser) return false;
  if (typeof roles === 'string') return currentUser.role === roles;
  if (Array.isArray(roles)) return roles.includes(currentUser.role);
  return false;
}

// Show login page, hide main content
function showLoginPage() {
  const loginContainer = document.getElementById('loginContainer');
  const mainContainer = document.getElementById('mainContainer');
  
  if (loginContainer) loginContainer.style.display = 'flex';
  if (mainContainer) mainContainer.style.display = 'none';
}

// Show main content, hide login page
function showMainContent() {
  const loginContainer = document.getElementById('loginContainer');
  const mainContainer = document.getElementById('mainContainer');
  
  if (loginContainer) loginContainer.style.display = 'none';
  if (mainContainer) mainContainer.style.display = 'block';
  
  // Update user info in navbar
  updateUserInfo();
}

// Update user info display
function updateUserInfo() {
  const userInfoSpan = document.getElementById('userInfo');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (userInfoSpan && currentUser) {
    let roleText = '';
    switch(currentUser.role) {
      case 'ADMIN': roleText = '👑 Admin'; break;
      case 'CASHIER': roleText = '💰 Kasir'; break;
      case 'WAREHOUSE': roleText = '📦 Gudang'; break;
      default: roleText = '👤 User';
    }
    userInfoSpan.innerHTML = `${roleText} | ${currentUser.name}`;
  }
  
  if (logoutBtn) logoutBtn.style.display = currentUser ? 'flex' : 'none';
  
  // Apply role-based UI restrictions
  applyRoleRestrictions();
}

// Apply UI restrictions based on user role
function applyRoleRestrictions() {
  if (!currentUser) return;
  
  const isAdmin = currentUser.role === 'ADMIN';
  const isWarehouse = currentUser.role === 'WAREHOUSE';
  const isCashier = currentUser.role === 'CASHIER';
  
  // Admin: can access all features
  // Cashier: cannot access member management, product management
  // Warehouse: only can manage products and stock
  
  const memberTab = document.querySelector('.tab-btn[onclick*="members"]');
  const productTab = document.querySelector('.tab-btn[onclick*="products"]');
  const formAddProduct = document.querySelector('.form-add');
  const editDeleteButtons = document.querySelectorAll('.edit-btn, .delete-btn');
  
  if (isCashier) {
    // Cashier cannot add/edit/delete products or manage members
    if (memberTab) memberTab.style.display = 'none';
    if (formAddProduct) formAddProduct.style.display = 'none';
    editDeleteButtons.forEach(btn => btn.style.display = 'none');
  } else if (isWarehouse) {
    // Warehouse can only manage products, cannot do transactions
    if (memberTab) memberTab.style.display = 'none';
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) checkoutBtn.disabled = true;
  }
}

// Handle login form submission
function initLoginForm() {
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      
      if (!username || !password) {
        if (loginError) loginError.textContent = 'Username dan password harus diisi!';
        return;
      }
      
      loginBtn.disabled = true;
      loginBtn.textContent = 'Loading...';
      
      const result = await login(username, password);
      
      if (result.success) {
        showMainContent();
        // Refresh data after login
        if (typeof loadProducts === 'function') loadProducts();
        if (typeof loadMembers === 'function') loadMembers();
        if (typeof loadRewards === 'function') loadRewards();
      } else {
        if (loginError) loginError.textContent = result.error;
      }
      
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    });
  }
  
  // Enter key submit
  if (usernameInput && passwordInput) {
    const submitOnEnter = (e) => {
      if (e.key === 'Enter') loginBtn.click();
    };
    usernameInput.addEventListener('keypress', submitOnEnter);
    passwordInput.addEventListener('keypress', submitOnEnter);
  }
}

// Initialize auth system
function initAuth() {
  initLoginForm();
  
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  
  // Check if user is already logged in
  if (checkAuth()) {
    showMainContent();
    // Refresh data after login
    setTimeout(() => {
      if (typeof loadProducts === 'function') loadProducts();
      if (typeof loadMembers === 'function') loadMembers();
      if (typeof loadRewards === 'function') loadRewards();
    }, 100);
  } else {
    showLoginPage();
  }
}

// Export functions
window.login = login;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.hasRole = hasRole;
window.checkAuth = checkAuth;
window.initAuth = initAuth;