/**
 * UI Component Scale Control System
 * 
 * Each constant below controls a specific element.
 * For button scale values, changes affect: min-height, min-width, padding, and font-size.
 * For text/form/spacing values, changes affect matching typography, inputs, and layout gaps.
 * 
 * Input Scale Range (always):
 *   0   = minimum
 *   50  = medium
 *   100 = maximum
 *
 * Internal max ranges can be configured per control in SCALE_INTERNAL_MAX.
 * Example: if max is 200, input 100 maps to internal 200.
 * 
 * IMPORTANT: Each button and container is independently adjustable.
 * Change any value below and reload the page to see the effect.
 */

const INPUT_SCALE_MIN = 0;
const INPUT_SCALE_MAX = 100;

// ============================================================================
// BUTTON STYLES
// ============================================================================
// Landing Page Buttons
const BTN_TEXT_LOGIN = 50;         // "Login" button size
const BTN_TEXT_SIGN_UP = 30;       // "Sign Up" button size

// Login Page Buttons
const BTN_TEXT_FORGOT_PASSWORD = 100; // "Forgot password?" link text size

// Sign Up Page Buttons
const BTN_TEXT_SUBMIT = 50;        // "Submit" button size
const BTN_TEXT_ALREADY_HAVE_AN_ACCOUNT = 50; // "Already have an account?" link text size

// Forgot Password Page Buttons
const BTN_TEXT_SEND_OTP = 70;      // "Send OTP" button size
const BTN_TEXT_BACK_TO_LOGIN = 10; // "Back to Login" link text size

// OTP Verification Page Buttons
const BTN_TEXT_VERIFY = 50;        // "Verify" button size
const BTN_TEXT_RESEND_CODE = 50;   // "Resend Code" button size

// Reset Password Page Buttons
const BTN_TEXT_SAVE_PASSWORD = 50; // "Save Password" button size

// Success Page Buttons
const BTN_TEXT_BACK_HOME = 50;     // "Back Home" button size

// ============================================================================
// CONTAINERS & LAYOUT
// ============================================================================

const CONTAINER_LANDING_SHEET = 100;    // Landing page: sheet/card overall scale
const CONTAINER_FORM = 50;             // Auth pages: form card overall scale
const CONTAINER_OTP_INPUT = 100;        // OTP input wrapper scale
const CONTAINER_OFFSET_Y = 50;         // Auth pages: move whole container vertically in px (-up, +down)
const LANDING_SHEET_OFFSET_Y = 50;     // Landing page: move sheet block vertically in px (-up, +down)

// ============================================================================
// TEXT & TYPOGRAPHY
// ============================================================================

const TEXT_HEADING_MAIN = 50;      // Main heading text size (h1)
const TEXT_HEADING_SUB = 50;       // Subheading text size (h2)
const TEXT_BODY = 50;              // Paragraph/body text size
const TEXT_LABEL = 50;             // Form label text size
const TEXT_SMALL = 50;             // Helper/small text size
const TEXT_INPUT = 50;             // Input typed text size

// ============================================================================
// FORM ELEMENTS
// ============================================================================

const FORM_INPUT = 50;             // Input field box scale (height/padding/font)
const FORM_INPUT_OTP = 50;         // OTP input box scale
const FORM_TEXTAREA = 50;          // Textarea box scale

// ============================================================================
// SPACING & LAYOUT
// ============================================================================

const SPACING_UNIT = 40;           // Global spacing scale (padding, gap, margin)

// ============================================================================
// BLOCK STRETCH (WIDTH)
// ============================================================================
// 0 = narrowest, 50 = default, 100 = widest
const SIZE_BLOCKS_OVERALL = 70;    // Master control: all major blocks overall size
const SIZE_BLOCK_LOGIN = 50;       // Login page card overall size
const SIZE_BLOCK_SIGNUP = 50;      // Signup page card overall size
const SIZE_BLOCK_FORGOT = 50;      // Forgot page card overall size
const SIZE_BLOCK_OTP = 50;         // OTP page card overall size
const SIZE_BLOCK_RESET = 50;       // Reset page card overall size
const SIZE_BLOCK_SUCCESS = 50;     // Success page card overall size
const SIZE_BLOCK_LANDING_SHEET = 100; // Landing top block overall size
const SIZE_BLOCK_CONTACT = 50;     // Landing contact block overall size
const STRETCH_FORM_CARD = 50;      // Auth card width stretch
const STRETCH_LANDING_SHEET = 10;  // Landing sheet width stretch
const STRETCH_CONTACT_BLOCK = 0;   // Contact block width stretch
const STRETCH_ACTION_SLOTS = 50;   // Generic actions slot width stretch

