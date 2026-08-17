/**
 * StreamPulse - Home Page Script
 * Pure Vanilla JavaScript using Fetch API with credentials: "include"
 */

// Single configurable Backend API Base URL
const API_BASE_URL = "https://youtubemvp-production.up.railway.app";

// Global State Management
let currentUser = null;
let allVideos = [];
let userCategories = []; // categories the user likes / has searched before
let activeCategory = "All";
let searchQuery = "";
let currentPage = 1;
let hasMoreVideos = false;
let isLoadingMore = false;

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
    setupEventListeners();
    await checkAuthentication();
    await fetchVideos();
});

/**
 * Setup DOM event listeners
 */
function setupEventListeners() {
    // Sidebar Mobile Toggle
    const sidebarToggleBtn = document.getElementById("sidebar-toggle");
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebar-overlay");

    if (sidebarToggleBtn && sidebar && sidebarOverlay) {
        sidebarToggleBtn.addEventListener("click", () => {
            sidebar.classList.toggle("mobile-open");
            sidebarOverlay.classList.toggle("active");
        });

        sidebarOverlay.addEventListener("click", () => {
            sidebar.classList.remove("mobile-open");
            sidebarOverlay.classList.remove("active");
        });
    }

    // Category Bar Filter Click Handling
    const categoryBar = document.getElementById("category-bar");
    if (categoryBar) {
        categoryBar.addEventListener("click", (e) => {
            if (e.target.classList.contains("chip")) {
                document.querySelectorAll(".chip").forEach(chip => chip.classList.remove("active"));
                e.target.classList.add("active");
                activeCategory = e.target.getAttribute("data-category") || "All";
                // Re-fetch from the server for this category instead of
                // filtering the client-side list: the loaded list is only
                // ever a batch of videos (see pagination below), so
                // filtering locally would only ever show whatever tiny
                // slice happened to already be loaded, not everything
                // that exists in that category.
                fetchVideos(1);
            }
        });
    }

    // Search Form Handler
    //
    // Redirects to search.html (same as watch.js's header search),
    // which queries the backend's full-catalog search endpoint
    // (GET /api/auth/search_videos) - that endpoint searches EVERY
    // video's title/description/category, regardless of the user's
    // preferences.
    //
    // This used to filter locally over `allVideos` instead, but that
    // array only ever holds whatever's currently loaded on the home
    // page - the personalized feed (the user's liked/searched
    // categories, plus a small fixed slice of ~20 "other category"
    // videos - see OTHER_CATEGORY_COUNT server-side) or a single
    // category's batch. Searching for something from a category the
    // user has never liked or searched would frequently find nothing
    // even though the video exists in the catalog, simply because it
    // was never fetched into `allVideos` in the first place.
    const searchForm = document.getElementById("search-form");
    const searchInput = document.getElementById("search-input");
    if (searchForm && searchInput) {
        searchForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `search.html?q=${encodeURIComponent(query)}`;
            }
        });
    }

    // Retry Button Handler for Error State
    const retryBtn = document.getElementById("retry-btn");
    if (retryBtn) {
        retryBtn.addEventListener("click", () => fetchVideos());
    }

    // Load More Button Handler (optional - only wired if the page markup
    // has a #load-more-btn element; safe no-op otherwise).
    const loadMoreBtn = document.getElementById("load-more-btn");
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", loadMoreVideos);
    }

    // Infinite Scroll: automatically fetch the next batch of videos as
    // the user scrolls near the bottom of the page (see setupInfiniteScroll).
    setupInfiniteScroll();
}

/**
 * Check User Authentication Status
 * Uses GET /api/auth/me
 */
async function checkAuthentication() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include"
        });

        if (response.ok) {
            const data = await response.json();
            if (data && data.authenticated && data.user) {
                currentUser = data.user;
                renderUserMenu(data.user);
                return;
            }
        }
        renderLoginButton();
    } catch (err) {
        console.warn("Auth check error or unauthenticated:", err);
        renderLoginButton();
    }
}

/**
 * Render Header User Dropdown Menu when Authenticated
 */
