// lib/pricing.ts
export type PlanId = 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';

export interface PlanPricing {
  originalPrice: number;
  discountPrice: number;
  actualPrice: number; // 실제 결제 금액 (10배 차이)
}

// 표시 가격과 실제 결제 가격 설정
export const PLAN_PRICING: Record<PlanId, PlanPricing> = {
  START_OS: {
    originalPrice: 800000,      // 표시 정가
    discountPrice: 250000,      // 표시 할인가
    actualPrice: 550000,       // 실제 결제 금액 
  },
  SIGNATURE_OS: {
    originalPrice: 2500000,     // 표시 정가
    discountPrice: 3000000,     // 표시 할인가
    actualPrice: 2500000,      // 실제 결제 금액 
  },
  MASTER_OS: {
    originalPrice: 5000000,     // 표시 정가
    discountPrice: 500000,     // 표시 할인가
    actualPrice: 4500000,      // 실제 결제 금액 
  }
};

export const PLAN_INFO = {
  START_OS: {
    title: 'START OS',
    description: '기본 AI 어시스턴트 서비스'
  },
  SIGNATURE_OS: {
    title: 'SIGNATURE OS',
    description: '프리미엄 AI 어시스턴트 서비스'
  },
  MASTER_OS: {
    title: 'MASTER OS',
    description: '최고급 AI 어시스턴트 서비스'
  }
};