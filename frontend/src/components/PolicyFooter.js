// src/components/PolicyFooter.jsx
import React from 'react';
import PolicyLinks from './PolicyLinks';

/**
 * 회사 정보가 포함된 간단한 푸터.
 * 필요에 따라 텍스트만 바꿔서 사용하세요.
 */
export default function PolicyFooter() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="footer-inner" aria-label="회사 및 법적 고지">
        <div className="footer-left">
          <p className="footer-brand">
            <strong>보라파트너스</strong> <span className="divider" aria-hidden="true">|</span> 대표: 이원준
          </p>
          <address className="footer-address">
            대전광역시 서구 문정로 48번길 30, 13층
          </address>
          <p className="footer-contact">
            이메일: <a href="mailto:aivle0721@gmail.com">aivle0721@gmail.com</a>
          </p>
        </div>

        {/* 여기 한 줄로 이용약관/개인정보처리방침 + PDFModal */}
        <nav className="footer-nav" aria-label="정책 링크">
          <PolicyLinks layout="stack" />
        </nav>
      </div>

      <div className="footer-bottom">
        <small>© 2025 보라파트너스 All rights reserved.</small>
      </div>
    </footer>
  );
}
