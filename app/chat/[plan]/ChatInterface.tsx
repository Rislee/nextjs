// app/chat/[plan]/ChatInterface.tsx
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
  const [threadId, setThreadId] = useState<string | null>(existingThreadId);
  const [error, setError] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 자동 스크롤
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 초기 환영 메시지
  useEffect(() => {
    if (existingThreadId) {
      // 기존 Thread가 있으면 이어서 대화
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `안녕하세요! ${planTitle} 이전 대화를 이어서 진행하겠습니다. 무엇을 도와드릴까요?`,
        timestamp: new Date()
      }]);
    } else {
      // 새로운 Thread
      setMessages([{
        id: 'welcome',
        role: 'assistant', 
        content: `안녕하세요! ${planTitle}에 오신 것을 환영합니다. 무엇을 도와드릴까요?`,
        timestamp: new Date()
      }]);
    }
  }, [existingThreadId, planTitle]);

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
          threadId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Thread ID 업데이트 (새로 생성된 경우)
      if (data.threadId && !threadId) {
        setThreadId(data.threadId);
      }

      // Assistant 응답 추가
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error: any) {
      console.error('Chat error:', error);
      setError(error.message || '메시지 전송에 실패했습니다.');
      
      // 에러 메시지 표시
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

  // 새 대화 시작
  const startNewChat = () => {
    setMessages([{
      id: 'welcome-new',
      role: 'assistant',
      content: `안녕하세요! ${planTitle} 새로운 대화를 시작하겠습니다. 무엇을 도와드릴까요?`,
      timestamp: new Date()
    }]);
    setThreadId(null);
    setInput('');
    setError('');
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
    
    // 자동 높이 조정
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{planTitle}</h1>
          <p className="text-sm text-gray-500">{userEmail}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={startNewChat}
            className="rounded-md bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-sm transition-colors"
          >
            새 대화
          </button>
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
                    : 'bg-white border'
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
              <div className="bg-white border rounded-lg px-4 py-2">
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
            Thread ID: {threadId || '새 대화'}
          </div>
        </div>
      </div>
    </div>
  );
}