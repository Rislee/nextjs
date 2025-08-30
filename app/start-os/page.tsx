import { redirect } from "next/navigation";
import { PLAN_TO_FRAMER_URL } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default function Page() {
  redirect(PLAN_TO_FRAMER_URL.START_OS);
}
