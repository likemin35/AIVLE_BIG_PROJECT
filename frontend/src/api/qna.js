// src/api/qna.js
import axios from 'axios';
import { auth } from '../firebase'; // Firebase 인증 추가

// ✅ API URL 결정 함수
const getApiUrl = () => {
    // 1️⃣ Cloud Run URL이 있으면 최우선 사용
    if (process.env.REACT_APP_QNA_API_BASE_URL) {
        return process.env.REACT_APP_QNA_API_BASE_URL;
    }

    // 2️⃣ 로컬 개발 기본 URL
    return 'http://localhost:8088';
};

// ✅ Axios 인스턴스 생성
const apiClient = axios.create({
    baseURL: getApiUrl(),
    headers: {
        'Content-Type': 'application/json',
    }
});

// ✅ Axios 요청 인터셉터: Firebase 토큰 자동 추가
apiClient.interceptors.request.use(async (config) => {
    const user = auth.currentUser;
    if (user) {
        try {
            const token = await user.getIdToken();
            config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
            console.error("Error getting auth token: ", error);
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

/**
 * ✅ 모든 질문 목록을 가져옵니다. (페이징 지원)
 */
export const getAllQuestions = async (page = 0, size = 10) => {
    try {
        const response = await apiClient.get('/qna', {
            params: { page, size }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching questions:", error);
        throw error;
    }
};

/**
 * ✅ 새로운 질문을 등록합니다.
 */
export const createQuestion = async (questionData) => {
    try {
        const response = await apiClient.post('/qna', questionData);
        return response.data;
    } catch (error) {
        console.error("Error creating question:", error);
        throw error;
    }
};

/**
 * ✅ ID로 특정 질문의 상세 정보를 가져옵니다.
 */
export const getQuestionById = async (id) => {
    try {
        const response = await apiClient.get(`/qna/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching question with id ${id}:`, error);
        throw error;
    }
};

/**
 * ✅ ID로 특정 질문을 삭제합니다.
 */
export const deleteQuestion = async (id) => {
    try {
        await apiClient.delete(`/qna/${id}`);
    } catch (error) {
        console.error(`Error deleting question with id ${id}:`, error);
        throw error;
    }
};

/**
 * ✅ 특정 질문에 새로운 답변(댓글)을 등록합니다.
 */
export const createAnswer = async (questionId, answerData) => {
    try {
        // 데이터를 JSON 객체로 전송
        const response = await apiClient.post(`/qna/${questionId}/answers`, answerData);
        return response.data;
    } catch (error) {
        console.error(`Error creating answer for question ${questionId}:`, error);
        throw error;
    }
};

/**
 * ✅ 특정 질문의 특정 답변(댓글)을 삭제합니다.
 */
export const deleteAnswer = async (questionId, answerId) => {
    try {
        await apiClient.delete(`/qna/${questionId}/answers/${answerId}`);
    } catch (error) {
        console.error(`Error deleting answer ${answerId} from question ${questionId}:`, error);
        throw error;
    }
};

/**
 * ✅ 특정 질문의 특정 답변(댓글)을 수정합니다.
 */
export const updateAnswer = async (questionId, answerId, answerData) => {
    try {
        await apiClient.put(`/qna/${questionId}/answers/${answerId}`, answerData);
    } catch (error) {
        console.error(`Error updating answer ${answerId} from question ${questionId}:`, error);
        throw error;
    }
};

/**
 * ✅ 이미지를 서버에 업로드합니다.
 */
export const uploadImage = async (imageFile) => {
    const formData = new FormData();
    formData.append('file', imageFile); // 백엔드(@RequestParam("file"))와 이름을 일치시킴

    try {
        // 백엔드 컨트롤러(@PostMapping("/upload-image"))와 주소를 일치시킴
        const response = await apiClient.post('/qna/upload-image', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data; // { imageUrl: '...' } 형태의 객체를 반환할 것으로 예상
    } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
    }
};

/**
 * ✅ ID로 특정 질문을 수정합니다.
 */
export const updateQuestion = async (id, questionData) => {
    try {
        const response = await apiClient.put(`/qna/${id}`, questionData);
        return response.data;
    } catch (error) {
        console.error(`Error updating question with id ${id}:`, error);
        throw error;
    }
};
