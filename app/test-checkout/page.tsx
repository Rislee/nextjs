// app/test-checkout/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { requestIamportPay } from '@/lib/portone/v1-client';

export default function TestCheckoutPage() {
  const [sdkReady, setSdkReady] = useState(false);
  const [pgProvider, setPgProvider] = useState<'tosspayments' | 'nice_v2'>('tosspayments'); // 헥토 제거
  
  useEffect(() => {
    const checkSDK = setInterval(() => {
      if (typeof window !== 'undefined' && window.IMP) {
        setSdkReady(true);
        clearInterval(checkSDK);
      }
    }, 100);
    
    return () => clearInterval(checkSDK);
  }, []);
  
  const testPayment = async () => {
    if (!sdkReady) {
      alert('SDK 로딩 중...');
      return;
    }
    
    try {
      // 테스트용 주문 생성
      const merchantUid = `test_${Date.now()}`;
      const amount = 1000; // 테스트 금액
      
      await requestIamportPay({
        merchant_uid: merchantUid,
        amount,
        name: '테스트 상품',
        redirectUrl: `${window.location.origin}/checkout/complete`,
        buyer_name: 'Test User',
        buyer_email: 'test@example.com',
        pay_method: 'card',
        pg: pgProvider // 선택된 PG사
      });
      
    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error.message);
    }
  };
  
  return (
    <>
      <Script 
        src="https://cdn.iamport.kr/v1/iamport.js" 
        onLoad={() => setSdkReady(true)}
      />
      
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>PG사 테스트 (헥토파이낸셜 비활성화)</h1>
        
        <div style={{ marginTop: '20px' }}>
          <h3>PG사 선택:</h3>
          <label>
            <input 
              type="radio" 
              value="tosspayments" 
              checked={pgProvider === 'tosspayments'}
              onChange={(e) => setPgProvider(e.target.value as any)}
            />
            토스페이먼츠 (권장)
          </label>
          <br />
          <label>
            <input 
              type="radio" 
              value="nice_v2" 
              checked={pgProvider === 'nice_v2'}
              onChange={(e) => setPgProvider(e.target.value as any)}
            />
            나이스페이먼츠
          </label>
        </div>
        
        <button 
          onClick={testPayment}
          disabled={!sdkReady}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            background: sdkReady ? '#4CAF50' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: sdkReady ? 'pointer' : 'not-allowed'
          }}
        >
          {sdkReady ? '결제 테스트' : 'SDK 로딩 중...'}
        </button>
        
        <div style={{ marginTop: '20px', color: '#666' }}>
          SDK Ready: {sdkReady ? '✅' : '❌'}<br />
          선택된 PG: {pgProvider}<br />
          헥토파이낸셜: ❌ 비활성화됨
        </div>
      </div>
    </>
  );
}