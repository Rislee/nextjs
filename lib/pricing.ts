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
    originalPrice: 800000,      // 80만원 (정가)
    discountPrice: 550000,      // 55만원 (할인가)
    actualPrice: 550000,        // 실제 결제 금액 = 할인가
  },
  SIGNATURE_OS: {
    originalPrice: 3000000,     // 300만원 (정가)
    discountPrice: 2500000,     // 250만원 (할인가)
    actualPrice: 2500000,       // 실제 결제 금액 = 할인가
  },
  MASTER_OS: {
    originalPrice: 5500000,     // 550만원 (정가)
    discountPrice: 4500000,     // 450만원 (할인가)
    actualPrice: 4500000,       // 실제 결제 금액 = 할인가
  }
};

export const PLAN_INFO = {
  START_OS: {
    title: 'START OS',
    description: 'Inner OS 기본 서비스'
  },
  SIGNATURE_OS: {
    title: 'SIGNATURE OS',
    description: '프리미엄 서비스'
  },
  MASTER_OS: {
    title: 'MASTER OS',
    description: '최고급 서비스'
  }
};