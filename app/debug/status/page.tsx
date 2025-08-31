// app/debug/status/page.tsx
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function DebugStatusPage() {
  const ck = await cookies();
  const headersList = await headers();
  
  // 기본 정보
  const host = headersList.get("host");
  const userAgent = headersList.get("user-agent");
  const uid = ck.get("uid")?.value;
  const allCookies = ck.getAll();
  
  // Supabase 인증 시도
  let supabaseUser = null;
  let supabaseError = null;
  
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => ck.get(name)?.value,
          set() {},
          remove() {},
        },
      }
    );
    
    const { data, error } = await supabase.auth.getUser();
    supabaseUser = data.user;
    supabaseError = error;
  } catch (e: any) {
    supabaseError = { message: e.message };
  }
  
  // 플랜 정보 조회
  let userPlans: any[] = [];
  let planError: any = null;
  
  if (supabaseUser?.id) {
    try {
      const { data, error } = await supabaseAdmin
        .from("user_plans")
        .select("plan_id, status, activated_at")
        .eq("user_id", supabaseUser.id)
        .eq("status", "active");
        
      userPlans = data || [];
      planError = error;
    } catch (e: any) {
      planError = { message: e.message };
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🔍 Debug Status</h1>
      
      {/* 기본 정보 */}
      <section className="mb-6 p-4 bg-gray-50 rounded">
        <h2 className="text-lg font-semibold mb-3">환경 정보</h2>
        <div className="space-y-1 text-sm font-mono">
          <div>Host: {host}</div>
          <div>NODE_ENV: {process.env.NODE_ENV}</div>
          <div>VERCEL_ENV: {process.env.VERCEL_ENV}</div>
          <div>Timestamp: {new Date().toISOString()}</div>
          <div>User Agent: {userAgent?.substring(0, 100)}...</div>
        </div>
      </section>

      {/* 쿠키 정보 */}
      <section className="mb-6 p-4 bg-blue-50 rounded">
        <h2 className="text-lg font-semibold mb-3">쿠키 정보</h2>
        <div className="space-y-2 text-sm">
          <div>
            <strong>UID Cookie:</strong> {uid ? uid.substring(0, 8) + '...' : '❌ 없음'}
          </div>
          <div>
            <strong>전체 쿠키 수:</strong> {allCookies.length}개
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-blue-600">모든 쿠키 보기</summary>
            <div className="mt-2 space-y-1">
              {allCookies.map((cookie, i) => (
                <div key={i} className="font-mono text-xs">
                  {cookie.name}: {cookie.value.substring(0, 50)}{cookie.value.length > 50 ? '...' : ''}
                </div>
              ))}
            </div>
          </details>
        </div>
      </section>

      {/* Supabase 인증 */}
      <section className="mb-6 p-4 bg-green-50 rounded">
        <h2 className="text-lg font-semibold mb-3">Supabase 인증</h2>
        {supabaseError ? (
          <div className="text-red-600">
            <strong>❌ 인증 실패:</strong> {supabaseError.message}
          </div>
        ) : supabaseUser ? (
          <div className="space-y-1 text-sm">
            <div><strong>✅ 인증 성공</strong></div>
            <div>User ID: {supabaseUser.id}</div>
            <div>Email: {supabaseUser.email}</div>
            <div>Created: {new Date(supabaseUser.created_at).toLocaleString()}</div>
          </div>
        ) : (
          <div className="text-gray-600">❓ 사용자 없음</div>
        )}
      </section>

      {/* 플랜 정보 */}
      <section className="mb-6 p-4 bg-yellow-50 rounded">
        <h2 className="text-lg font-semibold mb-3">플랜 정보</h2>
        {planError ? (
          <div className="text-red-600">
            <strong>❌ 플랜 조회 실패:</strong> {planError.message}
          </div>
        ) : userPlans.length > 0 ? (
          <div>
            <div className="mb-2"><strong>✅ 활성 플랜 {userPlans.length}개:</strong></div>
            {userPlans.map((plan: any, i) => (
              <div key={i} className="text-sm font-mono">
                • {plan.plan_id} ({plan.status}) - {new Date(plan.activated_at).toLocaleDateString()}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-600">❌ 활성 플랜 없음</div>
        )}
      </section>

      {/* 테스트 링크 */}
      <section className="p-4 bg-purple-50 rounded">
        <h2 className="text-lg font-semibold mb-3">테스트 링크</h2>
        <div className="space-y-2">
          <div><a href="/api/me/summary" target="_blank" className="text-blue-600 hover:underline">/api/me/summary</a></div>
          <div><a href="/api/session/ensure" target="_blank" className="text-blue-600 hover:underline">/api/session/ensure</a></div>
          <div><a href="/chat/start-os" className="text-blue-600 hover:underline">/chat/start-os</a></div>
          <div><a href="/dashboard" className="text-blue-600 hover:underline">/dashboard</a></div>
        </div>
      </section>
    </div>
  );
}