// ============================================================================
// BLOCK POSITION (LEFT/RIGHT)
// ============================================================================
// 0 = far left, 50 = centered/default, 100 = far right
const POS_X_FORM_CARD = 50;        // Auth pages form/card block x-position
const POS_X_LANDING_SHEET = 50;    // Landing page top block x-position
const POS_X_CONTACT_BLOCK = 2;     // Landing page bottom block x-position

// ============================================================================
// BLOCK POSITION (UP/DOWN)
// ============================================================================
// 0 = top edge, 50 = centered/default, 100 = bottom edge
const POS_Y_FORM_CARD = 50;        // Auth pages form/card block y-position
const POS_Y_LANDING_SHEET = 40;    // Landing page top block y-position
const POS_Y_CONTACT_BLOCK = 95;    // Landing page bottom block y-position

// ============================================================================
// BUTTON HORIZONTAL POSITION (LEFT/RIGHT)
// ============================================================================
// 0 = far left, 50 = centered/default, 100 = far right
const POS_X_LOGIN = 35;                      // "Login" button x-position
const POS_X_SIGN_UP = 50;                    // "Sign Up" button x-position
const POS_X_FORGOT_PASSWORD = 50;            // "Forgot password?" control x-position
const POS_X_SUBMIT = 50;                     // "Submit" button x-position
const POS_X_ALREADY_HAVE_AN_ACCOUNT = 50;    // "Already have an account?" control x-position
const POS_X_SEND_OTP = 50;                   // "Send OTP" button x-position
const POS_X_BACK_TO_LOGIN = 50;              // "Back to Login" control x-position
const POS_X_VERIFY = 50;                     // "Verify" button x-position
const POS_X_RESEND_CODE = 50;                // "Resend Code" button x-position
const POS_X_SAVE_PASSWORD = 50;              // "Save Password" button x-position
const POS_X_GO_TO_LOGIN = 50;                // "Go to Login" button x-position
const POS_X_BACK_HOME = 50;                  // "Back Home" button x-position

// ============================================================================
// INTERNAL MAX RANGE MAPPING
// ============================================================================
// Keep these at 100 to preserve current behavior.
// Set any value to 200 (or another number) when you want input 100 => that max.
const SCALE_INTERNAL_MAX = {
  btnLandingLogin: 100,
  btnLandingSignup: 100,
  btnLoginSubmit: 100,
  btnLoginForgot: 100,
  btnSignupSubmit: 100,
  btnSignupLoginLink: 100,
  btnForgotSubmit: 100,
  btnForgotBack: 100,
  btnOtpVerify: 100,
  btnOtpResend: 100,
  btnResetSubmit: 100,
  btnSuccessHome: 100,
  containerLandingSheet: 100,
  containerForm: 100,
  containerOtpInput: 100,
  textHeadingMain: 100,
  textHeadingSub: 100,
  textBody: 100,
  textLabel: 100,
  textSmall: 100,
  textInput: 100,
  formInput: 100,
  formInputOtp: 100,
  formTextarea: 100,
  spacingUnit: 100,
};

// Maximum absolute horizontal travel in px when input is 0 or 100.
const POSITION_X_MAX_PX = {
  btnLandingLogin: 180,
  btnLandingSignup: 180,
  btnLoginSubmit: 120,
  btnLoginForgot: 120,
  btnSignupSubmit: 120,
  btnSignupLoginLink: 120,
  btnForgotSubmit: 120,
  btnForgotBack: 120,
  btnOtpVerify: 120,
  btnOtpResend: 120,
  btnResetSubmit: 120,
  btnSuccessLogin: 120,
  btnSuccessHome: 120,
};

const BLOCK_POSITION_X_MAX_PX = {
  formCard: 140,
  landingSheet: 180,
  contactBlock: 180,
};

function clampInputScale(value) {
  return Math.min(Math.max(value, INPUT_SCALE_MIN), INPUT_SCALE_MAX);
}

function scaleInputToFactor(inputValue, internalMax = 100) {
  const safeInput = clampInputScale(inputValue);
  const safeInternalMax = Math.max(0, internalMax);
  const internalValue = (safeInput / INPUT_SCALE_MAX) * safeInternalMax;
  return internalValue / 100;
}

