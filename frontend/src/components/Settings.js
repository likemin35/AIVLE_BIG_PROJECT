import React from 'react';

const Settings = () => {
  const theme = document.documentElement.getAttribute('data-theme') || 'light';

  const handleToggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>설정</h1>
      <div style={{ marginTop: '1rem' }}>
        <span>다크 모드</span>
        <button
          onClick={handleToggleTheme}
          style={{
            marginLeft: '1rem',
            padding: '0.5rem 1rem',
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          {theme === 'dark' ? '라이트 모드로' : '다크 모드로'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
