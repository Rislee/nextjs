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

// 등급(낮음 → 높음)
export const PLAN_LEVEL: Record<PlanId, number> = {
  START_OS: 1,
  SIGNATURE_OS: 2,
  MASTER_OS: 3,
};

// userPlan이 targetPlan을 "포함하거나(=같거나)" "그보다 높으면" true
export function hasAccessOrHigher(userPlan: PlanId, targetPlan: PlanId) {
  return PLAN_LEVEL[userPlan] >= PLAN_LEVEL[targetPlan];
}