import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../../types';
import Button from '../ui/Button';
import { Icons } from '../icons/Icons';
import { getDevAIChatResponse } from '../../services/gemini';
import Card from '../ui/Card';

const DevAIPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', text: 'Hello! I am DevAI. How can I help you with your deployments or code today?', sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
        const aiResponseText = await getDevAIChatResponse(messages, input);
        const aiMessage: ChatMessage = { id: (Date.now() + 1).toString(), text: aiResponseText, sender: 'ai' };
        setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
        const errorMessage: ChatMessage = { id: (Date.now() + 1).toString(), text: 'Sorry, something went wrong.', sender: 'ai' };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="mb-6">
         <h1 className="text-3xl font-bold text-on-background">DevAI Assistant</h1>
         <p className="text-on-surface-variant mt-1">Your personal AI co-pilot for development and deployment.</p>
      </div>
      
      <Card className="flex-1 flex flex-col p-0 min-h-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-start gap-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
              {msg.sender === 'ai' && <div className="p-2.5 rounded-full bg-primary-container text-primary flex-shrink-0"><Icons.DevAI size={20} /></div>}
              <div className={`max-w-[85%] px-5 py-3 rounded-2xl ${msg.sender === 'ai' ? 'bg-surface-variant rounded-tl-none' : 'bg-primary text-on-primary rounded-br-none'}`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-full bg-primary-container text-primary"><Icons.DevAI size={20} /></div>
              <div className="max-w-xl px-5 py-3 rounded-2xl bg-surface-variant rounded-tl-none">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="p-4 border-t border-outline/30 bg-surface rounded-b-2xl">
          <div className="flex items-center gap-4 bg-surface-variant p-2 rounded-full">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask DevAI anything..."
              className="flex-1 bg-transparent px-4 py-2 focus:outline-none text-on-surface-variant placeholder:text-on-surface-variant/70"
              disabled={isLoading}
            />
            <Button variant="filled" onClick={handleSend} disabled={isLoading} className="rounded-full !p-3">
              <Icons.Send size={20} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DevAIPage;