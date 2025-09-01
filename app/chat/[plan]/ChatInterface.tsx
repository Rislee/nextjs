// app/chat/[plan]/ChatInterface.tsx - Claude 스타일 채팅 인터페이스
'use client';

import { useState, useRef, useEffect } from 'react';
import type { PlanId } from '@/lib/plan';

interface ChatInterfaceProps {
  userId: string;
  planId: PlanId;
  planTitle: string;
  userEmail: string;
  existingThreadId: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ThreadInfo {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: Date;
  messageCount: number;
}

export default function ChatInterface({
  userId,
  planId,
  planTitle,
  userEmail,
  existingThreadId
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(existingThreadId);
  const [error, setError] = useState<string>('');
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false); // 기본적으로 닫혀있음
  const [loadingThreads, setLoadingThreads] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 쓰레드 목록 로드
  const loadThreads = async () => {
    setLoadingThreads(true);
    try {
      const response = await fetch(`/api/chat/threads?planId=${planId}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setThreads(data.threads || []);
      }
    } catch (error) {
      console.error('Failed to load threads:', error);
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    loadThreads();
  }, [planId]);

  // 초기 환영 메시지
  useEffect(() => {
    if (existingThreadId) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `안녕하세요! ${planTitle} 이전 대화를 이어서 진행하겠습니다. 무엇을 도와드릴까요?`,
        timestamp: new Date()
      }]);
    } else {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `안녕하세요! ${planTitle}에 오신 것을 환영합니다. 저는 당신의 Inner-OS AI 어시스턴트입니다. 무엇을 도와드릴까요?`,
        timestamp: new Date()
      }]);
    }
  }, [existingThreadId, planTitle]);

  // 쓰레드 선택
  const selectThread = async (threadId: string) => {
    setCurrentThreadId(threadId);
    setMessages([{
      id: 'loading',
      role: 'assistant',
      content: '이전 대화를 불러오는 중...',
      timestamp: new Date()
    }]);

    setTimeout(() => {
      setMessages([{
        id: 'welcome-existing',
        role: 'assistant',
        content: `이전 대화를 이어서 진행하겠습니다. 무엇을 도와드릴까요?`,
        timestamp: new Date()
      }]);
    }, 500);
  };

  // 새 대화 시작
  const startNewChat = () => {
    setCurrentThreadId(null);
    setMessages([{
      id: 'welcome-new',
      role: 'assistant',
      content: `안녕하세요! ${planTitle} 새로운 대화를 시작하겠습니다. 무엇을 도와드릴까요?`,
      timestamp: new Date()
    }]);
    setInput('');
    setError('');
  };

  // 메시지 전송
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError('');

    // 텍스트에리어 높이 리셋
    if (textareaRef.current) {
      textareaRef.current.style.height = '52px';
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: input,
          planId,
          threadId: currentThreadId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.threadId && !currentThreadId) {
        setCurrentThreadId(data.threadId);
        loadThreads();
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.threadId) {
        setThreads(prev => {
          const existingIndex = prev.findIndex(t => t.id === data.threadId);
          const threadInfo: ThreadInfo = {
            id: data.threadId,
            title: input.length > 30 ? input.substring(0, 30) + '...' : input,
            lastMessage: data.response.length > 50 ? data.response.substring(0, 50) + '...' : data.response,
            updatedAt: new Date(),
            messageCount: messages.length + 2
          };

          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = threadInfo;
            return [threadInfo, ...updated.filter((_, i) => i !== existingIndex)];
          } else {
            return [threadInfo, ...prev];
          }
        });
      }

    } catch (error: any) {
      console.error('Chat error:', error);
      setError(error.message || '메시지 전송에 실패했습니다.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `죄송합니다. 오류가 발생했습니다: ${error.message}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      background: 'var(--bg-primary)',
      position: 'relative'
    }}>
      {/* 사이드바 - 쓰레드 목록 */}
      <div style={{
        width: sidebarOpen ? '280px' : '60px', // 닫혔을 때도 60px 보이게
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        position: 'fixed',
        left: 0,
        top: '72px', // 레이아웃 헤더 높이
        bottom: 0,
        zIndex: 20
      }}>
        {sidebarOpen ? (
          // 열린 상태 - 기존 UI
          <>
            {/* 사이드바 헤더 */}
            <div style={{ 
              padding: '20px',
              borderBottom: '1px solid var(--border-primary)',
              background: 'var(--bg-secondary)'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                height: '28px', // 고정 높이로 버튼 위치 맞춤
                marginBottom: '16px'
              }}>
                <h2 style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)',
                  margin: '0',
                  whiteSpace: 'nowrap', // 줄바꿈 방지
                  overflow: 'hidden', // 넘치는 텍스트 숨기기
                  opacity: 1,
                  transition: 'opacity 0.2s ease'
                }}>
                  대화 목록
                </h2>
                <button
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" fill="none"/>
                  </svg>
                </button>
              </div>
              
            <div style={{ position: 'relative', marginBottom: '16px', height: '44px' }}>
              <button
                onClick={startNewChat}
                style={{
                  background: 'var(--brand-color)',
                  color: 'var(--black-100)',
                  border: 'none',
                  borderRadius: sidebarOpen ? '80px' : '50%', // 조건부 radius
                  padding: sidebarOpen ? '12px 24px' : '12px', // 조건부 padding
                  fontFamily: 'var(--font-family)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: sidebarOpen ? '100%' : '44px', // 조건부 width
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarOpen ? 'center' : 'center',
                  gap: sidebarOpen ? '8px' : '0',
                  transition: 'width 0.25s ease, border-radius 0.25s ease, padding 0.25s ease',
                  position: 'absolute',
                  left: '0', // 왼쪽 끝 고정
                  whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--white)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'var(--brand-color)';
                }}
              >
                <svg width="16" height="16" fill="var(--black-100)" viewBox="0 0 24 24" stroke="var(--black-100)" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                </svg>
                {sidebarOpen && <span>새 대화</span>}
              </button>
            </div>
            </div>

