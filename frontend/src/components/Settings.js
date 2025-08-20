// /src/components/Settings.js
import React, { useEffect, useState, useRef } from 'react';
import { getSavedPreference, applyTheme, subscribeSystemThemeChange } from '../utils/theme';
import PolicyLinks from './PolicyLink';

const preferenceToLabel = {
  light: '끄기(라이트)',
  dark: '켜기(다크)',
  system: '시스템',
};

export default function Settings() {
  const [pref, setPref] = useState(getSavedPreference());
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    // 시스템 선택 시 OS 변경을 따라가도록 구독
    if (pref === 'system') {
      unsubscribeRef.current = subscribeSystemThemeChange((effective) => {
        document.documentElement.setAttribute('data-theme', effective);
      });
    }
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [pref]);

  const handleClick = (nextPref) => {
    setPref(nextPref);
    applyTheme(nextPref);
    // 시스템 모드가 아니라면 시스템 변경 구독 해제
    if (unsubscribeRef.current && nextPref !== 'system') {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  };

  // 버튼 공통 스타일(간단하게 인라인. 필요 시 별도 CSS로 분리 가능)
  const baseBtn = {
    padding: '0.6rem 1rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--card)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background 0.2s, color 0.2s, border-color 0.2s, transform 0.08s',
  };
  const activeBtn = {
    background: 'var(--primary)',
    border: '1px solid var(--primary-hover)',
    color: '#fff',
    boxShadow: `0 6px 16px rgba(${getComputedStyle(document.documentElement).getPropertyValue('--shadow-rgb') || '108, 92, 231'}, 0.25)`,
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>설정</h1>

      <section
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '1.25rem',
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 12, fontSize: 18 }}>테마</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0, marginBottom: 16, fontSize: 14 }}>
          다크 모드를 켜거나 끄거나, 시스템 설정을 따라가도록 지정할 수 있어요.
        </p>

        <div
          className="theme-toggle-group"
          style={{
            display: 'inline-grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
            background: 'var(--soft)',
            padding: 8,
            borderRadius: 12,
            border: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            aria-pressed={pref === 'light'}
            onClick={() => handleClick('light')}
            style={{ ...baseBtn, ...(pref === 'light' ? activeBtn : {}) }}
          >
            {preferenceToLabel.light}
          </button>
          <button
            type="button"
            aria-pressed={pref === 'dark'}
            onClick={() => handleClick('dark')}
            style={{ ...baseBtn, ...(pref === 'dark' ? activeBtn : {}) }}
          >
            {preferenceToLabel.dark}
          </button>
          <button
            type="button"
            aria-pressed={pref === 'system'}
            onClick={() => handleClick('system')}
            style={{ ...baseBtn, ...(pref === 'system' ? activeBtn : {}) }}
          >
            {preferenceToLabel.system}
          </button>
        </div>

      </section>
  <div className="policy-links">
    <PolicyLinks />
  </div>
</div>
);
}