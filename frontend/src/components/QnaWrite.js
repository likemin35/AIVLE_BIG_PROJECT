import React, { useState, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { createQuestion, uploadImage } from '../api/qna';
import './QnaWrite.css'; // QnaEdit와 동일한 CSS 사용
import PolicyLinks from './PolicyLink';
const QnaWrite = () => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null); // 이미지 미리보기 URL 상태
    const [isUploading, setIsUploading] = useState(false);
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const { user } = useOutletContext();

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('이미지 파일(jpg, png 등)만 업로드할 수 있습니다.');
                e.target.value = null;
                return;
            }
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file)); // 미리보기 URL 생성
        }
    };

    const handleFileCancel = () => {
        setImageFile(null);
        setPreviewUrl(null); // 미리보기 URL 제거
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            alert('질문을 작성하려면 로그인이 필요합니다.');
            return;
        }
        if (!title || !content) {
            alert('제목과 내용을 모두 입력해주세요.');
            return;
        }

        setIsUploading(true);
        let imageUrl = null;

        try {
            if (imageFile) {
                const uploadResponse = await uploadImage(imageFile);
                imageUrl = uploadResponse.imageUrl;
            }

            const questionData = { title, content, imageUrl };
            await createQuestion(questionData);
            
            alert('질문이 성공적으로 등록되었습니다.');
            navigate('/qna');

        } catch (error) {
            alert('질문 등록에 실패했습니다.');
            console.error(error);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="qna-write-container">
            <h1>질문 작성</h1>
            <form onSubmit={handleSubmit} className="qna-write-form">
                <div className="form-group">
                    <label htmlFor="title">제목</label>
                    <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="form-group">
                    <label htmlFor="content">내용</label>
                    <textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} rows="10"></textarea>
                </div>
                <div className="form-group">
                    <label>이미지 첨부 (선택)</label>
                    {previewUrl && (
                        <div className="image-preview">
                            <img src={previewUrl} alt="미리보기" />
                            <button type="button" onClick={handleFileCancel} className="file-cancel-btn" title="이미지 삭제">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                    <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                                </svg>
                            </button>
                        </div>
                    )}
                    <div className="file-upload-wrapper">
                        <button type="button" className="file-select-btn" onClick={() => fileInputRef.current.click()}>
                            {previewUrl ? '파일 변경' : '파일 선택'}
                        </button>
                        <span className="file-name-display">
                            {imageFile ? imageFile.name : '선택된 파일 없음'}
                        </span>
                    </div>
                    <input
                        type="file"
                        onChange={handleFileChange}
                        accept="image/png, image/jpeg"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                    />
                </div>
                <div className="form-actions">
                    <button type="button" onClick={() => navigate('/qna')} disabled={isUploading}>취소</button>
                    <button type="submit" disabled={isUploading}>
                        {isUploading ? '처리 중...' : '등록'}
                    </button>
                </div>
            </form>
  <div className="policy-links">
    <PolicyLinks />
  </div>
</div>
);
};

export default QnaWrite;