function positionInputToPx(inputValue, maxAbsPx) {
  const safeInput = clampInputScale(inputValue);
  const safeMaxAbsPx = Math.max(0, maxAbsPx);
  const normalized = (safeInput - 50) / 50;
  return Math.round(normalized * safeMaxAbsPx);
}

function stretchInputToFactor(inputValue, minFactor = 0.7, maxFactor = 1.3) {
  const safeInput = clampInputScale(inputValue);
  const progress = safeInput / INPUT_SCALE_MAX;
  return minFactor + progress * (maxFactor - minFactor);
}

function getViewportNormalized() {
  const width = window.innerWidth || document.documentElement.clientWidth || 1024;
  const minWidth = 360;
  const maxWidth = 1440;
  const clampedWidth = Math.min(Math.max(width, minWidth), maxWidth);
  return (clampedWidth - minWidth) / (maxWidth - minWidth);
}

function getResponsiveSizeMultiplier() {
  // Keep controls readable on small screens while preserving full scale on desktop.
  const t = getViewportNormalized();
  return 0.82 + (0.18 * t);
}

function getResponsivePositionMultiplier() {
  // Reduce travel distance on smaller viewports to avoid overflow pressure.
  const t = getViewportNormalized();
  return 0.55 + (0.45 * t);
}

function getResponsiveStretchRange() {
  // Allow much smaller minimum block sizes while staying responsive.
  const t = getViewportNormalized();
  return {
    minFactor: 0.56 - (0.16 * t),
    maxFactor: 1.12 + (0.18 * t),
  };
}

function getOverallBlockSizeFactor() {
  const { minFactor, maxFactor } = getResponsiveStretchRange();
  return stretchInputToFactor(SIZE_BLOCKS_OVERALL, minFactor, maxFactor);
}

// ============================================================================
// Generate Scale Mapping
// ============================================================================