            {/* 쓰레드 목록 */}
            <div style={{
              padding: '16px',
              flex: 1,
              overflowY: 'auto'
            }}>
              {loadingThreads ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: 'var(--text-secondary)', 
                  fontSize: '14px',
                  padding: '20px 0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}>
                  대화 목록을 불러오는 중...
                </div>
              ) : threads.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: 'var(--text-secondary)', 
                  fontSize: '14px',
                  padding: '20px 0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}>
                  아직 대화가 없습니다
                </div>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => selectThread(thread.id)}
                    style={{
                      background: currentThreadId === thread.id ? 'var(--accent-color)' : 'transparent',
                      color: currentThreadId === thread.id ? 'white' : 'var(--text-primary)',
                      border: '1px solid transparent',
                      borderRadius: '8px',
                      padding: '12px',
                      cursor: 'pointer',
                      marginBottom: '8px',
                      width: '100%',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      marginBottom: '4px'
                    }}>
                      {thread.title}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      opacity: 0.7,
                      marginBottom: '4px'
                    }}>
                      {thread.lastMessage}
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      opacity: 0.6
                    }}>
                      {thread.updatedAt.toLocaleDateString()} • {thread.messageCount}개
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          // 닫힌 상태 - 컴팩트 버튼들 (정확한 위치 매칭)
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 8px', // 열린 상태와 동일한 상단 패딩
            alignItems: 'center'
          }}>
            <div style={{ height: '28px', marginBottom: '16px' }}> {/* 헤더 높이와 동일 */}
              {/* 1. 사이드바 열기 버튼 */}
              <button
                onClick={() => setSidebarOpen(true)}
                title="사이드바 열기"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  width: '44px',
                  height: '28px', // 헤더의 닫기 버튼과 동일한 높이
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              </button>
            </div>

            {/* 2. 새 대화 버튼 (열린 상태와 정확히 같은 위치) */}
            <button
              onClick={startNewChat}
              title="새 대화"
              style={{
                background: 'var(--brand-color)',
                color: 'var(--black-100)',
                border: 'none',
                borderRadius: '50%', // 닫힌 상태에서는 완전한 원
                width: '44px',
                height: '44px', // 정사각형으로 만들어서 완전한 원 생성
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease', // 사이드바보다 빠른 트랜지션
                marginBottom: '16px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--white)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'var(--brand-color)';
              }}
            >
              <svg width="16" height="16" fill="var(--black-100)" viewBox="0 0 24 24" stroke="var(--black-100)" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 메인 채팅 영역 */}
      <div style={{ 
        marginLeft: sidebarOpen ? '280px' : '60px', // 닫혔을 때도 60px 마진
        transition: 'margin-left 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100vh'
      }}>
        {/* 헤더 - 고정 */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-primary)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'fixed',
          top: '72px', // 레이아웃 헤더 높이만큼
          left: sidebarOpen ? '280px' : '60px', // 닫혔을 때도 60px
          right: 0,
          zIndex: 10,
          transition: 'left 0.3s ease'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: 'var(--text-primary)',
              margin: '0'
            }}>
              {planTitle}
            </h1>
            <p style={{ 
              fontSize: '12px', 
              color: 'var(--text-secondary)',
              margin: '2px 0 0 0'
            }}>
              {userEmail}
            </p>
          </div>
        </div>

        {/* 메시지 영역 - 스크롤 가능 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginTop: '88px', // 헤더 높이만큼
          marginBottom: '120px' // 입력창 높이만큼
        }}>
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                maxWidth: '70%',
                padding: '16px',
                borderRadius: '16px',
                fontSize: '15px',
                lineHeight: '1.5',
                ...(message.role === 'user' ? {
                  background: 'var(--accent-color)',
                  color: 'white',
                  alignSelf: 'flex-end',
                  marginLeft: 'auto'
                } : {
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                  alignSelf: 'flex-start'
                })
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                {message.content}
              </div>
              <div style={{ 
                fontSize: '11px', 
                opacity: 0.6
              }}>
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          
          {loading && (
            <div style={{
              maxWidth: '70%',
              padding: '16px',
              borderRadius: '16px',
              fontSize: '15px',
              lineHeight: '1.5',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
              alignSelf: 'flex-start'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px' 
              }}>
                <div style={{
                  display: 'flex',
                  gap: '4px'
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--text-secondary)',
                    animation: 'dot-pulse 1.5s infinite ease-in-out'
                  }}></div>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--text-secondary)',
                    animation: 'dot-pulse 1.5s infinite ease-in-out -0.16s'
                  }}></div>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--text-secondary)',
                    animation: 'dot-pulse 1.5s infinite ease-in-out -0.32s'
                  }}></div>
                </div>
                AI가 답변을 생성하고 있습니다...
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 영역 - 고정 */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-primary)',
          padding: '24px',
          position: 'fixed',
          bottom: 0,
          left: sidebarOpen ? '280px' : '60px', // 닫혔을 때도 60px
          right: 0,
          transition: 'left 0.3s ease'
        }}>
          {error && (
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              color: '#ef4444',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
          
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-end',
            maxWidth: '1000px',
            margin: '0 auto'
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
              disabled={loading}
              style={{
                flex: 1,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-primary)',
                borderRadius: '12px',
                padding: '16px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-family)',
                fontSize: '16px',
                resize: 'none',
                minHeight: '52px',
                maxHeight: '120px',
                outline: 'none'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                background: 'var(--accent-color)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '16px',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                minWidth: '52px',
                height: '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading || !input.trim() ? 0.5 : 1
              }}
            >
              {loading ? (
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
              ) : (
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              )}
            </button>
          </div>
          
          <div style={{ 
            fontSize: '11px', 
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: '12px'
          }}>
            Thread ID: {currentThreadId || '새 대화'} • {planTitle}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes dot-pulse {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}