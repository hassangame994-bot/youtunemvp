/**
 * StreamPulse - Video Watch Page Script
 * Subscribes via POST /api/auth/subscribe
 * Persists in localStorage (sp_subscribed_channels)
 */

const API_BASE_URL = "https://youtubemvp-production.up.railway.app";
const STORAGE_LIKED_KEY = "sp_liked_videos";
const STORAGE_VIEWED_KEY = "sp_viewed_videos";
const STORAGE_SUBSCRIBED_KEY = "sp_subscribed_channels";

let currentUser = null;
let currentVideoId = "";
let currentVideo = null;
let allVideos = [];
let viewRegisteredForVideoId = "";

document.addEventListener("DOMContentLoaded", async () => {
  parseVideoIdFromURL();
  setupEventListeners();

  await checkAuthentication();
  await loadVideoData();
});

function parseVideoIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  currentVideoId = urlParams.get("id") || "";
}

/**
 * =========================================================================
 * SUBSCRIPTIONS (localStorage & API)
 * =========================================================================
 */
function getSubscribedChannels() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_SUBSCRIBED_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function isChannelSubscribed(channelId) {
  if (!channelId) return false;
  return getSubscribedChannels().includes(String(channelId));
}

function saveSubscribedChannel(channelId) {
  if (!channelId) return;
  const list = getSubscribedChannels();
  if (!list.includes(String(channelId))) {
    list.push(String(channelId));
    localStorage.setItem(STORAGE_SUBSCRIBED_KEY, JSON.stringify(list));
  }
}

function updateSubscribeButtonUI(isSubscribed) {
  const subscribeBtn = document.getElementById("subscribe-btn");
  const subscribeText =
    document.getElementById("subscribe-text") ||
    subscribeBtn?.querySelector("span");

  if (!subscribeBtn) return;

  if (isSubscribed) {
    subscribeBtn.classList.add("subscribed");
    subscribeBtn.setAttribute("title", "Subscribed");
    if (subscribeText) subscribeText.textContent = "Subscribed";
  } else {
    subscribeBtn.classList.remove("subscribed");
    subscribeBtn.setAttribute("title", "Subscribe");
    if (subscribeText) subscribeText.textContent = "Subscribe";
  }
}

async function handleSubscribeClick() {
  const channelId =
    currentVideo?.channelId || currentVideo?.channel_id || currentVideo?.userId;

  if (!channelId) {
    showToast("Channel information is not available for this video.");
    return;
  }

  if (isChannelSubscribed(channelId)) {
    showToast("You are already subscribed to this channel!");
    return;
  }

  const subscribeBtn = document.getElementById("subscribe-btn");
  if (subscribeBtn) subscribeBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        channel_id: String(channelId),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      saveSubscribedChannel(channelId);
      updateSubscribeButtonUI(true);

      const subCountEl = document.getElementById("channel-sub-count");
      if (subCountEl && data.subscribe !== undefined) {
        subCountEl.textContent = formatSubscribers(data.subscribe);
      }

      showToast(data.message || "Subscribed successfully!");
    } else {
      if (response.status === 401) {
        showToast("Please sign in to subscribe.");
      } else if (
        response.status === 400 &&
        data.message?.includes("own channel")
      ) {
        showToast("You cannot subscribe to your own channel.");
      } else {
        showToast(data.message || "Failed to subscribe.");
      }
    }
  } catch (error) {
    console.error("Subscribe network error:", error);
    showToast("Network error. Could not subscribe.");
  } finally {
    if (subscribeBtn) subscribeBtn.disabled = false;
  }
}

function formatSubscribers(count) {
  const num = Number(count) || 0;
  if (num >= 1000000)
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M subscribers";
  if (num >= 1000)
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K subscribers";
  return `${num} subscriber${num === 1 ? "" : "s"}`;
}

/**
 * =========================================================================
 * LIKES & VIEWS HANDLERS
 * =========================================================================
 */
function getLikedVideos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_LIKED_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function isVideoLiked(videoId) {
  if (!videoId) return false;
  return getLikedVideos().includes(String(videoId));
}

function saveLikedVideo(videoId) {
  if (!videoId) return;
  const likedList = getLikedVideos();
  if (!likedList.includes(String(videoId))) {
    likedList.push(String(videoId));
    localStorage.setItem(STORAGE_LIKED_KEY, JSON.stringify(likedList));
  }
}