function renderUserMenu(user) {
    const headerAuthSection = document.getElementById("header-auth-section");
    if (!headerAuthSection) return;

    const userInitial = user.name ? user.name.charAt(0).toUpperCase() : "U";

    headerAuthSection.innerHTML = `
        <div class="user-profile-menu">
            <button id="user-avatar-btn" class="avatar-btn" aria-label="User Menu">${userInitial}</button>
            <div id="user-dropdown" class="user-dropdown hidden">
                <div class="dropdown-header">
                    <div class="dropdown-user-name">${escapeHTML(user.name || "User")}</div>
                    <div class="dropdown-user-email">${escapeHTML(user.email || "")}</div>
                </div>
                <a href="my-channels.html" class="dropdown-item">My Channels</a>
                <a href="create-channel.html" class="dropdown-item">Create Channel</a>
                <a href="upload.html" class="dropdown-item">Upload Video</a>
                <a href="#" id="logout-btn" class="dropdown-item" title="BACKEND REQUIRED: Logout Endpoint">
                    Log Out <span class="badge-backend">Req</span>
                </a>
            </div>
        </div>
    `;

    const avatarBtn = document.getElementById("user-avatar-btn");
    const dropdown = document.getElementById("user-dropdown");
    
    if (avatarBtn && dropdown) {
        avatarBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("hidden");
        });

        document.addEventListener("click", () => {
            dropdown.classList.add("hidden");
        });
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            alert("BACKEND REQUIRED: Log out API endpoint is not provided on the backend.");
        });
    }
}

/**
 * Render Header Login Button when Unauthenticated
 */
function renderLoginButton() {
    const headerAuthSection = document.getElementById("header-auth-section");
    if (!headerAuthSection) return;

    headerAuthSection.innerHTML = `
        <a href="login.html" class="btn btn-outline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Sign In
        </a>
    `;
}

/**
 * Fetch Video Grid Data
 * Uses GET /api/auth/get_videos?page=N[&category=X]
 *
 * The backend now returns videos in fixed-size batches instead of the
 * whole feed at once, along with hasMore telling us whether another
 * batch exists.
 *
 * page 1 replaces the current grid (used on load, retry, whenever the
 * category chip changes, or whenever a filter/search changes upstream).
 * page > 1 (via loadMoreVideos, triggered by scrolling near the bottom -
 * see setupInfiniteScroll) appends to what's already rendered instead of
 * re-downloading it.
 *
 * When activeCategory is anything other than "All", it's sent as
 * ?category=X so the server returns every video in that category
 * instead of the personalized feed (still paginated the same way).
 */
