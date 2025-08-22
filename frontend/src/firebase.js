// src/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  // 에뮬레이터 연결은 옵션
  connectAuthEmulator,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import {
  getStorage,
  connectStorageEmulator,
} from 'firebase/storage';

// ---- 환경설정 ----
const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

// 선택적 디버그 로그
const DEBUG_AUTH = String(process.env.REACT_APP_DEBUG_AUTH || '').toLowerCase() === 'true';

// 누락된 키를 경고(배포에선 콘솔만)
(function warnMissingEnv() {
  const required = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_APP_ID',
  ];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length && DEBUG_AUTH) {
    // eslint-disable-next-line no-console
    console.warn('[firebase] missing env:', missing.join(', '));
  }
})();

// ---- 앱 초기화(핫리로드/중복 방지) ----
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ---- 인스턴스 ----
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ---- 퍼시스턴스(LocalStorage) ----
try {
  // setPersistence은 로그인 전에 1회 호출되면 충분
  await setPersistence(auth, browserLocalPersistence);
} catch (_) {
  /* ignore */
}

// ---- (옵션) 에뮬레이터 연결 ----
// .env에 REACT_APP_USE_FIREBASE_EMULATORS=1 일 때만 작동
if (String(process.env.REACT_APP_USE_FIREBASE_EMULATORS || '') === '1') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
    if (DEBUG_AUTH) console.info('[firebase] using emulators');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[firebase] emulator connect failed:', e);
  }
}

// ---- 현재 유저 준비 대기 ----
export function waitForAuthUser(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (DEBUG_AUTH) console.info('[firebase] waitForAuthUser: timeout');
      resolve(auth.currentUser || null);
    }, timeoutMs);

    const unsub = onAuthStateChanged(auth, (u) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      if (DEBUG_AUTH) console.info('[firebase] onAuthStateChanged:', !!u);
      resolve(u || null);
    });
  });
}

// ---- ID 토큰 헬퍼(강제갱신 백오프 포함) ----
export async function getIdToken(forceRefresh = false) {
  const user = await waitForAuthUser();
  if (!user) {
    if (DEBUG_AUTH) console.info('[firebase] getIdToken: no user');
    return '';
  }
  try {
    const t = await user.getIdToken(forceRefresh);
    if (!t && !forceRefresh) {
      // 토큰이 비었으면 강제 갱신 1회 더 시도
      return await user.getIdToken(true);
    }
    return t;
  } catch (err) {
    // 한 번 reload 후 강제 갱신 재시도
    try { await user.reload(); } catch {}
    try { return await user.getIdToken(true); }
    catch (err2) {
      if (DEBUG_AUTH) console.error('[firebase] getIdToken failed:', err, err2);
      return '';
    }
  }
}

// ---- 전역 바인딩(레거시 코드 호환) ----
if (typeof window !== 'undefined') {
  window.getIdToken = () => getIdToken();
  if (DEBUG_AUTH) window.__firebaseAuth = auth;
}

// ---- 기본 내보내기(일부 코드가 default import를 기대하는 경우 대비) ----
export default app;
