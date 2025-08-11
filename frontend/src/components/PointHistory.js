import React, { useState, useEffect } from 'react';
import { getPointHistory } from '../api/point';
import './PointHistory.css';

// 날짜 포맷팅 함수
const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}.${month}.${day}. ${hours}:${minutes}`;
};

const PointHistory = ({ user }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user) {
            const fetchHistory = async () => {
                setLoading(true);
                setError(null);
                try {
                    const historyData = await getPointHistory(user.uid);
                    if (Array.isArray(historyData)) {
                        const sortedHistory = historyData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                        setHistory(sortedHistory);
                    }
                } catch (err) {
                    console.error("포인트 내역을 불러오는 데 실패했습니다.", err);
                    setError("내역을 불러오는 중 오류가 발생했습니다.");
                } finally {
                    setLoading(false);
                }
            };
            fetchHistory();
        }
    }, [user]);

    const getHistoryTypeText = (type) => {
        switch (type) {
            case 'INITIAL': return '신규 가입';
            case 'CHARGE': return '포인트 충전';
            case 'DEDUCT': return '포인트 사용';
            case 'DEDUCT_MANUAL': return 'AI 딸깍';
            default: return type;
        }
    };

    if (loading) {
        return <div className="loading-spinner"></div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="point-history-container">
            <h3>포인트 변동 내역</h3>
            <table className="history-table">
                <thead>
                    <tr>
                        <th>날짜</th>
                        <th>내용</th>
                        <th>변동</th>
                    </tr>
                </thead>
                <tbody>
                    {history.length > 0 ? (
                        history.map((item) => (
                            <tr key={item.id}>
                                <td>{formatDate(item.timestamp)}</td>
                                <td>{item.description || getHistoryTypeText(item.type)}</td>
                                <td className={item.type && item.type.includes('DEDUCT') ? 'deduct' : 'charge'}>
                                    {item.type && item.type.includes('DEDUCT') ? '-' : '+'}
                                    {item.amount.toLocaleString()} P
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="3">포인트 내역이 없습니다.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default PointHistory;
