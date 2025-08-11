// src/api/term.js
import axios from 'axios';
import { auth } from '../firebase';

const getApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
        // GCP 배포 환경
    return 'https://term-service-902267887946.us-central1.run.app';
  }
    // 로컬 개발 환경
  return 'http://localhost:8088';
};

const apiClient = axios.create({
  baseURL: getApiUrl(),
});

// 요청 인터셉터를 사용하여 모든 요청에 Firebase 인증 토큰을 자동으로 추가합니다.
apiClient.interceptors.request.use(
  async (config) => {
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
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 사용자의 모든 계약서 목록을 가져옵니다.
 */
export const getContracts = async () => {
  try {
    const response = await apiClient.get('/terms');
    return response.data;
  } catch (error) {
    console.error('계약서 목록을 가져오는 중 오류가 발생했습니다.', error);
    throw error;
  }
};

/**
 * 특정 ID의 계약서 정보를 가져옵니다.
 */
export const getContractById = async (id) => {
  try {
    const response = await apiClient.get(`/terms/${id}`);
    return response.data;
  } catch (error) {
    console.error(`ID가 ${id}인 계약서를 가져오는 중 오류가 발생했습니다.`, error);
    throw error;
  }
};

/**
 * 특정 ID의 계약서를 직접 수정합니다.
 */
export const updateContract = async (id, updateData) => {
  try {
    const response = await apiClient.put(`/terms/${id}/direct-update`, updateData);
    return response.data;
  } catch (error) {
    console.error(`ID가 ${id}인 계약서를 수정하는 중 오류가 발생했습니다.`, error);
    throw error;
  }
};

/**
 * 최신 버전의 계약서 하나를 삭제합니다.
 */
export const deleteLatestContract = async (id) => {
  try {
    // 백엔드에서 type=latest 쿼리를 보고 최신 버전 삭제 로직을 수행합니다.
    const response = await apiClient.delete(`/terms/${id}?type=latest`);
    return response.data;
  } catch (error) {
    console.error(`ID가 ${id}인 최신 계약서를 삭제하는 중 오류가 발생했습니다.`, error);
    throw error;
  }
};

/**
 * 특정 계약서의 모든 버전 기록을 삭제합니다.
 */
export const deleteAllContractsInGroup = async (id) => {
  try {
    // 백엔드에서 type=group 쿼리를 보고 그룹 전체 삭제 로직을 수행합니다.
    const response = await apiClient.delete(`/terms/${id}?type=group`);
    return response.data;
  } catch (error) {
    console.error(`ID가 ${id}인 계약서 그룹을 삭제하는 중 오류가 발생했습니다.`, error);
    throw error;
  }
};