function getViewedVideos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_VIEWED_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function isVideoViewed(videoId) {
  if (!videoId) return false;
  return getViewedVideos().includes(String(videoId));
}

function saveViewedVideo(videoId) {
  if (!videoId) return;
  const viewedList = getViewedVideos();
  if (!viewedList.includes(String(videoId))) {
    viewedList.push(String(videoId));
    localStorage.setItem(STORAGE_VIEWED_KEY, JSON.stringify(viewedList));
  }
}

function updateLikeButtonUI(isLiked) {
  const likeBtn = document.getElementById("like-btn");
  const likeIcon =
    document.getElementById("like-icon") || likeBtn?.querySelector("svg");
  const likeText =
    document.getElementById("like-text") || likeBtn?.querySelector("span");

  if (!likeBtn) return;

  if (isLiked) {
    likeBtn.classList.add("liked");
    likeBtn.setAttribute("title", "Liked");
    if (likeText) likeText.textContent = "Liked";
    if (likeIcon) likeIcon.setAttribute("fill", "currentColor");
  } else {
    likeBtn.classList.remove("liked");
    likeBtn.setAttribute("title", "Like Video");
    if (likeText) likeText.textContent = "Like";
    if (likeIcon) likeIcon.setAttribute("fill", "none");
  }
}

async function handleLikeClick() {
  const validVideoId = currentVideo?._id || currentVideo?.id || currentVideoId;

  if (!validVideoId) {
    showToast("Error: Video ID not found.");
    return;
  }

  if (isVideoLiked(validVideoId)) {
    showToast("You have already liked this video!");
    return;
  }

  const likeBtn = document.getElementById("like-btn");
  if (likeBtn) likeBtn.disabled = true;

  try {
    const videoCategory = currentVideo?.category || "General";
    const response = await fetch(`${API_BASE_URL}/api/auth/likes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        video_id: String(validVideoId),
        category: String(videoCategory),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      saveLikedVideo(validVideoId);
      updateLikeButtonUI(true);
      showToast(data.message || "Added like successfully!");
    } else {
      showToast(data.message || "Failed to like video.");
    }
  } catch (error) {
    showToast("Network error. Could not like video.");
  } finally {
    if (likeBtn) likeBtn.disabled = false;
  }
}

async function registerVideoView() {
  const validVideoId = currentVideo?._id || currentVideo?.id || currentVideoId;
  if (
    !validVideoId ||
    String(viewRegisteredForVideoId) === String(validVideoId) ||
    isVideoViewed(validVideoId)
  ) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        video_id: String(validVideoId),
        category: String(currentVideo?.category || "General"),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      viewRegisteredForVideoId = String(validVideoId);
      saveViewedVideo(validVideoId);

      const viewsEl = document.getElementById("video-views");
      if (viewsEl && data.views !== undefined) {
        viewsEl.textContent = formatViews(data.views);
      }
    }
  } catch (error) {
    console.error("View API error:", error);
  }
}

/**
 * =========================================================================
 * MEDIA HELPERS
 * =========================================================================
 */
function getFullUrl(rawUrl) {
  if (!rawUrl) return "";
  let cleanUrl = String(rawUrl).replace(/\\/g, "/");
  if (
    cleanUrl.startsWith("http://") ||
    cleanUrl.startsWith("https://") ||
    cleanUrl.startsWith("blob:") ||
    cleanUrl.startsWith("data:")
  ) {
    return cleanUrl;
  }
  const prefix = cleanUrl.startsWith("/") ? "" : "/";
  return `${API_BASE_URL}${prefix}${cleanUrl}`;
}

function getVideoSourceUrl(video) {
  if (!video) return "";
  if (typeof video === "string") return video;
  return video.videoUrl || video.video_url || video.url || "";
}

function getThumbnailUrl(video) {
  if (!video) return "";
  return video.thumbnailUrl || video.thumbnail_url || video.poster || "";
}

function getYouTubeEmbedUrl(url) {
  if (!url || typeof url !== "string") return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}?rel=0&autoplay=1`;
  }
  return null;
}

/**
 * =========================================================================
 * SETUP LISTENERS & AUTH
 * =========================================================================
 */
function setupEventListeners() {
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

  document.getElementById("search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = document.getElementById("search-input")?.value.trim();
    if (query)
      window.location.href = `search.html?q=${encodeURIComponent(query)}`;
  });

  document
    .getElementById("subscribe-btn")
    ?.addEventListener("click", handleSubscribeClick);
  document
    .getElementById("like-btn")
    ?.addEventListener("click", handleLikeClick);
  document
    .getElementById("share-btn")
    ?.addEventListener("click", copyShareLink);
  document
    .getElementById("retry-btn")
    ?.addEventListener("click", loadVideoData);
}

