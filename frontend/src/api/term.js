// src/api/term.js
import axios from 'axios';
import { auth } from '../firebase';

const getApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    // GCP 배포 환경 (게이트웨이)
    return 'https://term-service-902267887946.us-central1.run.app';
  }
  // 로컬 개발 환경 (게이트웨이)
  return 'http://localhost:8088';
};

const apiClient = axios.create({
  baseURL: getApiUrl(),
});

// 모든 요청에 Firebase 토큰 자동 첨부
apiClient.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Error getting auth token: ', error);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 약관 파일 업로드 (Term 서비스)
 */
export const uploadTermFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await apiClient.post('/terms/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    console.error('약관 파일 업로드 중 오류가 발생했습니다.', error);
    throw error;
  }
};

/**
 * 사용자의 모든 계약서 목록 가져오기
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
 * 특정 계약서 조회
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
 * 특정 계약서 직접 수정
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
 * 최신 버전 삭제
 */
export const deleteLatestContract = async (id) => {
  try {
    const response = await apiClient.delete(`/terms/${id}?type=latest`);
    return response.data;
  } catch (error) {
    console.error(`ID가 ${id}인 최신 계약서를 삭제하는 중 오류가 발생했습니다.`, error);
    throw error;
  }
};

/**
 * 버전 전체 삭제
 */
export const deleteAllContractsInGroup = async (id) => {
  try {
    const response = await apiClient.delete(`/terms/${id}?type=group`);
    return response.data;
  } catch (error) {
    console.error(`ID가 ${id}인 계약서 그룹을 삭제하는 중 오류가 발생했습니다.`, error);
    throw error;
  }
};

/* -----------------------------
 * RAG 분석/개정 (Python 서비스 경유, 게이트웨이 /api/* 프록시)
 * -----------------------------*/

/**
 * 텍스트로 약관 분석
 * body: { text, category, limit?, vector_db_path? }
 * 응답: { ok, clauses, results, text, ... }
 */
export const analyzeTermsWithText = async ({
  text,
  category,
  limit,
  vectorDbPath,
  preset,        // 'strict' | 'balanced' | 'tolerant' 등 (백엔드 프리셋 키)
  sensitivity,   // 0.0 ~ 1.0 (높을수록 민감)
  topK,          // 선택: 검색 K override
  threshold,     // 선택: 유사도 임계치 override
}) => {
  // 선택 파라미터는 정의된 것만 전송
  const body = {
    text,
    category,
  };
  if (typeof limit === 'number') body.limit = limit;
  if (vectorDbPath) body.vector_db_path = vectorDbPath;
  if (preset) body.preset = preset;
  if (typeof sensitivity === 'number') body.sensitivity = sensitivity;
  if (typeof topK === 'number') body.top_k = topK;
  if (typeof threshold === 'number') body.threshold = threshold;

  try {
    const response = await apiClient.post('/api/analyze-terms', body);
    return response.data;
  } catch (error) {
    console.error('텍스트 분석 중 오류', error);
    throw error;
  }
};

/**
 * 파일 업로드로 약관 분석
 * form: file, category, limit?, preset?, sensitivity?, top_k?, threshold?
 * 응답: { ok, results, text, count_clauses, count_flagged, ... }
 */
export const analyzeTermsWithFile = async (
  file,
  { category, limit, preset, sensitivity, topK, threshold } = {}
) => {
  const formData = new FormData();
  formData.append('file', file);
  if (category) formData.append('category', category);
  if (typeof limit === 'number') formData.append('limit', String(limit));
  if (preset) formData.append('preset', preset);
  if (typeof sensitivity === 'number') formData.append('sensitivity', String(sensitivity));
  if (typeof topK === 'number') formData.append('top_k', String(topK));
  if (typeof threshold === 'number') formData.append('threshold', String(threshold));

  try {
    const response = await apiClient.post('/api/analyze-terms-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    console.error('파일 분석 중 오류', error);
    throw error;
  }
};

/**
 * 분석 결과를 그대로 보내 개정안 .docx 다운로드
 * data: { clauses, results, sourceFilename?, mode? }
 * return: { blob, filename }
 */
export const rewriteTermsFromResults = async ({
  clauses,
  results,
  sourceFilename,
  mode = 'inline',
}) => {
  try {
    const response = await apiClient.post(
      '/api/rewrite-terms',
      {
        clauses,
        results,
        source_filename: sourceFilename,
        mode,
      },
      { responseType: 'blob' }
    );

    const disp = response.headers['content-disposition'] || '';
    let filename = '약관_개정안.docx';
    const m = disp.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
    if (m) filename = decodeURIComponent(m[1] || m[2]);

    return { blob: response.data, filename };
  } catch (error) {
    try {
      const data = JSON.parse(await error?.request?.response);
      if (data?.error) throw new Error(data.error);
    } catch (_) {}
    console.error('개정 파일 생성 중 오류', error);
    throw error;
  }
};

/**
 * 브라우저에서 blob 저장
 */
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download.bin';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};