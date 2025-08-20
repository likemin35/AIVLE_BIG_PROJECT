import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getUserPoints, chargeUserPoints, getPointHistory } from '../api/point';
import './PointPage.css';

import PolicyLinks from './PolicyLink.js'; 

const PointPage = () => {
    const { user, refreshPoints } = useOutletContext(); // refreshPoints 함수를 context에서 가져옴
    const [points, setPoints] = useState(0);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chargeAmount, setChargeAmount] = useState('');

    useEffect(() => {
        if (user) {
            const fetchPointData = async () => {
                setLoading(true);
                setError(null);
                try {
                    const [pointResponse, historyResponse] = await Promise.all([
                        getUserPoints(user.uid),
                        getPointHistory(user.uid)
                    ]);

                    if (pointResponse && typeof pointResponse.amount === 'number') {
                        setPoints(pointResponse.amount);
                    }
                    if (Array.isArray(historyResponse)) {
                        setHistory(historyResponse);
                    }
                } catch (err) {
                    console.error("포인트 정보를 불러오는 데 실패했습니다.", err);
                    setError("데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
                } finally {
                    setLoading(false);
                }
            };
            fetchPointData();
        } else {
            setLoading(false);
        }
    }, [user]);

    const handleCharge = async (e) => {
        e.preventDefault();
        const amount = parseInt(chargeAmount, 10);
        if (!amount || amount <= 0) {
            alert("올바른 충전 금액을 입력해주세요.");
            return;
        }

        try {
            await chargeUserPoints(user.uid, amount);
            alert('포인트 충전 요청이 완료되었습니다. 반영까지 시간이 걸릴 수 있습니다.');
            setChargeAmount('');
            
            // 변경된 내용을 즉시 반영하기 위해 데이터 다시 로드 및 상위 레이아웃에 알림
            const historyData = await getPointHistory(user.uid);
            setHistory(historyData);
            if(refreshPoints) {
                await refreshPoints(); // MainLayout의 포인트를 새로고침하고 다른 탭에 알림
            }
        } catch (error) {
            alert(`포인트 충전에 실패했습니다: ${error.response?.data?.message || error.message}`);
        }
    };
    
    const getHistoryTypeText = (type) => {
        switch (type) {
            case 'INITIAL': return '신규 가입';
            case 'CHARGE': return '포인트 충전';
            case 'DEDUCT': return '포인트 사용';
            case 'DEDUCT_MANUAL': return '수동 차감';
            default: return type;
        }
    };

    if (loading) {
        return <div className="loading-spinner"></div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }
    
    if (!user) {
        return (
            <div className="point-page-container">
                <h1>내 포인트</h1>
                <p>포인트 정보를 보려면 로그인이 필요합니다.</p>
            </div>
        );
    }

    return (
        <div className="point-page-container">
            <h1>내 포인트</h1>
            <div className="current-points-card">
                <h2>현재 보유 포인트</h2>
                <p>{points.toLocaleString()} P</p>
            </div>

            <div className="charge-section">
                <h2>포인트 충전</h2>
                <form onSubmit={handleCharge} className="charge-form">
                    <input
                        type="number"
                        value={chargeAmount}
                        onChange={(e) => setChargeAmount(e.target.value)}
                        placeholder="충전할 금액 입력"
                        min="1"
                    />
                    <button type="submit">충전하기</button>
                </form>
            </div>

            <div className="history-section">
                <h2>포인트 내역</h2>
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
                                    <td>{new Date(item.timestamp).toLocaleDateString()}</td>
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

                        <PolicyLinks />
        </div>
    );
};

export default PointPage;