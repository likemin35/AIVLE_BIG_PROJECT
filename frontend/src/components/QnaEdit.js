import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { getQuestionById, updateQuestion, uploadImage } from '../api/qna';
import './QnaWrite.css'; // 작성과 동일한 스타일 사용
import PolicyLinks from './PolicyLink';
const QnaEdit = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useOutletContext();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [existingImageUrl, setExistingImageUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const fetchQuestionData = async () => {
            try {
                const question = await getQuestionById(id);
                // 본인 글이 아니면 qna 목록으로 리디렉션
                if (user && user.uid !== question.authorId) {
                    alert('수정 권한이 없습니다.');
                    navigate('/qna');
                    return;
                }
                setTitle(question.title);
                setContent(question.content);
                setExistingImageUrl(question.imageUrl);
            } catch (error) {
                alert('게시글 정보를 불러오는 데 실패했습니다.');
                navigate('/qna');
            } finally {
                setIsLoading(false);
            }
        };

        if (user) { // user 정보가 로드된 후 실행
            fetchQuestionData();
        }
    }, [id, user, navigate]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('이미지 파일만 업로드할 수 있습니다.');
                e.target.value = null;
                return;
            }
            setImageFile(file);
            setExistingImageUrl(URL.createObjectURL(file)); // 새 이미지 미리보기
        }
    };

    const handleImageRemove = () => {
        setImageFile(null);
        setExistingImageUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !content) {
            alert('제목과 내용을 모두 입력해주세요.');
            return;
        }

        setIsSubmitting(true);
        let finalImageUrl = existingImageUrl;

        try {
            // 1. 새 이미지 파일이 선택된 경우 업로드
            if (imageFile) {
                const uploadResponse = await uploadImage(imageFile);
                finalImageUrl = uploadResponse.imageUrl;
            }
            
            // 2. 질문 수정 API 호출
            await updateQuestion(id, { title, content, imageUrl: finalImageUrl });
            
            alert('게시글이 성공적으로 수정되었습니다.');
            navigate(`/qna/${id}`); // 수정된 게시글 상세 페이지로 이동

        } catch (error) {
            alert('게시글 수정에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="loading-spinner"></div>;
    }

    return (
        <div className="qna-write-container">
            <h1>게시글 수정</h1>
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
                    <label>이미지 첨부</label>
                    {existingImageUrl && (
                        <div className="image-preview">
                            <img src={existingImageUrl} alt="미리보기" style={{ maxWidth: '200px', marginBottom: '10px' }} />
                            <button type="button" onClick={handleImageRemove} className="file-cancel-btn" title="이미지 삭제">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                    <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                                </svg>
                            </button>
                        </div>
                    )}
                    <div className="file-upload-wrapper">
                        <button type="button" className="file-select-btn" onClick={() => fileInputRef.current.click()}>
                            파일 변경
                        </button>
                        <span className="file-name-display">
                            {imageFile ? imageFile.name : '새 파일 선택 안 함'}
                        </span>
                    </div>
                    <input type="file" onChange={handleFileChange} accept="image/png, image/jpeg" style={{ display: 'none' }} ref={fileInputRef} />
                </div>
                <div className="form-actions">
                    <button type="button" onClick={() => navigate(`/qna/${id}`)} disabled={isSubmitting}>취소</button>
                    <button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? '수정 중...' : '저장'}
                    </button>
                </div>
            </form>
  <div className="policy-links">
    <PolicyLinks />
  </div>
</div>
);
};

export default QnaEdit;