async function fetchVideos(page = 1) {
    if (page === 1) {
        showState("loading");
        showLoadingMoreIndicator(false);
        toggleEndOfFeedMessage(false);
    } else {
        isLoadingMore = true;
        showLoadingMoreIndicator(true);
    }

    try {
        const categoryParam = activeCategory && activeCategory !== "All"
            ? `&category=${encodeURIComponent(activeCategory)}`
            : "";

        const response = await fetch(`${API_BASE_URL}/api/auth/get_videos?page=${page}${categoryParam}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include"
        });

        // Specific 401 Unauthorized Handling
        if (response.status === 401) {
            console.warn("GET /api/auth/get_videos returned 401 Unauthorized. User is not logged in.");
            showState("auth_required");
            return;
        }

        if (!response.ok) {
            throw new Error(`Server returned status code ${response.status}`);
        }

        const data = await response.json();

        let fetchedVideos = [];
        let fetchedPreferredCategories = [];

        if (Array.isArray(data)) {
            fetchedVideos = data;
            fetchedPreferredCategories = [];
            hasMoreVideos = false;
        } else if (data && Array.isArray(data.videos)) {
            fetchedVideos = data.videos;
            fetchedPreferredCategories = Array.isArray(data.preferredCategories) ? data.preferredCategories : [];
            hasMoreVideos = Boolean(data.hasMore);
        } else {
            hasMoreVideos = false;
        }

        // Page 1 replaces the grid; every later page only ADDS to what's
        // already loaded, so a video already on screen is never
        // re-downloaded.
        allVideos = page === 1 ? fetchedVideos : [...allVideos, ...fetchedVideos];
        userCategories = fetchedPreferredCategories;
        currentPage = page;

        applyFiltersAndRender();
        updateLoadMoreButton();
        toggleEndOfFeedMessage(!hasMoreVideos && allVideos.length > 0);

        // If the page we just rendered is short enough that the scroll
        // sentinel is already inside (or close to) the viewport - a
        // small batch, a tall screen, whatever - the IntersectionObserver
        // in setupInfiniteScroll won't fire again on its own, since
        // nothing changed to trigger a fresh intersection event. Check
        // manually and keep loading until the sentinel is safely below
        // the fold or the backend has nothing left to give.
        requestAnimationFrame(maybeLoadMoreIfSentinelVisible);
    } catch (err) {
        console.error("Error fetching videos:", err);
        if (page === 1) {
            showState("error", "Could not connect to the backend server or failed to load videos.");
        }
    } finally {
        isLoadingMore = false;
        showLoadingMoreIndicator(false);
    }
}

/**
 * Load the next page of ranked videos and append them to the grid.
 * Called automatically once the user scrolls near the bottom (see
 * setupInfiniteScroll), and also by the optional #load-more-btn if the
 * page markup includes one. Safe no-op if there's no more content or a
 * load is already in flight.
 */
function loadMoreVideos() {
    if (!hasMoreVideos || isLoadingMore) return;
    fetchVideos(currentPage + 1);
}

/**
 * Wires up automatic infinite scroll: watches an invisible marker near
 * the bottom of the page (#scroll-sentinel) and loads the next batch of
 * videos as soon as it comes near the viewport - this is what makes
 * "scroll to the bottom -> more videos load" work without any click.
 * Safe no-op if the page markup doesn't have a sentinel, or the browser
 * doesn't support IntersectionObserver.
 */
function setupInfiniteScroll() {
    const sentinel = document.getElementById("scroll-sentinel");
    if (!sentinel || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                loadMoreVideos();
            }
        });
    }, {
        root: null,
        // Start loading a bit BEFORE the sentinel actually enters the
        // viewport, so the next batch is already there by the time the
        // user reaches the bottom instead of them seeing a pause.
        rootMargin: "600px 0px",
        threshold: 0
    });

    observer.observe(sentinel);
}

/**
 * Manual fallback for setupInfiniteScroll: if the scroll sentinel is
 * still within reach of the viewport right after a batch finishes
 * rendering, load another batch immediately instead of waiting for a
 * scroll event that may never come (e.g. very few results, or a tall
 * viewport where everything already fits on screen).
 */
function maybeLoadMoreIfSentinelVisible() {
    if (!hasMoreVideos || isLoadingMore) return;

    const sentinel = document.getElementById("scroll-sentinel");
    if (!sentinel) return;

    const rect = sentinel.getBoundingClientRect();
    const isNearViewport = rect.top < window.innerHeight + 600;

    if (isNearViewport) {
        loadMoreVideos();
    }
}

/**
 * Shows/hides the small spinner at the bottom of the grid while the
 * next batch of videos is being fetched. No-op if the markup doesn't
 * have a #loading-more-indicator element.
 */
function showLoadingMoreIndicator(show) {
    const indicator = document.getElementById("loading-more-indicator");
    if (!indicator) return;
    indicator.classList.toggle("hidden", !show);
}

/**
 * Shows/hides the "you're all caught up" message once the backend has
 * no further batch left for the current category/feed. No-op if the
 * markup doesn't have an #end-of-feed-message element.
 */
function toggleEndOfFeedMessage(show) {
    const endMsg = document.getElementById("end-of-feed-message");
    if (!endMsg) return;
    endMsg.classList.toggle("hidden", !show);
}

/**
 * Shows/hides the optional #load-more-btn based on whether the backend
 * says there's another page. No-op if that element isn't in the markup.
 */
function updateLoadMoreButton() {
    const btn = document.getElementById("load-more-btn");
    if (!btn) return;
    btn.classList.toggle("hidden", !hasMoreVideos);
}

/**
 * Filter the currently-loaded videos by search query, then trigger render.
 *
 * Behavior:
 * - Default view ("All" category, no search typed): render exactly what
 *   the backend's ranking algorithm returned for the batches loaded so
 *   far. That ranking already blends the user's preferred categories
 *   with a small fixed slice of "other" categories for discovery (see
 *   OTHER_CATEGORY_COUNT server-side) - we do NOT re-filter down to
 *   preferred-only here, since that would silently throw away the
 *   exploration part of the algorithm's output.
 * - A specific category chip is NOT filtered here anymore: fetchVideos()
 *   sends ?category=X to the server, which returns every video in that
 *   category directly, in batches (see setupEventListeners). Filtering
 *   the client list would only ever show whatever's already loaded, not
 *   the full category.
 * - Typing a search query still filters across whatever's currently
 *   loaded (the active category's videos, or the personalized feed) -
 *   scrolling down to load more batches will widen what a search can
 *   match against.
 */
function applyFiltersAndRender() {
    let filtered = [...allVideos];

    const isDefaultView = activeCategory === "All" && !searchQuery;

    if (searchQuery) {
        filtered = filtered.filter(video =>
            (video.title && video.title.toLowerCase().includes(searchQuery)) ||
            (video.description && video.description.toLowerCase().includes(searchQuery))
        );
    }

    if (filtered.length === 0) {
        let msg;
        if (searchQuery) {
            msg = `No videos match your search query "${escapeHTML(searchQuery)}".`;
        } else if (isDefaultView) {
            msg = `No videos available right now. Try exploring a category above!`;
        } else {
            msg = `No videos found in the "${escapeHTML(activeCategory)}" category.`;
        }
        showState("empty", msg);
    } else {
        renderVideoGrid(filtered);
        showState("grid");
    }
}

/**
 * Render Video Cards into Grid Container
 */
function renderVideoGrid(videos) {
    const videoGrid = document.getElementById("video-grid");
    if (!videoGrid) return;

    videoGrid.innerHTML = videos.map(video => createVideoCardHTML(video)).join("");

    const cards = videoGrid.querySelectorAll(".video-card");
    cards.forEach(card => {
        card.addEventListener("click", () => {
            const videoId = card.getAttribute("data-video-id");
            if (videoId) {
                window.location.href = `watch.html?id=${encodeURIComponent(videoId)}`;
            }
        });
    });
}

/**
 * Generate HTML String for a single Video Card
 */
function createVideoCardHTML(video) {
    const videoId = video._id || video.id || "";
    const title = escapeHTML(video.title || "Untitled Video");
    const thumbnail = video.thumbnailUrl || "https://via.placeholder.com/640x360?text=No+Thumbnail";
    const viewsFormatted = formatViews(video.views);
    const timeFormatted = formatRelativeTime(video.createdAt);
    const channelName = "Channel"; 

    return `
        <article class="video-card" data-video-id="${escapeHTML(videoId)}">
            <div class="thumbnail-container">
                <img src="${escapeHTML(thumbnail)}" alt="${title}" class="thumbnail-img" loading="lazy" onerror="this.src='https://via.placeholder.com/640x360?text=Image+Error';">
                <span class="duration-badge" title="BACKEND REQUIRED: Video Duration">--:--</span>
            </div>
            <div class="video-details">
                <div class="channel-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>
                <div class="video-info">
                    <h3 class="video-title" title="${title}">${title}</h3>
                    <div class="channel-name" title="BACKEND REQUIRED: Channel name resolution endpoint">${escapeHTML(channelName)}</div>
                    <div class="video-meta">
                        <span>${viewsFormatted}</span> • <span>${timeFormatted}</span>
                    </div>
                </div>
            </div>
        </article>
    `;
}

/**
 * State display manager
 */
function showState(state, message = "") {
    const skeletonContainer = document.getElementById("skeleton-container");
    const emptyState = document.getElementById("empty-state");
    const errorState = document.getElementById("error-state");
    const authRequiredState = document.getElementById("auth-required-state");
    const videoGrid = document.getElementById("video-grid");

    skeletonContainer?.classList.add("hidden");
    emptyState?.classList.add("hidden");
    errorState?.classList.add("hidden");
    authRequiredState?.classList.add("hidden");
    videoGrid?.classList.add("hidden");

    if (state === "loading") {
        skeletonContainer?.classList.remove("hidden");
    } else if (state === "auth_required") {
        authRequiredState?.classList.remove("hidden");
    } else if (state === "empty") {
        if (emptyState) {
            const msgEl = document.getElementById("empty-message");
            if (msgEl && message) msgEl.textContent = message;
            emptyState.classList.remove("hidden");
        }
    } else if (state === "error") {
        if (errorState) {
            const msgEl = document.getElementById("error-message");
            if (msgEl && message) msgEl.textContent = message;
            errorState.classList.remove("hidden");
        }
    } else if (state === "grid") {
        videoGrid?.classList.remove("hidden");
    }
}

/**
 * Utility: Format view count
 */
function formatViews(views) {
    const num = Number(views) || 0;
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M views";
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K views";
    }
    return `${num} view${num === 1 ? "" : "s"}`;
}

/**
 * Utility: Format ISO Date into relative time ago
 */
function formatRelativeTime(dateString) {
    if (!dateString) return "Recently";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Recently";

    const seconds = Math.floor((new Date() - date) / 1000);

    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `${interval} year${interval === 1 ? "" : "s"} ago`;

    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval} month${interval === 1 ? "" : "s"} ago`;

    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval} day${interval === 1 ? "" : "s"} ago`;

    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval} hour${interval === 1 ? "" : "s"} ago`;

    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval} minute${interval === 1 ? "" : "s"} ago`;

    return "Just now";
}

/**
 * Utility: Escape HTML
 */
function escapeHTML(str) {
    if (typeof str !== "string") return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
