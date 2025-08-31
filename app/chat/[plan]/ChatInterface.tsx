// app/chat/[plan]/ChatInterface.tsx - 쓰레드 목록 포함
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

  // 자동 스크롤
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

  // 초기 쓰레드 목록 로드
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
        content: `안녕하세요! ${planTitle}에 오신 것을 환영합니다. 무엇을 도와드릴까요?`,
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

    // 여기에 쓰레드 메시지 히스토리 로드 로직 추가 가능
    // 현재는 간단한 환영 메시지로 대체
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

      // Thread ID 업데이트 (새로 생성된 경우)
      if (data.threadId && !currentThreadId) {
        setCurrentThreadId(data.threadId);
        // 쓰레드 목록 새로고침
        loadThreads();
      }

      // Assistant 응답 추가
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // 쓰레드 목록 업데이트 (마지막 메시지 정보)
      if (data.threadId) {
        setThreads(prev => {
          const existingIndex = prev.findIndex(t => t.id === data.threadId);
          const threadInfo: ThreadInfo = {
            id: data.threadId,
            title: input.length > 30 ? input.substring(0, 30) + '...' : input,
            lastMessage: data.response.length > 50 ? data.response.substring(0, 50) + '...' : data.response,
            updatedAt: new Date(),
            messageCount: messages.length + 2 // user + assistant
          };

          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = threadInfo;
            // 최근 업데이트된 것이 맨 위로
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

  // Enter 키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Textarea 자동 높이 조정
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  };

  return (
    <div className="flex h-full bg-white">
      {/* 사이드바 - 쓰레드 목록 */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-gray-50 border-r flex flex-col`}>
        {/* 사이드바 헤더 */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">대화 목록</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <button
            onClick={startNewChat}
            className="w-full mt-3 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-blue-700 transition-colors"
          >
            + 새 대화
          </button>
        </div>

        {/* 쓰레드 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="p-4 text-sm text-gray-500">대화 목록을 불러오는 중...</div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">아직 대화가 없습니다.</div>
          ) : (
            <div className="p-2 space-y-2">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => selectThread(thread.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    currentThreadId === thread.id
                      ? 'bg-blue-100 border border-blue-200'
                      : 'hover:bg-white border border-transparent'
                  }`}
                >
                  <div className="font-medium text-sm truncate">{thread.title}</div>
                  <div className="text-xs text-gray-500 truncate mt-1">{thread.lastMessage}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {thread.updatedAt.toLocaleDateString()} • {thread.messageCount}개 메시지
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 메인 채팅 영역 */}
      <div className="flex-1 flex flex-col">
        {/* 헤더 */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-lg font-semibold">{planTitle}</h1>
              <p className="text-sm text-gray-500">{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="rounded-md border hover:bg-gray-50 px-3 py-1.5 text-sm transition-colors"
            >
              대시보드
            </a>
          </div>
        </header>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 border'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                  <div className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 border rounded-lg px-4 py-2">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="bg-white border-t px-6 py-4">
          <div className="max-w-3xl mx-auto">
            {error && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                {error}
              </div>
            )}
            
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ minHeight: '42px', maxHeight: '150px' }}
                  disabled={loading}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                style={{ height: '42px' }}
              >
                {loading ? '전송중...' : '전송'}
              </button>
            </div>
            
            <div className="text-xs text-gray-500 mt-2">
              Thread ID: {currentThreadId || '새 대화'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}