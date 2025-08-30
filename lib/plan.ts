export type PlanId = "START_OS" | "SIGNATURE_OS" | "MASTER_OS";

export const PLAN_TO_TITLE: Record<PlanId, string> = {
  START_OS: "START OS",
  SIGNATURE_OS: "SIGNATURE OS",
  MASTER_OS: "MASTER OS",
};

export const PLAN_TO_FRAMER_URL: Record<PlanId, string> = {
  START_OS:
    process.env.NEXT_PUBLIC_FRAMER_START_URL ||
    "https://www.inneros.co.kr/start-os",
  SIGNATURE_OS:
    process.env.NEXT_PUBLIC_FRAMER_SIGNATURE_URL ||
    "https://www.inneros.co.kr/signature-os",
  MASTER_OS:
    process.env.NEXT_PUBLIC_FRAMER_MASTER_URL ||
    "https://www.inneros.co.kr/master-os",
};

// 개별 권한 체크 함수 - 특정 플랜에 대한 정확한 권한만 확인
export function hasSpecificAccess(userPlan: PlanId | null, targetPlan: PlanId): boolean {
  if (!userPlan) return false;
  return userPlan === targetPlan;
}

// 모든 플랜 목록
export const ALL_PLANS: PlanId[] = ["START_OS", "SIGNATURE_OS", "MASTER_OS"];

// 사용자가 접근 가능한 플랜들을 반환
export function getAccessiblePlans(userPlan: PlanId | null): PlanId[] {
  if (!userPlan) return [];
  // 이제 사용자는 자신의 플랜에만 접근 가능
  return [userPlan];
}

// 사용자가 구매 가능한 플랜들을 반환 (현재 보유하지 않은 모든 플랜)
export function getPurchasablePlans(userPlan: PlanId | null): PlanId[] {
  if (!userPlan) return ALL_PLANS;
  // 현재 플랜을 제외한 모든 플랜을 구매 가능
  return ALL_PLANS.filter(plan => plan !== userPlan);
}

// 레거시 호환성을 위한 함수 (기존 코드에서 사용 중인 경우)
// @deprecated - hasSpecificAccess 사용 권장
export function hasAccessOrHigher(userPlan: PlanId, targetPlan: PlanId): boolean {
  return hasSpecificAccess(userPlan, targetPlan);
}