export type PlanId = "START_OS" | "SIGNATURE_OS" | "MASTER_OS";

export const PLAN_TO_TITLE: Record<PlanId, string> = {
  START_OS: "START OS",
  SIGNATURE_OS: "SIGNATURE OS",
  MASTER_OS: "MASTER OS",
};

// 환경변수로 덮어쓸 수 있게(없으면 기본값)
export const PLAN_TO_FRAMER_URL: Record<PlanId, string> = {
  START_OS:
    process.env.NEXT_PUBLIC_FRAMER_START_URL ||
    "https://www.inneros.co.kr/start",
  SIGNATURE_OS:
    process.env.NEXT_PUBLIC_FRAMER_SIGNATURE_URL ||
    "https://www.inneros.co.kr/signature",
  MASTER_OS:
    process.env.NEXT_PUBLIC_FRAMER_MASTER_URL ||
    "https://www.inneros.co.kr/master",
};