function createScales() {
  const sizeMultiplier = getResponsiveSizeMultiplier();
  const overallBlockSize = getOverallBlockSizeFactor();

  return {
    // Buttons - Landing
    btnLandingLogin: scaleInputToFactor(BTN_TEXT_LOGIN, SCALE_INTERNAL_MAX.btnLandingLogin) * sizeMultiplier,
    btnLandingSignup: scaleInputToFactor(BTN_TEXT_SIGN_UP, SCALE_INTERNAL_MAX.btnLandingSignup) * sizeMultiplier,

    // Buttons - Login
    btnLoginSubmit: scaleInputToFactor(BTN_TEXT_LOGIN, SCALE_INTERNAL_MAX.btnLoginSubmit) * sizeMultiplier,
    btnLoginForgot: scaleInputToFactor(BTN_TEXT_FORGOT_PASSWORD, SCALE_INTERNAL_MAX.btnLoginForgot) * sizeMultiplier,

    // Buttons - Sign Up
    btnSignupSubmit: scaleInputToFactor(BTN_TEXT_SUBMIT, SCALE_INTERNAL_MAX.btnSignupSubmit) * sizeMultiplier,
    btnSignupLoginLink: scaleInputToFactor(BTN_TEXT_ALREADY_HAVE_AN_ACCOUNT, SCALE_INTERNAL_MAX.btnSignupLoginLink) * sizeMultiplier,

    // Buttons - Forgot Password
    btnForgotSubmit: scaleInputToFactor(BTN_TEXT_SEND_OTP, SCALE_INTERNAL_MAX.btnForgotSubmit) * sizeMultiplier,
    btnForgotBack: scaleInputToFactor(BTN_TEXT_BACK_TO_LOGIN, SCALE_INTERNAL_MAX.btnForgotBack) * sizeMultiplier,

    // Buttons - OTP
    btnOtpVerify: scaleInputToFactor(BTN_TEXT_VERIFY, SCALE_INTERNAL_MAX.btnOtpVerify) * sizeMultiplier,
    btnOtpResend: scaleInputToFactor(BTN_TEXT_RESEND_CODE, SCALE_INTERNAL_MAX.btnOtpResend) * sizeMultiplier,

    // Buttons - Reset
    btnResetSubmit: scaleInputToFactor(BTN_TEXT_SAVE_PASSWORD, SCALE_INTERNAL_MAX.btnResetSubmit) * sizeMultiplier,

    // Buttons - Success
    btnSuccessHome: scaleInputToFactor(BTN_TEXT_BACK_HOME, SCALE_INTERNAL_MAX.btnSuccessHome) * sizeMultiplier,

    // Containers
    containerLandingSheet: scaleInputToFactor(CONTAINER_LANDING_SHEET, SCALE_INTERNAL_MAX.containerLandingSheet),
    containerForm: scaleInputToFactor(CONTAINER_FORM, SCALE_INTERNAL_MAX.containerForm) * overallBlockSize,
    containerOtpInput: scaleInputToFactor(CONTAINER_OTP_INPUT, SCALE_INTERNAL_MAX.containerOtpInput),

    // Text
    textHeadingMain: scaleInputToFactor(TEXT_HEADING_MAIN, SCALE_INTERNAL_MAX.textHeadingMain) * sizeMultiplier,
    textHeadingSub: scaleInputToFactor(TEXT_HEADING_SUB, SCALE_INTERNAL_MAX.textHeadingSub) * sizeMultiplier,
    textBody: scaleInputToFactor(TEXT_BODY, SCALE_INTERNAL_MAX.textBody) * sizeMultiplier,
    textLabel: scaleInputToFactor(TEXT_LABEL, SCALE_INTERNAL_MAX.textLabel) * sizeMultiplier,
    textSmall: scaleInputToFactor(TEXT_SMALL, SCALE_INTERNAL_MAX.textSmall) * sizeMultiplier,
    textInput: scaleInputToFactor(TEXT_INPUT, SCALE_INTERNAL_MAX.textInput) * sizeMultiplier,

    // Form
    formInput: scaleInputToFactor(FORM_INPUT, SCALE_INTERNAL_MAX.formInput) * sizeMultiplier,
    formInputOtp: scaleInputToFactor(FORM_INPUT_OTP, SCALE_INTERNAL_MAX.formInputOtp) * sizeMultiplier,
    formTextarea: scaleInputToFactor(FORM_TEXTAREA, SCALE_INTERNAL_MAX.formTextarea) * sizeMultiplier,

    // Spacing
    spacingUnit: scaleInputToFactor(SPACING_UNIT, SCALE_INTERNAL_MAX.spacingUnit) * sizeMultiplier,

    // Legacy aliases - for backwards compatibility with existing CSS
    primaryButton: scaleInputToFactor(BTN_TEXT_LOGIN, SCALE_INTERNAL_MAX.btnLoginSubmit) * sizeMultiplier,
    secondaryButton: scaleInputToFactor(BTN_TEXT_SIGN_UP, SCALE_INTERNAL_MAX.btnLandingSignup) * sizeMultiplier,
    formLabel: scaleInputToFactor(TEXT_LABEL, SCALE_INTERNAL_MAX.textLabel) * sizeMultiplier,
    container: scaleInputToFactor(CONTAINER_FORM, SCALE_INTERNAL_MAX.containerForm) * overallBlockSize,
    heading: scaleInputToFactor(TEXT_HEADING_MAIN, SCALE_INTERNAL_MAX.textHeadingMain) * sizeMultiplier,
    text: scaleInputToFactor(TEXT_BODY, SCALE_INTERNAL_MAX.textBody) * sizeMultiplier,
    spacing: scaleInputToFactor(SPACING_UNIT, SCALE_INTERNAL_MAX.spacingUnit) * sizeMultiplier,
    otpInput: scaleInputToFactor(FORM_INPUT_OTP, SCALE_INTERNAL_MAX.formInputOtp) * sizeMultiplier,
    smallText: scaleInputToFactor(TEXT_SMALL, SCALE_INTERNAL_MAX.textSmall) * sizeMultiplier,
  };
}

