// components/dashboard/DashboardClient.tsx
'use client';

import { useEffect, useState } from "react";
import type { PlanId } from "@/lib/plan";
import { PLAN_TO_TITLE, ALL_PLANS } from "@/lib/plan";

type Payment = {
  id: string;
  plan_id: PlanId;
  status: string;
  amount: number | null;
  currency: string | null;
  created_at: string;
};

type ActivePlan = {
  plan_id: PlanId;
  status: "active";
  activated_at: string;
  expires_at: string | null;
  updated_at: string;
};

interface DashboardClientProps {
  isAdmin?: boolean;
  userEmail?: string;
}

function planToUrlParam(planId: PlanId): string {
  return planId.toLowerCase().replace('_', '-');
}

const planColors: Record<PlanId, string> = {
  START_OS: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  SIGNATURE_OS: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  MASTER_OS: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
};

export default function DashboardClient({ isAdmin = false, userEmail = "" }: DashboardClientProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activePlans, setActivePlans] = useState<ActivePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let gone = false;
    (async () => {
      setLoading(true);
      setError("");
      
      try {
        const res = await fetch("/api/me/summary", { 
          credentials: "include",
          cache: "no-store"
        });
        
        if (gone) return;

        if (res.status === 401) {
          console.log("Unauthorized, redirecting to login...");
          window.location.assign("/auth/sign-in?next=/dashboard");
          return;
        }
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("summary fetch failed:", res.status, errorText);
          setError(`데이터를 불러올 수 없습니다. (${res.status})`);
          setLoading(false);
          return;
        }
        
        const json = await res.json();
        setActivePlans(json.activePlans ?? []);
        setPayments(json.payments ?? []);
        setLoading(false);
        
      } catch (err: any) {
        if (gone) return;
        console.error("Dashboard fetch error:", err);
        setError(err?.message || "네트워크 오류가 발생했습니다.");
        setLoading(false);
      }
    })();
    
    return () => { gone = true; };
  }, []);

  const ownedPlanIds = activePlans.map(plan => plan.plan_id);
  const purchasablePlans = ALL_PLANS.filter(planId => !ownedPlanIds.includes(planId));

  if (error) {
    return (
      <div className="inneros-page" style={{ padding: '24px' }}>
        <div className="inneros-container">
          <div className="inneros-card" style={{ 
            textAlign: 'center', 
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <div style={{ color: '#ef4444', marginBottom: '16px' }}>
              <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24" style={{ margin: '0 auto' }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <p style={{ color: '#ef4444', margin: '0 0 16px 0' }}>{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="inneros-button"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inneros-page" style={{ padding: '24px 0' }}>
      <div className="inneros-container">
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '40px'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '32px', 
              fontWeight: '600', 
              color: 'var(--text-primary)', 
              margin: '0 0 8px 0' 
            }}>
              내 계정
            </h1>
            {userEmail && (
              <p style={{ 
                color: 'var(--text-secondary)', 
                fontSize: '16px', 
                margin: '0' 
              }}>
                {userEmail}
              </p>
            )}
          </div>
          {isAdmin && (
            <a
              href="/admin/memberships"
              className="inneros-button-secondary"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                textDecoration: 'none'
              }}
            >
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              관리자 페이지
            </a>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '400px' 
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              color: 'var(--text-secondary)' 
            }}>
              <div className="loading-spinner" style={{
                width: '20px',
                height: '20px',
                border: '2px solid var(--border-primary)',
                borderTop: '2px solid var(--accent-color)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              플랜 정보를 불러오는 중...
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* 보유 중인 활성 플랜들 */}
            <section style={{ marginBottom: '48px' }}>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                color: 'var(--text-primary)', 
                margin: '0 0 24px 0' 
              }}>
                보유 중인 플랜
              </h2>
              
              {activePlans.length > 0 ? (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
                  gap: '24px' 
                }}>
                  {activePlans.map((plan) => (
                    <div 
                      key={plan.plan_id}
                      className="inneros-card"
                      style={{ 
                        background: planColors[plan.plan_id],
                        border: 'none',
                        color: 'white',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Background Pattern */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '120px',
                        height: '120px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '50%',
                        transform: 'translate(40px, -40px)'
                      }}></div>
                      
                      <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          marginBottom: '16px'
                        }}>
                          <div>
                            <h3 style={{ 
                              fontSize: '20px', 
                              fontWeight: '600', 
                              margin: '0 0 4px 0' 
                            }}>
                              {PLAN_TO_TITLE[plan.plan_id]}
                            </h3>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              fontSize: '14px',
                              opacity: 0.9
                            }}>
                              <span style={{
                                background: 'rgba(255, 255, 255, 0.2)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '12px'
                              }}>
                                ACTIVE
                              </span>
                              <span>
                                {new Date(plan.activated_at).toLocaleDateString()}부터
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <a
                          href={`/chat/${planToUrlParam(plan.plan_id)}`}
                          style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '12px',
                            padding: '12px 20px',
                            color: 'white',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '16px',
                            fontWeight: '500',
                            transition: 'var(--transition-base)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                          이용하기
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="inneros-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ 
                    color: 'var(--text-muted)', 
                    fontSize: '48px', 
                    marginBottom: '16px' 
                  }}>
                    🤖
                  </div>
                  <p style={{ 
                    color: 'var(--text-secondary)', 
                    fontSize: '16px', 
                    margin: '0 0 24px 0' 
                  }}>
                    아직 보유 중인 플랜이 없습니다
                  </p>
                  <p style={{ 
                    color: 'var(--text-muted)', 
                    fontSize: '14px', 
                    margin: '0' 
                  }}>
                    아래에서 플랜을 선택하여 Inner-OS를 시작해보세요
                  </p>
                </div>
              )}
            </section>

            {/* 추가 구매 가능한 플랜들 */}
            <section style={{ marginBottom: '48px' }}>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                color: 'var(--text-primary)', 
                margin: '0 0 24px 0' 
              }}>
                {activePlans.length > 0 ? "추가 구매 가능한 플랜" : "구매 가능한 플랜"}
              </h2>
              
              {purchasablePlans.length > 0 ? (
                <div className="inneros-card">
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ 
                      color: 'var(--text-secondary)', 
                      fontSize: '16px', 
                      margin: '0' 
                    }}>
                      {activePlans.length > 0 
                        ? "추가로 다른 플랜을 구매할 수 있습니다. 여러 플랜을 동시에 보유할 수 있습니다."
                        : "Inner-OS와 함께 새로운 차원의 AI 경험을 시작하세요."
                      }
                    </p>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '16px' 
                  }}>
                    {purchasablePlans.map((planId) => (
                      <a
                        key={planId}
                        href={`/checkout/${planId}`}
                        className="inneros-button-secondary"
                        style={{
                          textDecoration: 'none',
                          textAlign: 'center',
                          padding: '16px 20px',
                          background: `linear-gradient(135deg, ${planColors[planId]}, ${planColors[planId]})`,
                          backgroundSize: '200% 200%',
                          animation: 'gradientShift 3s ease infinite',
                          border: 'none',
                          color: 'white',
                          fontWeight: '500'
                        }}
                      >
                        {PLAN_TO_TITLE[planId]} 구매
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="inneros-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
                  <div style={{ 
                    color: 'var(--text-secondary)', 
                    fontSize: '40px', 
                    marginBottom: '16px' 
                  }}>
                    ✨
                  </div>
                  <p style={{ 
                    color: 'var(--text-primary)', 
                    fontSize: '18px', 
                    fontWeight: '500', 
                    margin: '0 0 8px 0' 
                  }}>
                    모든 플랜을 보유하고 계십니다!
                  </p>
                  <p style={{ 
                    color: 'var(--text-secondary)', 
                    fontSize: '14px', 
                    margin: '0' 
                  }}>
                    Inner-OS의 모든 기능을 자유롭게 이용해보세요
                  </p>
                </div>
              )}
            </section>

            {/* 결제 내역 */}
            <section>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '600', 
                color: 'var(--text-primary)', 
                margin: '0 0 24px 0' 
              }}>
                결제 내역
              </h2>
              
              {payments.length === 0 ? (
                <div className="inneros-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
                  <p style={{ 
                    color: 'var(--text-secondary)', 
                    fontSize: '16px', 
                    margin: '0' 
                  }}>
                    결제 내역이 없습니다
                  </p>
                </div>
              ) : (
                <div className="inneros-card" style={{ padding: '0' }}>
                  {payments.map((p, index) => (
                    <div 
                      key={p.id}
                      style={{ 
                        padding: '20px 24px',
                        borderBottom: index < payments.length - 1 ? '1px solid var(--border-primary)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ 
                          fontSize: '16px', 
                          fontWeight: '500', 
                          color: 'var(--text-primary)', 
                          marginBottom: '4px' 
                        }}>
                          {PLAN_TO_TITLE[p.plan_id]}
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          color: 'var(--text-secondary)' 
                        }}>
                          {new Date(p.created_at).toLocaleDateString()} • {p.status}
                        </div>
                      </div>
                      {typeof p.amount === "number" && (
                        <div style={{ 
                          fontSize: '16px', 
                          fontWeight: '600', 
                          color: 'var(--text-primary)' 
                        }}>
                          {p.amount.toLocaleString()} {p.currency || "KRW"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}