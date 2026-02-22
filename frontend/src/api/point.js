// src/api/point.js
import axios from 'axios';
import { auth } from '../firebase';

const getApiUrl = () => {
    if (process.env.REACT_APP_POINT_API_BASE_URL) {
        return process.env.REACT_APP_POINT_API_BASE_URL;
    }
    return 'http://localhost:8088';
};

const apiClient = axios.create({
    baseURL: getApiUrl(),
    headers: {
        'Content-Type': 'application/json',
    }
});

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
 * ✅ 특정 사용자의 포인트를 조회합니다.
 */
export const getUserPoints = async (firebaseUid) => { // 파라미터 이름을 firebaseUid로 명확하게 함
    try {
        const response = await apiClient.get(`/api/points/${firebaseUid}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching user points:", error);
        throw error;
    }
};

/**
 * ✅ 특정 사용자의 포인트 변동 내역을 조회합니다.
 */
export const getPointHistory = async (firebaseUid) => { // 파라미터 이름을 firebaseUid로 명확하게 함
    try {
        const response = await apiClient.get(`/api/points/${firebaseUid}/history`);
        return response.data;
    } catch (error) {
        console.error("Error fetching point history:", error);
        throw error;
    }
};

/**
 * ✅ 특정 사용자의 포인트를 충전합니다.
 */
export const chargeUserPoints = async (firebaseUid, amount) => { // 파라미터 이름을 firebaseUid로 명확하게 함
    try {
        const response = await apiClient.post(`/api/points/${firebaseUid}/charge`, { amount });
        // 성공 응답(2xx)을 받았더라도, 응답 데이터 내에 에러 메시지가 있는지 확인합니다.
        // 백엔드가 에러를 HTTP 200으로 응답하는 경우를 대비한 방어 코드입니다.
        if (response.data && response.data.message && /초과|실패|오류/.test(response.data.message)) {
            throw new Error(response.data.message);
        }
        return response.data;
    } catch (error) {
        console.error("Error charging points:", error);
        // axios가 HTTP 상태 코드로 에러를 인지한 경우 (4xx, 5xx)
        // 백엔드가 보낸 에러 메시지가 있으면 그것을 사용합니다.
        // PointController의 ErrorResponse DTO는 'error' 필드를 사용합니다.
        if (error.response && error.response.data && error.response.data.error) {
            throw new Error(error.response.data.error);
        }
        // 위에서 직접 throw한 에러 또는 네트워크 에러 등
        throw error;
    }
};

/**
 * ✅ 특정 사용자의 포인트를 사용(차감)합니다.
 */
export const reduceUserPoints = async (firebaseUid, amount, reason) => {
    try {
        const response = await apiClient.post(`/api/points/${firebaseUid}/reduce`, null, {
            params: {
                amount,
                reason,
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error reducing points:", error);
        // 서버에서 보낸 에러 메시지를 그대로 전달
        if (error.response && error.response.data && error.response.data.error) {
            throw new Error(error.response.data.error);
        }
        throw error;
    }
};