'use client';

import { useState } from 'react';

export default function TestPage() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const testAPI = async (endpoint: string) => {
    setLoading(true);
    try {
      console.log(`Testing ${endpoint}...`);
      const startTime = Date.now();
      
      const res = await fetch(endpoint, {
        credentials: 'include',
        cache: 'no-store'
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      
      setResults((prev: any) => ({
        ...prev,
        [endpoint]: {
          status: res.status,
          duration,
          data,
          headers: Object.fromEntries(res.headers.entries())
        }
      }));
      
      console.log(`${endpoint} responded in ${duration}ms with status ${res.status}`);
      
    } catch (error: any) {
      console.error(`${endpoint} error:`, error);
      setResults((prev: any) => ({
        ...prev,
        [endpoint]: {
          error: error.message,
          type: error.name
        }
      }));
    }
    setLoading(false);
  };

  const runAllTests = async () => {
    setResults({});
    await testAPI('/api/ping');
    await testAPI('/api/me/summary');
    await testAPI('/api/membership/status');
    await testAPI('/api/session/ensure');
  };

  const clearCookiesAndTest = async () => {
    // 브라우저에서 쿠키 정리
    document.cookie.split(";").forEach(c => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    // API로도 정리
    await fetch('/api/auth/clear', { method: 'POST' });
    
    alert('쿠키 정리 완료. 페이지를 새로고침합니다.');
    window.location.reload();
  };

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">🧪 API 테스트</h1>
      
      <div className="flex gap-4">
        <button
          onClick={runAllTests}
          disabled={loading}
          className="rounded bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '테스트 중...' : '모든 API 테스트'}
        </button>
        
        <button
          onClick={clearCookiesAndTest}
          className="rounded bg-red-600 text-white px-4 py-2 hover:bg-red-700"
        >
          쿠키 정리 후 새로고침
        </button>
        
        <a
          href="/dashboard"
          className="rounded border px-4 py-2 hover:bg-gray-50"
        >
          대시보드로
        </a>
      </div>

      {/* 현재 쿠키 상태 */}
      <section className="rounded border p-4">
        <h2 className="font-semibold mb-2">현재 쿠키</h2>
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
          {document.cookie || '(없음)'}
        </pre>
      </section>

      {/* 테스트 결과 */}
      {Object.entries(results).map(([endpoint, result]: [string, any]) => (
        <section key={endpoint} className="rounded border p-4">
          <h2 className="font-semibold mb-2">{endpoint}</h2>
          {result.error ? (
            <div className="text-red-600">
              <div>에러: {result.error}</div>
              <div className="text-sm">타입: {result.type}</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm">
                <span className={result.status === 200 ? 'text-green-600' : 'text-amber-600'}>
                  상태: {result.status}
                </span>
                {' | '}
                <span>응답시간: {result.duration}ms</span>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer">응답 데이터</summary>
                <pre className="mt-2 bg-gray-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </details>
              <details className="text-xs">
                <summary className="cursor-pointer">헤더</summary>
                <pre className="mt-2 bg-gray-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(result.headers, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </section>
      ))}
    </main>
  );
}