async function checkAuthentication() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.authenticated && data.user) {
        currentUser = data.user;
        renderUserMenu(data.user);
        return;
      }
    }
    renderLoginButton();
  } catch (error) {
    renderLoginButton();
  }
}

/**
 * =========================================================================
 * LOAD & RENDER VIDEO
 * =========================================================================
 */
async function loadVideoData() {
  if (!currentVideoId) {
    showState("not_found");
    return;
  }

  showState("loading");

  try {
    // 1. Fetch the exact video using GET /api/auth/get_videos/:id
    let videoResponse = await fetch(
      `${API_BASE_URL}/api/auth/get_videos/${encodeURIComponent(currentVideoId)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      },
    );

    if (videoResponse.status === 401) {
      showState("auth_required");
      return;
    }

    if (videoResponse.ok) {
      const videoData = await videoResponse.json();
      currentVideo = videoData?.video || null;
    }

    // 2. Fetch general feed for recommendations or as fallback
    try {
      const feedResponse = await fetch(
        `${API_BASE_URL}/api/auth/get_videos?limit=50`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );
      if (feedResponse.ok) {
        const feedData = await feedResponse.json();
        allVideos = Array.isArray(feedData.videos)
          ? feedData.videos
          : Array.isArray(feedData)
            ? feedData
            : [];

        // Fallback: If single video endpoint didn't find it, find it in the feed list
        if (!currentVideo && allVideos.length > 0) {
          currentVideo =
            allVideos.find(
              (v) => String(v._id || v.id) === String(currentVideoId),
            ) || null;
        }
      }
    } catch (e) {
      allVideos = [];
    }

    if (!currentVideo) {
      showState("not_found");
      return;
    }

    renderVideoPlayer(currentVideo);
    renderRecommendedVideos(allVideos, currentVideoId);
    await registerVideoView();

    showState("loaded");
  } catch (error) {
    console.error("Error loading video:", error);
    showState("error", "Unable to load video data from the server.");
  }
}

function renderVideoPlayer(video) {
  const playerWrapper = document.querySelector(".player-wrapper");
  const titleEl = document.getElementById("video-title");
  const viewsEl = document.getElementById("video-views");
  const dateEl = document.getElementById("video-date");
  const catEl = document.getElementById("video-category-badge");
  const descEl = document.getElementById("video-description");
  const channelEl = document.getElementById("channel-name");
  const channelLinkEl = document.getElementById("channel-link");
  const channelNameLinkEl = document.getElementById("channel-name-link");

  const rawVideoUrl = getVideoSourceUrl(video);
  const rawPosterUrl = getThumbnailUrl(video);
  const fullVideoUrl = getFullUrl(rawVideoUrl);
  const fullPosterUrl = getFullUrl(rawPosterUrl);
  const youtubeEmbedUrl = getYouTubeEmbedUrl(fullVideoUrl || rawVideoUrl);

  if (playerWrapper) {
    if (youtubeEmbedUrl) {
      playerWrapper.innerHTML = `
                <iframe
                    id="youtube-player"
                    src="${youtubeEmbedUrl}"
                    title="${escapeHTML(video.title || "YouTube Video")}"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    style="width: 100%; aspect-ratio: 16/9; border: none; border-radius: 12px;"
                ></iframe>
            `;
    } else {
      playerWrapper.innerHTML = `
                <video
                    id="video-player"
                    class="video-player"
                    controls
                    preload="metadata"
                    ${fullPosterUrl ? `poster="${escapeHTML(fullPosterUrl)}"` : ""}
                >
                    ${fullVideoUrl ? `<source id="video-source" src="${escapeHTML(fullVideoUrl)}">` : ""}
                    Your browser does not support HTML5 video playback.
                </video>
            `;
    }
  }

  if (titleEl) titleEl.textContent = video.title || "Untitled Video";
  if (viewsEl) viewsEl.textContent = formatViews(video.views);
  if (dateEl) dateEl.textContent = formatRelativeTime(video.createdAt);
  if (catEl) catEl.textContent = video.category || "General";
  if (descEl)
    descEl.textContent = video.description || "No description provided.";

  const channelName =
    video.channelName || video.uploaderName || video.channel_name || "Channel";
  if (channelEl) channelEl.textContent = channelName;

  // Link channel avatar & title to channel page
  const channelId = video.channelId || video.channel_id || video.userId;
  if (channelId) {
    const channelHref = `channel.html?id=${encodeURIComponent(channelId)}`;
    if (channelLinkEl) channelLinkEl.href = channelHref;
    if (channelNameLinkEl) channelNameLinkEl.href = channelHref;

    // Check if subscribed
    updateSubscribeButtonUI(isChannelSubscribed(channelId));
  }

  updateLikeButtonUI(isVideoLiked(currentVideoId));
  document.title = `${video.title || "Watch Video"} - Youtube`;
}

function renderRecommendedVideos(videos, activeId) {
  const recGrid = document.getElementById("recommended-grid");
  if (!recGrid) return;

  const recommendations = videos.filter(
    (video) => String(video._id || video.id) !== String(activeId),
  );

  if (recommendations.length === 0) {
    recGrid.innerHTML = `<p style="font-size:13px; color:var(--text-secondary);">No other recommended videos available.</p>`;
    return;
  }

  recGrid.innerHTML = recommendations
    .map((video) => {
      const vId = video._id || video.id || "";
      const title = escapeHTML(video.title || "Untitled Video");
      const thumb =
        getFullUrl(getThumbnailUrl(video)) ||
        "https://via.placeholder.com/320x180?text=No+Thumbnail";
      const views = formatViews(video.views);
      const channel = escapeHTML(
        video.channelName || video.uploaderName || "Channel",
      );

      return `
            <article class="rec-card" data-video-id="${escapeHTML(vId)}">
                <div class="rec-thumb-container">
                    <img src="${escapeHTML(thumb)}" alt="${title}" class="rec-thumb-img" loading="lazy">
                </div>
                <div class="rec-details">
                    <h3 class="rec-title" title="${title}">${title}</h3>
                    <div class="rec-meta">${channel}</div>
                    <div class="rec-meta">${views}</div>
                </div>
            </article>
        `;
    })
    .join("");

  recGrid.querySelectorAll(".rec-card").forEach((card) => {
    card.addEventListener("click", () => {
      const vId = card.getAttribute("data-video-id");
      if (vId)
        window.location.href = `watch.html?id=${encodeURIComponent(vId)}`;
    });
  });
}

function copyShareLink() {
  navigator.clipboard
    .writeText(window.location.href)
    .then(() => showToast("Link copied to clipboard!"))
    .catch(() => showToast("Failed to copy link."));
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

function showState(state, message = "") {
  const skeleton = document.getElementById("watch-skeleton");
  const container = document.getElementById("watch-container");
  const authState = document.getElementById("auth-required-state");
  const notFoundState = document.getElementById("not-found-state");
  const errorState = document.getElementById("error-state");

  skeleton?.classList.add("hidden");
  container?.classList.add("hidden");
  authState?.classList.add("hidden");
  notFoundState?.classList.add("hidden");
  errorState?.classList.add("hidden");

  if (state === "loading") skeleton?.classList.remove("hidden");
  else if (state === "loaded") container?.classList.remove("hidden");
  else if (state === "auth_required") authState?.classList.remove("hidden");
  else if (state === "not_found") notFoundState?.classList.remove("hidden");
  else if (state === "error") {
    if (errorState) {
      const msgEl = document.getElementById("error-message");
      if (msgEl && message) msgEl.textContent = message;
      errorState.classList.remove("hidden");
    }
  }
}

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
    document.addEventListener("click", () => dropdown.classList.add("hidden"));
  }
}

function formatViews(views) {
  const num = Number(views) || 0;
  if (num >= 1000000)
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M views";
  if (num >= 1000)
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K views";
  return `${num} view${num === 1 ? "" : "s"}`;
}

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
  if (interval >= 1)
    return `${interval} minute${interval === 1 ? "" : "s"} ago`;
  return "Just now";
}

function escapeHTML(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
