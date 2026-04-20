export function getUser() {
    try {
        const userData = localStorage.getItem('user');
        if (userData && userData !== 'undefined' && userData !== 'null') {
            return JSON.parse(userData);
        }
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
    }
    return null;
}

export function updateNav(isLoggedIn) {
    const navLinks = document.getElementById('navLinks');
    if (isLoggedIn) {
        navLinks.innerHTML = `
            <a href="/" class="text-sm font-medium text-indigo-600">Marketplace</a>
            <a href="/my-listings" class="text-sm font-medium text-slate-500 hover:text-slate-900 transition">My Listings</a>
        `;
    } else {
        navLinks.innerHTML = `
            <a href="/" class="text-sm font-medium text-indigo-600">Marketplace</a>
        `;
    }
}
            // <a href="#" class="text-sm font-medium text-slate-500 hover:text-slate-900 transition">Messages</a>

export function updateAuthSection(isLoggedIn) {
    const authSection = document.getElementById('authSection');
    const user = getUser();
    if (isLoggedIn && user) {
        authSection.innerHTML = `
            <span class="text-sm text-slate-700">Welcome, ${user.name}!</span>
            <button id="logoutBtn" class="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
            </button>
        `;
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('user');
            location.reload();
        });
    } else {
        authSection.innerHTML = `
            <a href="/login" class="text-sm font-medium text-slate-500 hover:text-slate-900 transition">Login</a>
            <a href="/signup" class="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition">Sign Up</a>
        `;
    }
}