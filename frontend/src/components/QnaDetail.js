import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { getQuestionById, deleteQuestion, createAnswer, deleteAnswer, updateAnswer } from '../api/qna';
import './QnaDetail.css';
import PolicyLinks from './PolicyLink';

// 날짜 포맷팅 헬퍼 함수
const formatDateTime = (dateString) => {
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };
    return new Date(dateString).toLocaleString('ko-KR', options);
};

const QnaDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useOutletContext();
    const location = useLocation();
    const [question, setQuestion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newAnswer, setNewAnswer] = useState('');

    // 댓글 수정 관련 state
    const [editingAnswerId, setEditingAnswerId] = useState(null);
    const [editedAnswerContent, setEditedAnswerContent] = useState('');
    const [activeMenuAnswerId, setActiveMenuAnswerId] = useState(null);

    const effectRan = useRef(false);

    const fetchQuestion = async () => {
        try {
            const data = await getQuestionById(id);
            setQuestion(data);
        } catch (err) {
            setError('질문 상세 정보를 불러오는 데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (effectRan.current === false) {
            fetchQuestion();
            return () => { effectRan.current = true; };
        }
    }, [id]);

    // 질문 삭제 핸들러
    const handleQuestionDelete = async () => {
        if (window.confirm('정말로 이 질문을 삭제하시겠습니까?')) {
            try {
                await deleteQuestion(id);
                alert('질문이 삭제되었습니다.');
                navigate('/qna');
            } catch (err) {
                alert('질문 삭제에 실패했습니다.');
            }
        }
    };

    // --- 댓글 핸들러 ---
    const handleAnswerSubmit = async (e) => {
        e.preventDefault();
        if (!newAnswer.trim()) return;
        try {
            await createAnswer(id, { content: newAnswer });
            setNewAnswer('');
            fetchQuestion();
        } catch (err) {
            alert('댓글 등록에 실패했습니다.');
        }
    };

    const handleAnswerDelete = async (answerId) => {
        if (window.confirm('정말로 이 댓글을 삭제하시겠습니까?')) {
            try {
                await deleteAnswer(id, answerId);
                alert('댓글이 삭제되었습니다.');
                fetchQuestion();
            } catch (err) {
                alert('댓글 삭제에 실패했습니다.');
            }
        }
    };

    const handleEditAnswerStart = (answer) => {
        setEditingAnswerId(answer.id);
        setEditedAnswerContent(answer.content);
        setActiveMenuAnswerId(null);
    };

    const handleEditAnswerSave = async () => {
        if (!editedAnswerContent.trim()) {
            alert('댓글 내용을 입력해주세요.');
            return;
        }
        try {
            await updateAnswer(id, editingAnswerId, { content: editedAnswerContent });
            setEditingAnswerId(null);
            setEditedAnswerContent('');
            alert('댓글이 수정되었습니다.');
            fetchQuestion();
        } catch (err) {
            alert('댓글 수정에 실패했습니다.');
        }
    };

    const handleEditAnswerCancel = () => {
        setEditingAnswerId(null);
        setEditedAnswerContent('');
    };

    if (loading) return <div className="loading-spinner"></div>;
    if (error) return <div>{error}</div>;
    if (!question) return null;

    const isQuestionAuthor = user && user.uid === question.authorId;

    return (
        <div className="qna-detail-container" onClick={() => setActiveMenuAnswerId(null)}>
            {/* 질문 보기 모드 UI */}
            <>
                <div className="question-header">
                    <h1>{question.title}</h1>
                    <div className="question-meta">
                        <span>작성자: {question.authorName}</span>
                        <span>작성일: {formatDateTime(question.createdAt)}</span>
                        <span>조회수: {question.viewCount || 0}</span>
                    </div>
                </div>
                <div className="question-content">
                    {question.imageUrl && <img src={question.imageUrl} alt="첨부 이미지" className="question-image" />}
                    <div dangerouslySetInnerHTML={{ __html: question.content.replace(/\n/g, '<br />') }} />
                </div>
                <div className="actions">
                    <Link to="/qna" className="list-btn">목록으로</Link>
                    {isQuestionAuthor && (
                        <div>
                            {/* 수정 버튼 클릭 시 수정 페이지로 이동 */}
                            <button onClick={() => navigate(`/qna/edit/${id}`)} className="edit-btn">수정</button>
                            <button onClick={handleQuestionDelete} className="delete-btn">삭제</button>
                        </div>
                    )}
                </div>
            </>

            {/* 댓글 섹션 */}
            <div className="answers-section">
                <h2>댓글 {question.answers ? question.answers.length : 0}개</h2>
                {user ? (
                    <form onSubmit={handleAnswerSubmit} className="answer-form">
                        <textarea value={newAnswer} onChange={(e) => setNewAnswer(e.target.value)} placeholder="댓글을 입력하세요..." rows="3"></textarea>
                        <button type="submit">댓글 등록</button>
                    </form>
                ) : (
                    <div className="login-prompt-box" onClick={() => navigate('/login', { state: { from: location } })}>
                        <p>댓글을 작성하려면 로그인이 필요합니다.</p>
                        <span>로그인 페이지로 이동</span>
                    </div>
                )}
                <div className="answers-list">
                    {question.answers && question.answers.map(answer => {
                        const isAnswerAuthor = user && user.uid === answer.authorId;
                        const isEdited = new Date(answer.updatedAt).getTime() > new Date(answer.createdAt).getTime() + 1000;

                        return (
                            <div key={answer.id} className="answer-item">
                                {editingAnswerId === answer.id ? (
                                    <div className="answer-edit-form">
                                        <textarea
                                            value={editedAnswerContent}
                                            onChange={(e) => setEditedAnswerContent(e.target.value)}
                                        />
                                        <div className="answer-edit-actions">
                                            <button onClick={handleEditAnswerCancel} className="cancel-btn">취소</button>
                                            <button onClick={handleEditAnswerSave} className="save-btn">저장</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="answer-meta">
                                            <strong>{answer.authorName}</strong>
                                            <span>{formatDateTime(answer.createdAt)}</span>
                                            {isEdited && <span className="edited-label">(수정됨)</span>}
                                            {isAnswerAuthor && (
                                                <div className="answer-actions" onClick={(e) => e.stopPropagation()}>
                                                    <button className="more-btn" onClick={() => setActiveMenuAnswerId(activeMenuAnswerId === answer.id ? null : answer.id)}>
                                                        ⋮
                                                    </button>
                                                    {activeMenuAnswerId === answer.id && (
                                                        <div className="dropdown-menu">
                                                            <button onClick={() => handleEditAnswerStart(answer)}>수정</button>
                                                            <button onClick={() => handleAnswerDelete(answer.id)}>삭제</button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <p>{answer.content}</p>
                                    </>
                                )}
  <div className="policy-links">
    <PolicyLinks />
  </div>
</div>
);
                    })}
                </div>
            </div>
        </div>
    );
};

export default QnaDetail;