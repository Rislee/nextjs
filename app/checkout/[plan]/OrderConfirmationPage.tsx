'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { requestIamportPay } from '@/lib/portone/v1-client';
import type { PlanId } from '@/lib/plan';

interface OrderConfirmationPageProps {
  planId: PlanId;
  userEmail: string;
  userName: string;
}

const PLAN_INFO = {
  START_OS: {
    title: 'START OS',
    originalPrice: 69000,
    discountPrice: 55000,
    description: '기본 AI 어시스턴트 서비스'
  },
  SIGNATURE_OS: {
    title: 'SIGNATURE OS',
    originalPrice: 290000,
    discountPrice: 250000,
    description: '프리미엄 AI 어시스턴트 서비스'
  },
  MASTER_OS: {
    title: 'MASTER OS',
    originalPrice: 600000,
    discountPrice: 500000,
    description: '최고급 AI 어시스턴트 서비스'
  }
};

export default function OrderConfirmationPage({ planId, userEmail, userName }: OrderConfirmationPageProps) {
  const router = useRouter();
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'trans'>('card');
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    all: false
  });
  const [formData, setFormData] = useState({
    name: userName || '',
    email: userEmail || '',
    phone: ''
  });

  const planInfo = PLAN_INFO[planId];

  // SDK 로드 체크
  useEffect(() => {
    const checkSDK = setInterval(() => {
      if (typeof window !== 'undefined' && window.IMP) {
        setSdkReady(true);
        clearInterval(checkSDK);
      }
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(checkSDK);
    }, 3000);

    return () => {
      clearInterval(checkSDK);
      clearTimeout(timeout);
    };
  }, []);

  // 전체 동의 처리
  const handleAllAgreement = (checked: boolean) => {
    setAgreements({
      terms: checked,
      privacy: checked,
      all: checked
    });
  };

  // 개별 동의 처리
  const handleIndividualAgreement = (key: 'terms' | 'privacy', checked: boolean) => {
    const newAgreements = {
      ...agreements,
      [key]: checked
    };
    
    newAgreements.all = newAgreements.terms && newAgreements.privacy;
    setAgreements(newAgreements);
  };

  // 주문 생성 및 결제 진행
  const handlePayment = async () => {
    if (!sdkReady) {
      alert('결제 시스템을 준비 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (!agreements.terms || !agreements.privacy) {
      alert('이용약관 및 개인정보처리방침에 동의해주세요.');
      return;
    }

    if (!formData.name.trim() || !formData.email.trim()) {
      alert('이름과 이메일을 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      // 주문 생성
      const orderResponse = await fetch('/api/checkout/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || '주문 생성에 실패했습니다.');
      }

      const { merchantUid, amount, orderName } = await orderResponse.json();

      const redirectUrl = `${window.location.origin}/checkout/complete`;

      // 결제창 호출
      await requestIamportPay({
        merchant_uid: merchantUid,
        amount,
        name: orderName,
        redirectUrl,
        buyer_name: formData.name,
        buyer_email: formData.email,
        buyer_tel: formData.phone || undefined,
        pay_method: paymentMethod
      });

    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error.message || '결제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script 
        src="https://cdn.iamport.kr/v1/iamport.js" 
        onLoad={() => setSdkReady(true)}
      />
      
      <div className="inneros-page" style={{ padding: '24px 0' }}>
        <div className="inneros-container">
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {/* 헤더 */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h1 style={{ 
                fontSize: '28px', 
                fontWeight: '600', 
                color: 'var(--text-primary)', 
                margin: '0 0 8px 0' 
              }}>
                주문서 작성
              </h1>
              <p style={{ 
                color: 'var(--text-secondary)', 
                fontSize: '16px', 
                margin: '0' 
              }}>
                주문 정보를 확인하고 결제를 진행해주세요
              </p>
            </div>

            <div style={{ display: 'grid', gap: '32px' }}>
              {/* 1. 구매 상품 정보 */}
              <div className="inneros-card">
                <h2 style={{ 
                  fontSize: '20px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)', 
                  margin: '0 0 20px 0' 
                }}>
                  구매 상품
                </h2>
                
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '12px',
                  padding: '24px',
                  color: 'white'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 8px 0' }}>
                        {planInfo.title}
                      </h3>
                      <p style={{ fontSize: '16px', opacity: 0.9, margin: '0' }}>
                        {planInfo.description}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', textDecoration: 'line-through', opacity: 0.7 }}>
                        ₩{planInfo.originalPrice.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: '700' }}>
                        ₩{planInfo.discountPrice.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. 주문자 정보 */}
              <div className="inneros-card">
                <h2 style={{ 
                  fontSize: '20px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)', 
                  margin: '0 0 20px 0' 
                }}>
                  주문자 정보
                </h2>
                
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label className="inneros-label">이름 *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="홍길동"
                      className="inneros-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="inneros-label">이메일 *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="example@email.com"
                      className="inneros-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="inneros-label">연락처 (선택)</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="010-0000-0000"
                      className="inneros-input"
                    />
                  </div>
                </div>
              </div>

              {/* 3. 결제 수단 */}
              <div className="inneros-card">
                <h2 style={{ 
                  fontSize: '20px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)', 
                  margin: '0 0 20px 0' 
                }}>
                  결제 수단
                </h2>
                
                <div style={{ display: 'grid', gap: '12px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    border: `2px solid ${paymentMethod === 'card' ? 'var(--brand-color)' : 'var(--border-primary)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'var(--transition-base)'
                  }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={(e) => setPaymentMethod(e.target.value as 'card')}
                      style={{ marginRight: '8px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>신용카드</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        국내 모든 카드사 지원
                      </div>
                    </div>
                  </label>
                  
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    border: `2px solid ${paymentMethod === 'trans' ? 'var(--brand-color)' : 'var(--border-primary)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'var(--transition-base)'
                  }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="trans"
                      checked={paymentMethod === 'trans'}
                      onChange={(e) => setPaymentMethod(e.target.value as 'trans')}
                      style={{ marginRight: '8px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>실시간 계좌이체</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        은행 계좌에서 즉시 결제
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 4. 이용약관 동의 */}
              <div className="inneros-card">
                <h2 style={{ 
                  fontSize: '20px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)', 
                  margin: '0 0 20px 0' 
                }}>
                  이용약관 동의
                </h2>
                
                <div style={{ display: 'grid', gap: '16px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={agreements.all}
                      onChange={(e) => handleAllAgreement(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '16px' }}>
                      전체 동의
                    </div>
                  </label>
                  
                  <div style={{ paddingLeft: '20px', display: 'grid', gap: '12px' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={agreements.terms}
                        onChange={(e) => handleIndividualAgreement('terms', e.target.checked)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ color: 'var(--text-primary)' }}>
                        서비스 이용약관 동의 (필수)
                      </span>
                      <a 
                        href="https://www.inneros.co.kr/terms" 
                        target="_blank"
                        style={{ color: 'var(--brand-color)', textDecoration: 'underline', fontSize: '14px' }}
                      >
                        보기
                      </a>
                    </label>
                    
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={agreements.privacy}
                        onChange={(e) => handleIndividualAgreement('privacy', e.target.checked)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ color: 'var(--text-primary)' }}>
                        개인정보 처리방침 동의 (필수)
                      </span>
                      <a 
                        href="https://www.inneros.co.kr/privacy" 
                        target="_blank"
                        style={{ color: 'var(--brand-color)', textDecoration: 'underline', fontSize: '14px' }}
                      >
                        보기
                      </a>
                    </label>
                  </div>
                </div>
              </div>

              {/* 결제 요약 및 버튼 */}
              <div className="inneros-card" style={{ background: 'var(--bg-secondary)' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '24px'
                }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      총 결제금액
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {planInfo.title} (1년 구독)
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: '24px', 
                      fontWeight: '700', 
                      color: 'var(--text-primary)' 
                    }}>
                      ₩{planInfo.discountPrice.toLocaleString()}
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: 'var(--text-secondary)',
                      textDecoration: 'line-through' 
                    }}>
                      ₩{planInfo.originalPrice.toLocaleString()}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '16px' }}>
                  <button
                    onClick={() => router.back()}
                    className="inneros-button-secondary"
                    style={{ flex: 1 }}
                    disabled={loading}
                  >
                    이전으로
                  </button>
                  <button
                    onClick={handlePayment}
                    className="inneros-button"
                    style={{ flex: 2 }}
                    disabled={loading || !agreements.terms || !agreements.privacy}
                  >
                    {loading ? '결제 진행 중...' : `₩${planInfo.discountPrice.toLocaleString()} 결제하기`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}