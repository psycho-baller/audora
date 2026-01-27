import { ChevronUp, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface Message {
  role: 'user' | 'bot';
  text: string;
}

export function TranscriptChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Hello! Ask me anything about your transcript or analytics.' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    const container = messagesEndRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);

    // Mock bot response
    setTimeout(() => {
      const botMessage: Message = { role: 'bot', text: 'This is a mock response. API integration coming soon!' };
      setMessages(prev => [...prev, botMessage]);
    }, 500);

    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <>
      {/* Collapsed tab - always visible when closed */}
      {!isOpen && (
        <div
          onClick={() => setIsOpen(true)}
          className="absolute bottom-8 left-12 right-12 sm:left-16 sm:right-16 bg-background border border-border rounded-full shadow-lg cursor-pointer z-50 px-4 py-2 flex items-center justify-end hover:bg-muted/50 transition-all duration-300 ease-in-out"
        >
          <ChevronUp className="w-4 h-4" />
        </div>
      )}

      {/* Expanded panel */}
      <div className={`absolute bottom-8 left-12 right-12 sm:left-16 sm:right-16 bg-background border border-border rounded-lg shadow-lg z-40 transition-all duration-300 ease-in-out ${
        isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'
      }`}>
      <div className="h-12 flex items-center justify-end px-2">
        <Button
          onClick={() => setIsOpen(false)}
          variant="ghost"
          size="icon"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="h-96 overflow-y-auto p-4 space-y-4 pr-3 custom-scrollbar">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-3 py-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex items-center gap-2 p-4 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about your transcript..."
          className="flex-1"
        />
        <Button onClick={handleSend} size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
    </>
  );
}