function createHorizontalOffsets() {
  const positionMultiplier = getResponsivePositionMultiplier();

  return {
    // Landing
    btnLandingLogin: positionInputToPx(POS_X_LOGIN, POSITION_X_MAX_PX.btnLandingLogin * positionMultiplier),
    btnLandingSignup: positionInputToPx(POS_X_SIGN_UP, POSITION_X_MAX_PX.btnLandingSignup * positionMultiplier),

    // Login
    btnLoginSubmit: positionInputToPx(POS_X_LOGIN, POSITION_X_MAX_PX.btnLoginSubmit * positionMultiplier),
    btnLoginForgot: positionInputToPx(POS_X_FORGOT_PASSWORD, POSITION_X_MAX_PX.btnLoginForgot * positionMultiplier),

    // Sign Up
    btnSignupSubmit: positionInputToPx(POS_X_SUBMIT, POSITION_X_MAX_PX.btnSignupSubmit * positionMultiplier),
    btnSignupLoginLink: positionInputToPx(POS_X_ALREADY_HAVE_AN_ACCOUNT, POSITION_X_MAX_PX.btnSignupLoginLink * positionMultiplier),

    // Forgot Password
    btnForgotSubmit: positionInputToPx(POS_X_SEND_OTP, POSITION_X_MAX_PX.btnForgotSubmit * positionMultiplier),
    btnForgotBack: positionInputToPx(POS_X_BACK_TO_LOGIN, POSITION_X_MAX_PX.btnForgotBack * positionMultiplier),

    // OTP
    btnOtpVerify: positionInputToPx(POS_X_VERIFY, POSITION_X_MAX_PX.btnOtpVerify * positionMultiplier),
    btnOtpResend: positionInputToPx(POS_X_RESEND_CODE, POSITION_X_MAX_PX.btnOtpResend * positionMultiplier),

    // Reset
    btnResetSubmit: positionInputToPx(POS_X_SAVE_PASSWORD, POSITION_X_MAX_PX.btnResetSubmit * positionMultiplier),

    // Success
    btnSuccessLogin: positionInputToPx(POS_X_GO_TO_LOGIN, POSITION_X_MAX_PX.btnSuccessLogin * positionMultiplier),
    btnSuccessHome: positionInputToPx(POS_X_BACK_HOME, POSITION_X_MAX_PX.btnSuccessHome * positionMultiplier),
  };
}

function createBlockStretch() {
  const { minFactor, maxFactor } = getResponsiveStretchRange();
  const overallBlockSize = getOverallBlockSizeFactor();

  return {
    formCard: stretchInputToFactor(STRETCH_FORM_CARD, minFactor, maxFactor) * overallBlockSize,
    landingSheet: stretchInputToFactor(STRETCH_LANDING_SHEET, minFactor, maxFactor),
    contactBlock: stretchInputToFactor(STRETCH_CONTACT_BLOCK, minFactor, maxFactor),
    actionSlots: stretchInputToFactor(STRETCH_ACTION_SLOTS, minFactor, maxFactor),
  };
}

function createIndividualBlockSizes() {
  const { minFactor, maxFactor } = getResponsiveStretchRange();
  const overallBlockSize = getOverallBlockSizeFactor();

  return {
    login: stretchInputToFactor(SIZE_BLOCK_LOGIN, minFactor, maxFactor) * overallBlockSize,
    signup: stretchInputToFactor(SIZE_BLOCK_SIGNUP, minFactor, maxFactor) * overallBlockSize,
    forgot: stretchInputToFactor(SIZE_BLOCK_FORGOT, minFactor, maxFactor) * overallBlockSize,
    otp: stretchInputToFactor(SIZE_BLOCK_OTP, minFactor, maxFactor) * overallBlockSize,
    reset: stretchInputToFactor(SIZE_BLOCK_RESET, minFactor, maxFactor) * overallBlockSize,
    success: stretchInputToFactor(SIZE_BLOCK_SUCCESS, minFactor, maxFactor) * overallBlockSize,
    landingSheet: stretchInputToFactor(SIZE_BLOCK_LANDING_SHEET, minFactor, maxFactor),
    contact: stretchInputToFactor(SIZE_BLOCK_CONTACT, minFactor, maxFactor),
  };
}

function setRootScaleVariables(prefix, values) {
  Object.entries(values).forEach(([name, value]) => {
    document.documentElement.style.setProperty(`${prefix}-${name}`, value);
  });
}

