/**
 * UI Color Control System
 *
 * Edit only the constants in the CONTROL PANEL sections below.
 * All matching CSS variables are generated and applied automatically.
 */

// ============================================================================
// CONTROL PANEL: CORE SURFACES
// ============================================================================
const COLOR_BG = "#132238"; // Affects poster-page body background (login/signup/forgot/otp/reset/success pages)

// Upload your own image into client/assets and set the path below.
// Example: "assets/my-background.jpg"
const PROJECT_BACKGROUND_IMAGE_PATHS = [
  "assets/landing-bg.jpg",
  "assets/pexels-alex-ning-523843601-34945594.jpg",
  "assets/pexels-jplenio-1146708.jpg",
  "assets/pexels-manoj-sairam-457014637-36588996.jpg",
  "assets/pexels-molnartamasphotography-27593671.jpg",
  "assets/pexels-molnartamasphotography-28101360.jpg",
  "assets/pexels-molnartamasphotography-35248593.jpg",
  "assets/pexels-muhammed-mahsum-tunc-859110584-35389652.jpg",
  "assets/pexels-parimoofarhaan-29625344.jpg",
  "assets/pexels-souvenirpixels-417074.jpg",
  "assets/pexels-tom-kardashov-314272-897233.jpg",
]; // Shared image pool for all page backgrounds

const LANDING_BACKGROUND_IMAGE_PATHS = PROJECT_BACKGROUND_IMAGE_PATHS;
const POSTER_BACKGROUND_IMAGE_PATHS = PROJECT_BACKGROUND_IMAGE_PATHS;

// Set to "none" for full image clarity (no washout layer).
const LANDING_BACKGROUND_OVERLAY = "none";
const POSTER_BACKGROUND_OVERLAY = "linear-gradient(180deg, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.18))";

// Used when no image path is provided.
const LANDING_BACKGROUND_FALLBACK =
  "repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0 1px, transparent 1px 24px), linear-gradient(180deg, #f8f7f2 0%, #f2f0e8 100%)";
const POSTER_BACKGROUND_FALLBACK =
  "repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0 1px, transparent 1px 24px), linear-gradient(180deg, #f8f7f2 0%, #f2f0e8 100%)";

const LANDING_BACKGROUND_STORAGE_KEY = "landing:lastBackground";
const POSTER_BACKGROUND_STORAGE_KEY = "poster:lastBackground";

function getRandomLandingBackgroundImagePath() {
  const imagePaths = LANDING_BACKGROUND_IMAGE_PATHS
    .map((path) => String(path || "").trim())
    .filter(Boolean);

  if (!imagePaths.length) return "";
  if (imagePaths.length === 1) return imagePaths[0];

  let lastPath = "";
  try {
    lastPath = localStorage.getItem(LANDING_BACKGROUND_STORAGE_KEY) || "";
  } catch (_error) {
    lastPath = "";
  }

  const choices = imagePaths.filter((path) => path !== lastPath);
  const pool = choices.length ? choices : imagePaths;
  const selectedPath = pool[Math.floor(Math.random() * pool.length)];

  try {
    localStorage.setItem(LANDING_BACKGROUND_STORAGE_KEY, selectedPath);
  } catch (_error) {
    // Ignore storage errors and keep selected path in memory only.
  }

  return selectedPath;
}

function getRandomPosterBackgroundImagePath() {
  const imagePaths = POSTER_BACKGROUND_IMAGE_PATHS
    .map((path) => String(path || "").trim())
    .filter(Boolean);

  if (!imagePaths.length) return "";
  if (imagePaths.length === 1) return imagePaths[0];

  let lastPath = "";
  try {
    lastPath = localStorage.getItem(POSTER_BACKGROUND_STORAGE_KEY) || "";
  } catch (_error) {
    lastPath = "";
  }

  const choices = imagePaths.filter((path) => path !== lastPath);
  const pool = choices.length ? choices : imagePaths;
  const selectedPath = pool[Math.floor(Math.random() * pool.length)];

  try {
    localStorage.setItem(POSTER_BACKGROUND_STORAGE_KEY, selectedPath);
  } catch (_error) {
    // Ignore storage errors and keep selected path in memory only.
  }

  return selectedPath;
}

