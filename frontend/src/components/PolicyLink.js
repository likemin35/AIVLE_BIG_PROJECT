// src/components/PolicyLinks.jsx
import React, { useState } from 'react';
import PDFModal from './PDFModal';

// SignUp.js에서 쓰던 URL 그대로 사용
const TERMS_URL =
  'https://firebasestorage.googleapis.com/v0/b/aivle-team0721.firebasestorage.app/o/%E1%84%87%E1%85%A9%E1%84%85%E1%85%A1%E1%84%80%E1%85%A8%E1%84%8B%E1%85%A3%E1%86%A8%20%E1%84%89%E1%85%A5%E1%84%87%E1%85%B5%E1%84%89%E1%85%B3%20%E1%84%8B%E1%85%B5%E1%84%8B%E1%85%AD%E1%86%BC%E1%84%8B%E1%85%A3%E1%86%A8%E1%84%80%E1%85%AA%E1%86%AB.pdf?alt=media&token=0c1285a4-9d0d-4e3d-8027-fad7384ea164';

const PRIVACY_URL =
  'https://firebasestorage.googleapis.com/v0/b/aivle-team0721.firebasestorage.app/o/%E1%84%87%E1%85%A9%E1%84%85%E1%85%A1%E1%84%80%E1%85%A8%E1%84%8B%E1%85%A3%E1%86%A8_%E1%84%80%E1%85%A2%E1%84%8B%E1%85%B5%E1%86%AB%E1%84%8C%E1%85%A5%E1%86%BC%E1%84%87%E1%85%A9%E1%84%8E%E1%85%A5%E1%84%85%E1%85%B5%E1%84%87%E1%85%A1%E1%86%BC%E1%84%8E%E1%85%B5%E1%86%B7.pdf?alt=media&token=c0fe6d4c-f754-429d-ba6a-ebfa693430dd'
    
/**
 * 어디서든 간단히 넣을 수 있는 정책 링크 + PDFModal 컴포넌트
 *
 * props:
 * - layout: 'inline' | 'stack'  (기본: 'inline')
 * - containerClassName: 래퍼 className
 * - linkClassName: a 태그 className
 * - divider: 레이아웃이 inline일 때 사이 구분자 문자열 (기본: ' | ')
 * - labels: { terms?: string, privacy?: string } 커스텀 라벨
 */
export default function PolicyLinks({
  layout = 'inline',
  containerClassName = '',
  linkClassName = '',
  divider = ' | ',
  labels = {},
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState('');
  const [modalTitle, setModalTitle] = useState('');

  const openModal = (title, url) => {
    setModalTitle(title);
    setModalUrl(url);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setModalUrl('');
    setModalTitle('');
  };

  const termsLabel = labels.terms || '이용약관';
  const privacyLabel = labels.privacy || '개인정보처리방침';

  return (
    <>
      <div
        className={containerClassName}
        style={{
          display: 'flex',
          flexDirection: layout === 'stack' ? 'column' : 'row',
          gap: layout === 'stack' ? '8px' : undefined,
          alignItems: layout === 'stack' ? 'flex-start' : 'center',
        }}
      >
        <a
          href="#"
          className={linkClassName}
          onClick={(e) => {
            e.preventDefault();
            openModal(termsLabel, TERMS_URL);
          }}
        >
          {termsLabel}
        </a>

        {layout === 'inline' && <span style={{ opacity: 0.6 }}>{divider}</span>}

        <a
          href="#"
          className={linkClassName}
          onClick={(e) => {
            e.preventDefault();
            openModal(privacyLabel, PRIVACY_URL);
          }}
        >
          {privacyLabel}
        </a>
      </div>

      <PDFModal open={modalOpen} onClose={closeModal} pdfUrl={modalUrl} title={modalTitle} />
    </>
  );
}