function applyHorizontalButtonOffsets(horizontalOffsets) {
  const bindings = [
    // Landing
    {
      targetSelector: 'body[data-page="landing"] #go-login',
      cssVariable: '--offset-x-btnLandingLogin',
      key: 'btnLandingLogin',
    },
    {
      targetSelector: 'body[data-page="landing"] #go-signup',
      cssVariable: '--offset-x-btnLandingSignup',
      key: 'btnLandingSignup',
    },

    // Login
    {
      targetSelector: 'body[data-page="login"] button[type="submit"]',
      cssVariable: '--offset-x-btnLoginSubmit',
      key: 'btnLoginSubmit',
    },

    // Sign Up
    {
      targetSelector: 'body[data-page="signup"] button[type="submit"]',
      cssVariable: '--offset-x-btnSignupSubmit',
      key: 'btnSignupSubmit',
    },

    // Forgot Password
    {
      targetSelector: 'body[data-page="forgot"] button[type="submit"]',
      cssVariable: '--offset-x-btnForgotSubmit',
      key: 'btnForgotSubmit',
    },

    // OTP
    {
      targetSelector: 'body[data-page="otp"] #resend-btn',
      cssVariable: '--offset-x-btnOtpResend',
      key: 'btnOtpResend',
    },
    {
      targetSelector: 'body[data-page="otp"] form button[type="submit"]',
      cssVariable: '--offset-x-btnOtpVerify',
      key: 'btnOtpVerify',
    },

    // Reset
    {
      targetSelector: 'body[data-page="reset"] button[type="submit"]',
      cssVariable: '--offset-x-btnResetSubmit',
      key: 'btnResetSubmit',
    },

    // Success
    {
      targetSelector: 'body[data-page="success"] .actions .solid',
      cssVariable: '--offset-x-btnSuccessLogin',
      key: 'btnSuccessLogin',
    },
    {
      targetSelector: 'body[data-page="success"] .actions .line',
      cssVariable: '--offset-x-btnSuccessHome',
      key: 'btnSuccessHome',
    },
  ];

  bindings.forEach(({ targetSelector, cssVariable, key }) => {
    applyBoundedHorizontalOffset({
      targetSelector,
      cssVariable,
      requestedOffset: horizontalOffsets[key],
    });
  });
}

function applyBlockPositionOffsets() {
  const horizontalBindings = [
    {
      targetSelector: 'body.poster-page .card',
      cssVariable: '--offset-x-formCard',
      inputValue: POS_X_FORM_CARD,
    },
    {
      targetSelector: '.sheet',
      cssVariable: '--offset-x-landingSheet',
      inputValue: POS_X_LANDING_SHEET,
    },
    {
      targetSelector: '.contact-standalone',
      cssVariable: '--offset-x-contactBlock',
      inputValue: POS_X_CONTACT_BLOCK,
    },
  ];

  const verticalBindings = [
    {
      targetSelector: 'body.poster-page .card',
      cssVariable: '--auth-card-offset-y',
      inputValue: POS_Y_FORM_CARD,
    },
    {
      targetSelector: '.sheet',
      cssVariable: '--landing-sheet-offset-y',
      inputValue: POS_Y_LANDING_SHEET,
    },
    {
      targetSelector: '.contact-standalone',
      cssVariable: '--offset-y-contactBlock',
      inputValue: POS_Y_CONTACT_BLOCK,
    },
  ];

  horizontalBindings.forEach((binding) => {
    applyEdgeAlignedHorizontalOffset(binding);
  });

  verticalBindings.forEach((binding) => {
    applyEdgeAlignedVerticalOffset(binding);
  });
}

function initializeScale() {
  const scales = createScales();
  const horizontalOffsets = createHorizontalOffsets();
  const blockStretch = createBlockStretch();
  const individualBlockSizes = createIndividualBlockSizes();

  setRootScaleVariables('--scale', scales);
  applyHorizontalButtonOffsets(horizontalOffsets);
  setRootScaleVariables('--stretch', blockStretch);
  setRootScaleVariables('--block-size', individualBlockSizes);
  applyBlockPositionOffsets();

  // Kept for compatibility with older CSS hooks.
  document.documentElement.style.setProperty('--container-offset-y', `${CONTAINER_OFFSET_Y}px`);

  console.log('✓ UI scales initialized');
}

function applyBoundedVerticalOffset({ targetSelector, cssVariable, requestedOffset }) {
  const target = document.querySelector(targetSelector);
  if (!target) {
    return;
  }

  const root = document.documentElement;
  root.style.setProperty(cssVariable, '0px');

  const baseRect = target.getBoundingClientRect();
  let minOffset = -baseRect.top;
  let maxOffset = window.innerHeight - baseRect.bottom;

  // Prevent overlap with sibling blocks in the same parent.
  const siblings = target.parentElement ? Array.from(target.parentElement.children) : [];
  siblings
    .filter((element) => element !== target)
    .forEach((element) => {
      const siblingRect = element.getBoundingClientRect();

      if (siblingRect.top >= baseRect.bottom) {
        maxOffset = Math.min(maxOffset, siblingRect.top - baseRect.bottom);
      }

      if (siblingRect.bottom <= baseRect.top) {
        minOffset = Math.max(minOffset, siblingRect.bottom - baseRect.top);
      }
    });

  const safeOffset = Math.min(Math.max(requestedOffset, minOffset), maxOffset);
  root.style.setProperty(cssVariable, `${safeOffset}px`);

  if (safeOffset !== requestedOffset) {
    showOffsetError(
      `${targetSelector} requested ${requestedOffset}px but max safe range is ${Math.round(minOffset)}px to ${Math.round(maxOffset)}px. Move other blocks or reduce the offset.`
    );
  }
}