function createBackgroundValue(imagePath, overlayValue, fallbackValue) {
  if (!imagePath || !String(imagePath).trim()) {
    return fallbackValue;
  }

  const safePath = String(imagePath).trim();
  if (overlayValue === "none") {
    return `url("${safePath}") center / cover no-repeat fixed`;
  }

  return `${overlayValue}, url("${safePath}") center / cover no-repeat fixed`;
}

function createLandingBackgroundValue(imagePath) {
  if (!imagePath || !String(imagePath).trim()) {
    return LANDING_BACKGROUND_FALLBACK;
  }

  const safePath = String(imagePath).trim();
  if (LANDING_BACKGROUND_OVERLAY === "none") {
    return `url("${safePath}") center / cover no-repeat scroll`;
  }

  return `${LANDING_BACKGROUND_OVERLAY}, url("${safePath}") center / cover no-repeat scroll`;
}

const COLOR_LANDING_BG = createLandingBackgroundValue(getRandomLandingBackgroundImagePath()); // Affects body[data-page="landing"] background
const COLOR_POSTER_BG = createBackgroundValue(
  getRandomPosterBackgroundImagePath(),
  POSTER_BACKGROUND_OVERLAY,
  POSTER_BACKGROUND_FALLBACK
); // Affects body.poster-page background

const COLOR_BG_ACCENT =
  "radial-gradient(circle at 10% 10%, #3471a9 0%, transparent 45%), radial-gradient(circle at 90% 20%, #ffe2d1 0%, transparent 40%), linear-gradient(135deg, #f6fbff 0%, #fff8f3 100%)"; // Affects overall body background on all pages
const COLOR_CARD = "#e47d7d"; // Affects auth cards (.card) on login/signup/forgot/otp/reset/success pages

// ============================================================================
// CONTROL PANEL: TEXT
// ============================================================================
const COLOR_TEXT = "#102238"; // Affects base body text color across all pages
const COLOR_MUTED = "#5b6c80"; // Affects paragraph + helper text (p, .small)

// ============================================================================
// CONTROL PANEL: ACTIONS & STATUS
// ============================================================================
const COLOR_PRIMARY = "#0059b8"; // Affects auth action buttons + links + input focus border (submit buttons on login/signup/forgot/otp/reset)
const COLOR_PRIMARY_HOVER = "#004695"; // Affects hover state for primary auth action buttons
const COLOR_DANGER = "#b42318"; // Affects error messages (.message.error)
const COLOR_SUCCESS = "#087443"; // Affects success messages (.message.success)

// ============================================================================
// CONTROL PANEL: BORDERS & DECORATION
// ============================================================================
const COLOR_BORDER = "#d8e4f2"; // Affects card + input borders on auth pages
const COLOR_PAPER = "#afefec"; // Affects landing page sheet/contact background
const COLOR_INK = "#212121"; // Affects landing page text + line button text
const COLOR_EDGE = "#202020"; // Affects landing/success outlines + solid buttons (Landing Login, Success Go to Login)
const COLOR_ACCENT = "#d39a34"; // Affects landing accent/focus details
const COLOR_SHADOW = "0 20px 40px rgba(16, 34, 56, 0.1)"; // Affects auth card shadow depth

// ============================================================================
// TOKEN MAPPING (Do not edit unless adding new CSS variables)
// ============================================================================
const COLOR_THEME = {
  bg: COLOR_BG,
  "landing-bg": COLOR_LANDING_BG,
  "poster-bg": COLOR_POSTER_BG,
  "bg-accent": COLOR_BG_ACCENT,
  card: COLOR_CARD,
  text: COLOR_TEXT,
  muted: COLOR_MUTED,
  primary: COLOR_PRIMARY,
  "primary-hover": COLOR_PRIMARY_HOVER,
  danger: COLOR_DANGER,
  success: COLOR_SUCCESS,
  border: COLOR_BORDER,
  paper: COLOR_PAPER,
  ink: COLOR_INK,
  edge: COLOR_EDGE,
  accent: COLOR_ACCENT,
  shadow: COLOR_SHADOW,
};

function applyColorTheme(theme) {
  Object.entries(theme).forEach(([token, value]) => {
    document.documentElement.style.setProperty(`--${token}`, value);
  });
}

function initializeColorTheme() {
  applyColorTheme(COLOR_THEME);
  console.log("✓ UI colors initialized");
}

initializeColorTheme();
