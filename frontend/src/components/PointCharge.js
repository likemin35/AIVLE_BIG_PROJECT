import React, { useState, useRef, useEffect } from 'react';
import { chargeUserPoints } from '../api/point';
import './PointCharge.css';
import kakaopayLogo from '../assets/kakaopay-logo.png'; // 카카오페이 로고 import
import tossLogo from '../assets/toss-logo.png';       // 토스 로고 import
import PolicyLinks from './PolicyLink';
// --- 아이콘 컴포넌트 정의 ---
const CreditCardIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zM20 18H4v-6h16v6zm0-10H4V6h16v2z"/></svg>;
const BankIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L2 6v2h20V6L12 1zM4 10v7h3v-7H4zm6 0v7h3v-7h-3zm6 0v7h3v-7h-3zM2 22h20v-2H2v2z"/></svg>;
const MobileIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg>;

const PRESET_AMOUNTS = [5000, 10000, 50000, 100000];
const PAYMENT_METHODS = [
    { name: '신용카드', icon: <CreditCardIcon />, type: 'svg' },
    { name: '계좌이체', icon: <BankIcon />, type: 'svg' },
    { name: '휴대폰 결제', icon: <MobileIcon />, type: 'svg' },
    { name: '카카오페이', icon: kakaopayLogo, type: 'image' },
    { name: '토스', icon: tossLogo, type: 'image' }
];

const PointCharge = ({ user, onChargeSuccess }) => {
    const [selectedAmount, setSelectedAmount] = useState(5000);
    const [isCustom, setIsCustom] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState('신용카드');
    const customInputRef = useRef(null);

    useEffect(() => {
        if (isCustom && customInputRef.current) {
            customInputRef.current.focus();
        }
    }, [isCustom]);

    const handleAmountClick = (amount) => {
        setIsCustom(false);
        setSelectedAmount(amount);
    };

    const handleCustomClick = () => {
        setIsCustom(true);
        setSelectedAmount(0);
    };

    const handleCharge = async (e) => {
        e.preventDefault();
        const amountToCharge = isCustom ? parseInt(customInputRef.current.value, 10) : selectedAmount;

        if (!amountToCharge || amountToCharge <= 0) {
            alert("올바른 충전 금액을 입력하거나 선택해주세요.");
            return;
        }

        try {
            await chargeUserPoints(user.uid, amountToCharge);
            alert('포인트 충전 요청이 완료되었습니다. 반영까지 시간이 걸릴 수 있습니다.');
            setIsCustom(false);
            setSelectedAmount(5000);
            if (onChargeSuccess) {
                onChargeSuccess();
            }
        } catch (error) {
            alert(`포인트 충전에 실패했습니다: ${error.message}`);
        }
    };

    return (
        <form onSubmit={handleCharge} className="point-charge-container">
            <div className="point-card">
                <h2>충전 금액</h2>
                <div className="amount-selector">
                    {PRESET_AMOUNTS.map(amount => (
                        <button
                            type="button"
                            key={amount}
                            className={`amount-btn ${!isCustom && selectedAmount === amount ? 'selected' : ''}`}
                            onClick={() => handleAmountClick(amount)}
                        >
                            {amount.toLocaleString()}원
                        </button>
                    ))}
                    {isCustom ? (
                        <input
                            ref={customInputRef}
                            type="number"
                            className="amount-input"
                            placeholder="금액 입력"
                            min="1000"
                            step="1000"
                            onBlur={(e) => { if(!e.target.value) setIsCustom(false); }}
                        />
                    ) : (
                        <button
                            type="button"
                            className="amount-btn"
                            onClick={handleCustomClick}
                        >
                            직접 입력
                        </button>
                    )}
                </div>
            </div>

            <div className="point-card">
                <h2>결제 수단</h2>
                <div className="payment-selector">
                    {PAYMENT_METHODS.map(method => (
                         <div 
                            key={method.name}
                            className={`payment-btn ${selectedPayment === method.name ? 'selected' : ''}`} 
                            onClick={() => setSelectedPayment(method.name)}
                         >
                            {method.type === 'svg' ? method.icon : <img src={method.icon} alt={`${method.name} 로고`} className="payment-logo" />}
                            <span>{method.name}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <button type="submit" className="charge-submit-btn">충전하기</button>
        </form>
    );
};

export default PointCharge;