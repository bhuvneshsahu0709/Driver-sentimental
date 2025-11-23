// Authentication Handler

const AUTH_KEY = 'movesync_admin_auth';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '12345';

// Check if user is authenticated
function isAuthenticated() {
    const auth = sessionStorage.getItem(AUTH_KEY);
    return auth === 'true';
}

// Authenticate user
function authenticate(username, password) {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        sessionStorage.setItem(AUTH_KEY, 'true');
        return true;
    }
    return false;
}

// Logout
function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    window.location.href = '/index.html';
}

// Require authentication (redirect if not authenticated)
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

