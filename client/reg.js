const firebaseEnabled = Boolean(window.APP_CONFIG?.ENABLE_FIREBASE_LIVE_PROVIDER);

(async () => {
  if (!firebaseEnabled) {
    window.LiveAuthProvider = { enabled: false };
    return;
  }

  const [{ initializeApp, getApps, getApp }, authModule] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js')
  ]);

  const {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    applyActionCode,
    confirmPasswordReset,
    verifyPasswordResetCode,
    updateProfile,
    signOut,
    reload
  } = authModule;

  const firebaseConfig = {
    apiKey: 'AIzaSyBXrQcdi2fDVBVudp-Fi20K_Ss5dOkFrJ8',
    authDomain: 'com-app-81bf4.firebaseapp.com',
    projectId: 'com-app-81bf4',
    storageBucket: 'com-app-81bf4.firebasestorage.app',
    messagingSenderId: '888738362963',
    appId: '1:888738362963:web:a32c9399145f0690a238a6'
  };

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const showDevOtp = Boolean(window.APP_CONFIG?.SHOW_DEV_OTP);

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^\S+@\S+\.\S+$/.test(String(email || ''));
  }

  function isStrongPassword(password) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(String(password || ''));
  }

  function asError(message, status = 400, code = '') {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
  }

  function pageUrl(fileName) {
    const url = new URL(fileName, window.location.href);
    if (url.hostname === '127.0.0.1') {
      url.hostname = 'localhost';
    }
    return url.toString();
  }

  function actionCodeSettings(targetPage) {
    return {
      url: pageUrl(targetPage),
      handleCodeInApp: true
    };
  }

  function currentUserPayload(user) {
    return {
      uid: user.uid,
      username: user.displayName || '',
      email: user.email || '',
      authMethod: 'firebase'
    };
  }

  async function register(payload) {
    const email = normalizeEmail(payload?.email);
    const username = String(payload?.username || '').trim();
    const password = String(payload?.password || '');
    const confirmPassword = String(payload?.confirmPassword || '');

    if (username.length < 3) {
      throw asError('Username must be at least 3 characters.', 400, 'auth/invalid-username');
    }
    if (!isValidEmail(email)) {
      throw asError('Enter a valid email.', 400, 'auth/invalid-email');
    }
    if (!isStrongPassword(password)) {
      throw asError('Password must include upper, lower, number, symbol and be 8+ chars.', 400, 'auth/weak-password');
    }
    if (password !== confirmPassword) {
      throw asError('Passwords do not match.', 400, 'auth/password-mismatch');
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: username });
    await reload(credential.user);
    await sendEmailVerification(credential.user, actionCodeSettings('./otp.html'));

    return {
      message: showDevOtp
        ? 'Verification email sent. Check your inbox.'
        : 'Verification email sent. Check your inbox to complete signup.',
      user: currentUserPayload(credential.user)
    };
  }

  async function verifyEmailLink(payload) {
    const oobCode = String(payload?.oobCode || '').trim();
    const resend = Boolean(payload?.resend);
    const user = auth.currentUser;

    if (resend) {
      if (!user) {
        throw asError('Sign in first to resend the verification email.', 401, 'auth/no-current-user');
      }
      await sendEmailVerification(user, actionCodeSettings('./otp.html'));
      return { message: 'Verification email sent again.' };
    }

    if (!oobCode) {
      throw asError('Missing verification code.', 400, 'auth/missing-action-code');
    }

    await applyActionCode(auth, oobCode);

    if (auth.currentUser) {
      await reload(auth.currentUser);
    }

    return { message: 'Email verified successfully.' };
  }

  async function login(payload) {
    const email = normalizeEmail(payload?.email);
    const password = String(payload?.password || '');

    if (!isValidEmail(email)) {
      throw asError('Enter a valid email.', 400, 'auth/invalid-email');
    }
    if (!password) {
      throw asError('Enter your password.', 400, 'auth/missing-password');
    }

    const credential = await signInWithEmailAndPassword(auth, email, password);
    await reload(credential.user);

    if (!credential.user.emailVerified) {
      try {
        await credential.user.getIdToken(true);
        await reload(credential.user);
      } catch {
        // Ignore refresh failures.
      }

      if (!credential.user.emailVerified) {
        let message = 'Please verify your email before logging in.';

        try {
          await sendEmailVerification(credential.user, actionCodeSettings('./otp.html'));
          message = 'Please verify your email before logging in. We sent a new verification link.';
        } catch {
          message = 'Please verify your email before logging in. We could not resend the verification link right now.';
        }

        await signOut(auth);
        throw asError(message, 403, 'auth/email-not-verified');
      }
    }

    const token = await credential.user.getIdToken();

    return {
      token,
      user: currentUserPayload(credential.user)
    };
  }

  async function forgotPassword(payload) {
    const email = normalizeEmail(payload?.email);

    if (!isValidEmail(email)) {
      throw asError('Enter a valid email.', 400, 'auth/invalid-email');
    }

    try {
      await sendPasswordResetEmail(auth, email, actionCodeSettings('./reset-password.html'));
    } catch (error) {
      const code = String(error?.code || '').toLowerCase();
      if (!code.includes('auth/user-not-found')) {
        throw asError('Password reset request failed.', Number(error?.status) || 400, error?.code || 'auth/reset-failed');
      }
    }

    return {
      message: 'If this email exists, a password reset link has been sent.'
    };
  }

  async function resetPassword(payload) {
    const oobCode = String(payload?.oobCode || '').trim();
    const password = String(payload?.password || '');
    const confirmPassword = String(payload?.confirmPassword || '');

    if (!oobCode) {
      throw asError('Missing reset code.', 400, 'auth/missing-action-code');
    }
    if (!isStrongPassword(password)) {
      throw asError('Password must include upper, lower, number, symbol and be 8+ chars.', 400, 'auth/weak-password');
    }
    if (password !== confirmPassword) {
      throw asError('Passwords do not match.', 400, 'auth/password-mismatch');
    }

    await confirmPasswordReset(auth, oobCode, password);
    return { message: 'Password reset successful.' };
  }

  async function verifyResetCode(payload) {
    const oobCode = String(payload?.oobCode || '').trim();
    if (!oobCode) {
      throw asError('Missing reset code.', 400, 'auth/missing-action-code');
    }
    const email = await verifyPasswordResetCode(auth, oobCode);
    return { message: 'Reset code verified.', email };
  }

  window.LiveAuthProvider = {
    enabled: true,
    async post(path, payload = {}) {
      if (path === '/register') return register(payload);
      if (path === '/verify-otp') return verifyEmailLink(payload);
      if (path === '/login') return login(payload);
      if (path === '/forgot-password') return forgotPassword(payload);
      if (path === '/reset-password') return resetPassword(payload);
      if (path === '/verify-reset-code') return verifyResetCode(payload);

      throw asError('Not found', 404, 'auth/not-found');
    },
    async health() {
      return {
        ok: true,
        storage: 'firebase-auth',
        authMode: 'email-password'
      };
    },
    getAuth() {
      return auth;
    },
    getCurrentUser() {
      return auth.currentUser;
    }
  };

  window.LiveFirebaseAuth = auth;
})();
