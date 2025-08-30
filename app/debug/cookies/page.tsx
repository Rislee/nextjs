// app/debug/cookies/page.tsx
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

export default async function DebugCookiesPage() {
  const ck = await cookies();
  const allCookies = ck.getAll();
  
  // 쿠키 분류
  const uidCookies = allCookies.filter(c => c.name === "uid");
  const sbCookies = allCookies.filter(c => c.name.startsWith("sb-"));
  const otherCookies = allCookies.filter(c => c.name !== "uid" && !c.name.startsWith("sb-"));
  
  // Supabase 세션 확인
  let sessionStatus = "확인 중...";
  let userEmail = "";
  let userId = "";
  
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
    if (error) {
      sessionStatus = `에러: ${error.message}`;
    } else if (data.user) {
      sessionStatus = "활성";
      userEmail = data.user.email || "";
      userId = data.user.id;
    } else {
      sessionStatus = "세션 없음";
    }
  } catch (e: any) {
    sessionStatus = `예외: ${e.message}`;
  }
  
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">🍪 쿠키 디버그</h1>
      
      {/* Supabase 세션 상태 */}
      <section className="rounded-lg border p-4 space-y-2">
        <h2 className="text-lg font-semibold">Supabase 세션</h2>
        <div className="text-sm space-y-1">
          <div>상태: <span className={sessionStatus === "활성" ? "text-green-600" : "text-red-600"}>{sessionStatus}</span></div>
          {userEmail && <div>이메일: {userEmail}</div>}
          {userId && <div>User ID: {userId}</div>}
        </div>
      </section>
      
      {/* UID 쿠키 */}
      <section className="rounded-lg border p-4 space-y-2">
        <h2 className="text-lg font-semibold">UID 쿠키 ({uidCookies.length}개)</h2>
        {uidCookies.length === 0 ? (
          <p className="text-sm text-gray-500">없음</p>
        ) : (
          <div className="space-y-2">
            {uidCookies.map((cookie, i) => (
              <div key={i} className="text-sm font-mono bg-gray-50 p-2 rounded">
                <div>값: {cookie.value}</div>
              </div>
            ))}
          </div>
        )}
        {uidCookies.length > 1 && (
          <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ 중복된 UID 쿠키가 감지되었습니다!
          </div>
        )}
      </section>
      
      {/* Supabase 쿠키 */}
      <section className="rounded-lg border p-4 space-y-2">
        <h2 className="text-lg font-semibold">Supabase 쿠키 ({sbCookies.length}개)</h2>
        {sbCookies.length === 0 ? (
          <p className="text-sm text-gray-500">없음</p>
        ) : (
          <div className="space-y-2">
            {sbCookies.map((cookie, i) => (
              <div key={i} className="text-sm font-mono bg-gray-50 p-2 rounded">
                <div>이름: {cookie.name}</div>
                <div className="truncate">값: {cookie.value.substring(0, 50)}...</div>
              </div>
            ))}
          </div>
        )}
      </section>
      
      {/* 기타 쿠키 */}
      {otherCookies.length > 0 && (
        <section className="rounded-lg border p-4 space-y-2">
          <h2 className="text-lg font-semibold">기타 쿠키 ({otherCookies.length}개)</h2>
          <div className="space-y-2">
            {otherCookies.map((cookie, i) => (
              <div key={i} className="text-sm font-mono bg-gray-50 p-2 rounded">
                <div>이름: {cookie.name}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      
      {/* 액션 버튼들 - 클라이언트 컴포넌트로 분리 필요 */}
      <section className="flex gap-4">
        <a 
          href="/api/auth/logout"
          className="rounded-md bg-red-600 text-white px-4 py-2 text-sm hover:bg-red-700"
        >
          모든 세션 정리 (로그아웃)
        </a>
        
        <a 
          href="/debug/cookies"
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          새로고침
        </a>
        
        <a 
          href="/dashboard"
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          대시보드로 이동
        </a>
      </section>
      
      <section className="text-xs text-gray-500 space-y-1">
        <div>현재 시간: {new Date().toLocaleString()}</div>
        <div>환경: {process.env.NODE_ENV}</div>
      </section>
    </main>
  );
}