function applyBoundedHorizontalOffset({ targetSelector, cssVariable, requestedOffset }) {
  const target = document.querySelector(targetSelector);
  if (!target) {
    return;
  }

  const bounds = target.closest('.actions, form, .link-row, .card, .sheet');
  if (!bounds) {
    document.documentElement.style.setProperty(cssVariable, `${requestedOffset}px`);
    return;
  }

  const root = document.documentElement;
  root.style.setProperty(cssVariable, '0px');

  const targetRect = target.getBoundingClientRect();
  const boundsRect = bounds.getBoundingClientRect();
  const minOffset = boundsRect.left - targetRect.left;
  const maxOffset = boundsRect.right - targetRect.right;
  const safeOffset = Math.min(Math.max(requestedOffset, minOffset), maxOffset);

  root.style.setProperty(cssVariable, `${safeOffset}px`);

  if (safeOffset !== requestedOffset) {
    showOffsetError(
      `${targetSelector} requested ${requestedOffset}px on X but safe range is ${Math.round(minOffset)}px to ${Math.round(maxOffset)}px.`
    );
  }
}

function applyEdgeAlignedVerticalOffset({ targetSelector, cssVariable, inputValue }) {
  const target = document.querySelector(targetSelector);
  if (!target) {
    return;
  }

  const root = document.documentElement;
  root.style.setProperty(cssVariable, '0px');

  const targetRect = target.getBoundingClientRect();
  const minOffset = -targetRect.top;
  const maxOffset = window.innerHeight - targetRect.bottom;
  const safeInput = clampInputScale(inputValue);
  const progress = safeInput / INPUT_SCALE_MAX;
  const offset = minOffset + ((maxOffset - minOffset) * progress);

  root.style.setProperty(cssVariable, `${Math.round(offset)}px`);
}

function applyEdgeAlignedHorizontalOffset({ targetSelector, cssVariable, inputValue }) {
  const target = document.querySelector(targetSelector);
  if (!target) {
    return;
  }

  const root = document.documentElement;
  root.style.setProperty(cssVariable, '0px');

  const targetRect = target.getBoundingClientRect();
  const minOffset = -targetRect.left;
  const maxOffset = window.innerWidth - targetRect.right;
  const safeInput = clampInputScale(inputValue);
  const progress = safeInput / INPUT_SCALE_MAX;
  const offset = minOffset + ((maxOffset - minOffset) * progress);

  root.style.setProperty(cssVariable, `${Math.round(offset)}px`);
}

function showOffsetError(message) {
  console.error(`Offset limit reached: ${message}`);

  let banner = document.getElementById('scale-offset-error');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'scale-offset-error';
    banner.style.position = 'fixed';
    banner.style.top = '12px';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.background = '#b42318';
    banner.style.color = '#fff';
    banner.style.border = '2px solid #202020';
    banner.style.padding = '8px 12px';
    banner.style.fontSize = '12px';
    banner.style.fontFamily = 'Georgia, serif';
    banner.style.zIndex = '9999';
    banner.style.maxWidth = '92vw';
    banner.style.lineHeight = '1.3';
    banner.style.boxShadow = '4px 4px 0 rgba(0,0,0,0.25)';
    document.body.appendChild(banner);
  }

  banner.textContent = `Offset limit reached: ${message}`;
}

document.documentElement.classList.add('preload-no-motion');

function releaseInitialMotionLock() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.documentElement.classList.remove('preload-no-motion');
    });
  });
}

// Run initialization
document.addEventListener('DOMContentLoaded', () => {
  initializeScale();
  releaseInitialMotionLock();
});
window.addEventListener('resize', initializeScale);

// Also run immediately in case DOM is already loaded
if (document.readyState !== 'loading') {
  initializeScale();
  releaseInitialMotionLock();
}
