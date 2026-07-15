'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Sparkles, Activity, FileText } from 'lucide-react';

interface Source {
  title: string;
  source: string;
  section: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

interface ChatWidgetProps {
  role: 'vendor' | 'staff' | 'security' | 'fan';
}

export default function ChatWidget({ role }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [currentStreamedText, setCurrentStreamedText] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamedText, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsThinking(true);
    setCurrentStreamedText('');

    // Generate simple random session ID or retrieve from memory
    const sessionId = 'session_' + role;
    const url = `/api/v1/chat/stream?message=${encodeURIComponent(userMsg)}&role=${role}&session_id=${sessionId}`;

    try {
      const eventSource = new EventSource(url);
      
      eventSource.onmessage = (event) => {
        setIsThinking(false);
        try {
          const data = JSON.parse(event.data);
          
          if (data.token) {
            setCurrentStreamedText(prev => prev + data.token);
          }
          
          if (data.done) {
            eventSource.close();
            const finalSources: Source[] = data.sources || [];
            
            // Commit final message to list
            setCurrentStreamedText(finalText => {
              setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: finalText, 
                sources: finalSources 
              }]);
              return '';
            });
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err);
          eventSource.close();
          setIsThinking(false);
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource connection error:', err);
        eventSource.close();
        setIsThinking(false);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'I encountered a connection error. Please verify the gateway connection status.' 
        }]);
      };

    } catch (err) {
      console.error('Chat submission exception:', err);
      setIsThinking(false);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Failed to initialize chat stream.' 
      }]);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 font-sans">
      {/* Floating Action Trigger Icon */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="p-4 bg-ai-accent text-white rounded-full shadow-2xl hover:opacity-90 transition-all flex items-center justify-center gap-1 animate-bounce"
          style={{ backgroundColor: '#9B6DFF' }}
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-xs font-bold tracking-wider px-1">AI Copilot</span>
        </button>
      )}

      {/* Expanded Chat Dialog window */}
      {isOpen && (
        <div 
          className="w-80 md:w-96 h-[480px] bg-bg-surface border border-border-subtle rounded-md shadow-2xl flex flex-col justify-between overflow-hidden animate-slide-in"
          style={{ backgroundColor: '#151922', borderColor: '#2A3140' }}
        >
          {/* Header */}
          <header className="px-4 py-3 bg-bg-elevated border-b border-border-subtle flex items-center justify-between" style={{ backgroundColor: '#1E2430', borderColor: '#2A3140' }}>
            <div className="flex items-center gap-2 text-ai-accent" style={{ color: '#9B6DFF' }}>
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="font-bold text-sm text-text-primary" style={{ color: '#F2F4F8' }}>Stadium Copilot Guard</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-text-secondary hover:text-text-primary"
              style={{ color: '#8B93A7' }}
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Messages Log Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-bg-primary" style={{ backgroundColor: '#0B0E14' }}>
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <Sparkles className="w-10 h-10 text-ai-accent/70" style={{ color: 'rgba(155, 109, 255, 0.7)' }} />
                <h4 className="text-sm font-bold text-text-primary" style={{ color: '#F2F4F8' }}>Operations Assistant</h4>
                <p className="text-xs text-text-secondary leading-relaxed" style={{ color: '#8B93A7' }}>
                  Ask about concessions stock checkouts, dynamic pricing surges, or stadium policies.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}>
                <div 
                  className={`px-3 py-2 rounded max-w-[85%] text-xs leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-accent-primary text-white rounded-br-none' 
                      : 'bg-bg-elevated text-text-primary rounded-bl-none border border-border-subtle'
                  }`}
                  style={
                    msg.role === 'user' 
                      ? { backgroundColor: '#4C8DFF', color: '#FFFFFF' }
                      : { backgroundColor: '#1E2430', color: '#F2F4F8', borderColor: '#2A3140' }
                  }
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Sources attributions */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border-subtle/50 space-y-1.5" style={{ borderColor: 'rgba(42, 49, 64, 0.5)' }}>
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-text-secondary block" style={{ color: '#8B93A7' }}>
                        Sources:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((src, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-bg-surface border border-border-subtle rounded-sm text-accent-primary hover:opacity-90"
                            style={{ backgroundColor: '#151922', borderColor: '#2A3140', color: '#4C8DFF' }}
                          >
                            <FileText className="w-2.5 h-2.5" />
                            <span className="font-mono">{src.source}:{src.section}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Streamed block */}
            {currentStreamedText && (
              <div className="flex flex-col items-start space-y-1">
                <div 
                  className="px-3 py-2 rounded-bl-none text-xs leading-relaxed border border-border-subtle"
                  style={{ backgroundColor: '#1E2430', color: '#F2F4F8', borderColor: '#2A3140' }}
                >
                  <p className="whitespace-pre-wrap">{currentStreamedText}</p>
                </div>
              </div>
            )}

            {/* Loading/Thinking Bubble */}
            {isThinking && (
              <div className="flex items-center gap-1.5 text-text-secondary text-xs p-1" style={{ color: '#8B93A7' }}>
                <Activity className="w-3.5 h-3.5 animate-spin text-ai-accent" style={{ color: '#9B6DFF' }} />
                <span>Thinking grounded RAG context...</span>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Form input controls */}
          <form onSubmit={handleSubmit} className="p-3 bg-bg-elevated border-t border-border-subtle flex gap-2" style={{ backgroundColor: '#1E2430', borderColor: '#2A3140' }}>
            <input
              type="text"
              placeholder="Ask dynamic pricing rules..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-bg-surface border border-border-subtle text-text-primary rounded px-3 py-2 text-xs focus:outline-none focus:border-ai-accent"
              style={{ backgroundColor: '#151922', borderColor: '#2A3140', color: '#F2F4F8' }}
              disabled={isThinking || !!currentStreamedText}
            />
            <button
              type="submit"
              className="p-2 bg-ai-accent text-white rounded hover:opacity-90 flex items-center justify-center"
              style={{ backgroundColor: '#9B6DFF' }}
              disabled={isThinking || !!currentStreamedText || !input.trim()}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
