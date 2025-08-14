// /src/utils/theme.js
const THEME_KEY = 'theme-preference'; // 'light' | 'dark' | 'system'

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getSavedPreference() {
  const saved = localStorage.getItem(THEME_KEY);
  return saved || 'system';
}

export function applyTheme(preference) {
  const root = document.documentElement;
  const effective = preference === 'system' ? getSystemTheme() : preference;

  // data-theme에 실제 적용 테마(light|dark)
  root.setAttribute('data-theme', effective);
  // 어떤 모드로 선택했는지 표시 (디버그/스타일 분기에 유용)
  root.setAttribute('data-theme-pref', preference);

  // 저장
  localStorage.setItem(THEME_KEY, preference);
}

export function subscribeSystemThemeChange(onChange) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = () => onChange(getSystemTheme());
  // 일부 브라우저는 addEventListener 지원
  if (mq.addEventListener) {
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  } else {
    // 구형 브라우저
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }
}

/** 앱 최초 진입 시 1회 호출용 */
export function initTheme() {
  const pref = getSavedPreference();
  applyTheme(pref);
  // 시스템 모드일 땐 시스템 변경도 반영
  if (pref === 'system') {
    // 초기 반영 이후에도 시스템 변경을 따라가기 위해 구독 유지
    subscribeSystemThemeChange(() => {
      // preference는 'system' 그대로 두고, 실제 적용만 갱신
      const effective = getSystemTheme();
      document.documentElement.setAttribute('data-theme', effective);
    });
  }
}

export { THEME_KEY };
