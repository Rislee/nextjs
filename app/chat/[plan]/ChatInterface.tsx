// app/chat/[plan]/ChatInterface.tsx - InnerOS 디자인 적용
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    <div className="inneros-chat-container">
      {/* 사이드바 - 쓰레드 목록 */}
      <div className={`inneros-chat-sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
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
            marginBottom: '16px'
          }}>
            <h2 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: 'var(--text-primary)',
              margin: '0'
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
                transition: 'var(--transition-base)'
              }}
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <button
            onClick={startNewChat}
            className="inneros-button"
            style={{
              width: '100%',
              fontSize: '14px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            새 대화
          </button>
        </div>

        {/* 쓰레드 목록 */}
        <div className="inneros-thread-list">
          {loadingThreads ? (
            <div style={{ 
              textAlign: 'center', 
              color: 'var(--text-secondary)', 
              fontSize: '14px',
              padding: '20px 0'
            }}>
              대화 목록을 불러오는 중...
            </div>
          ) : threads.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: 'var(--text-secondary)', 
              fontSize: '14px',
              padding: '20px 0'
            }}>
              아직 대화가 없습니다
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => selectThread(thread.id)}
                className={`inneros-thread-item ${currentThreadId === thread.id ? 'active' : ''}`}
              >
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  marginBottom: '4px',
                  textAlign: 'left'
                }}>
                  {thread.title}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  opacity: 0.7,
                  textAlign: 'left',
                  marginBottom: '4px'
                }}>
                  {thread.lastMessage}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  opacity: 0.6,
                  textAlign: 'left'
                }}>
                  {thread.updatedAt.toLocaleDateString()} • {thread.messageCount}개
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 메인 채팅 영역 */}
      <div className="inneros-chat-main">
        {/* 헤더 */}
        <div className="inneros-chat-header">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                transition: 'var(--transition-base)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'none';
              }}
            >
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
            </button>
          )}
          
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
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <a
              href="/dashboard"
              className="inneros-button-secondary"
              style={{
                textDecoration: 'none',
                fontSize: '14px',
                minHeight: '36px',
                padding: '8px 16px'
              }}
            >
              대시보드
            </a>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="inneros-chat-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`inneros-message ${message.role}`}
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
            <div className="inneros-message assistant">
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px' 
              }}>
                <div className="loading-dots">
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
                AI가 답변을 생성하고 있습니다...
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="inneros-chat-input">
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
          
          <div className="inneros-chat-input-form">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
              className="inneros-chat-textarea"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="inneros-chat-send-button"
            >
              {loading ? (
                <div className="loading-spinner" style={{
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
        
        .loading-dots {
          display: flex;
          gap: 4px;
        }
        
        .loading-dots div {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-secondary);
          animation: dot-pulse 1.5s infinite ease-in-out;
        }
        
        .loading-dots div:nth-child(1) {
          animation-delay: -0.32s;
        }
        
        .loading-dots div:nth-child(2) {
          animation-delay: -0.16s;
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
        
        /* Mobile responsive */
        @media (max-width: 768px) {
          .inneros-chat-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            height: 100vh;
            z-index: 100;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
          }
          
          .inneros-chat-sidebar:not(.collapsed) {
            transform: translateX(0);
          }
          
          .inneros-chat-sidebar.collapsed {
            width: 280px;
          }
        }
      `}</style>
    </div>
  );
}