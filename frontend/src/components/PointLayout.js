import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { getUserPoints } from '../api/point';
import PointCharge from './PointCharge';
import PointHistory from './PointHistory';
import LoadingSpinner from './LoadingSpinner'; // 스피너 컴포넌트 import
import './PointLayout.css';

const PointLayout = () => {
    const { user, authLoading } = useOutletContext();

    const [points, setPoints] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeView, setActiveView] = useState('charge');

    const fetchPoints = useCallback(async () => {
        if (user) {
            try {
                const pointData = await getUserPoints(user.uid);
                setPoints(pointData.amount || 0);
            } catch (err) {
                console.error("포인트 정보를 불러오는 데 실패했습니다.", err);
                setError("포인트 정보를 불러오는 데 실패했습니다.");
            }
        }
    }, [user]);

    useEffect(() => {
        if (!authLoading) {
            setLoading(true);
            fetchPoints().finally(() => setLoading(false));
        }
    }, [user, authLoading, fetchPoints]);

    if (authLoading || loading) {
        return <LoadingSpinner />;
    }

    if (!user) {
        return (
            <div className="point-layout-container">
                <div className="login-prompt">
                    <h2>로그인 필요</h2>
                    <p>포인트 내역을 확인하려면 로그인이 필요합니다.</p>
                    <Link to="/login" className="login-btn-link">로그인 페이지로 이동</Link>
                </div>
            </div>
        );
    }
    
    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="point-layout-container">
            <h1>포인트 관리</h1>
            <div className="current-points-card">
                <h2>현재 보유 포인트</h2>
                <p>{points.toLocaleString()} P</p>
            </div>
            <div className="point-content-wrapper">
                <nav className="point-menu">
                    <ul>
                        <li className={activeView === 'charge' ? 'active' : ''} onClick={() => setActiveView('charge')}>
                            포인트 충전
                        </li>
                        <li className={activeView === 'history' ? 'active' : ''} onClick={() => setActiveView('history')}>
                            포인트 내역
                        </li>
                    </ul>
                </nav>
                <main className="point-view">
                    {activeView === 'charge' && <PointCharge user={user} onChargeSuccess={fetchPoints} />}
                    {activeView === 'history' && <PointHistory user={user} />}
                </main>
            </div>
        </div>
    );
};

export default PointLayout;