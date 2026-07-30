import React, { useState } from 'react';
import { MessageSquare, Phone, Send, Bot, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string }>>([
    { sender: 'bot', text: 'Hello! I am your IPL Dhaba Assistant. How can I help with your food order or turf booking today?' },
  ]);
  const [inputText, setInputText] = useState('');

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = inputText;
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInputText('');

    setTimeout(() => {
      let botReply = 'I have recorded your request. Our Singarayakonda Dhaba Support Team is reviewing it right now!';
      if (userMsg.toLowerCase().includes('refund')) {
        botReply = 'Refund requests are processed automatically back to your original payment method within 24 hours.';
      } else if (userMsg.toLowerCase().includes('delivery') || userMsg.toLowerCase().includes('runner')) {
        botReply = 'Your runner is on the way! You can track live GPS coordinates on the order tracking map.';
      } else if (userMsg.toLowerCase().includes('turf') || userMsg.toLowerCase().includes('slot')) {
        botReply = 'Turf slot reservations can be rescheduled anytime via your My Orders Hub.';
      }

      setMessages((prev) => [...prev, { sender: 'bot', text: botReply }]);
    }, 800);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-4 text-white space-y-3 shadow-2xl relative h-[480px] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-extrabold text-xs text-white">IPL Dhaba AI Help Desk</h3>
                <p className="text-[9px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Live Support Agent Online
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Messages List */}
          <div className="flex-1 overflow-y-auto space-y-2 p-1 text-xs scrollbar-none">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'bot' && (
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                    AI
                  </div>
                )}
                <div
                  className={`p-2.5 rounded-2xl max-w-[80%] leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-amber-500 text-slate-950 font-medium'
                      : 'bg-slate-950 border border-slate-800 text-slate-200'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Call Agent Hotline */}
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between text-[11px] shrink-0">
            <span className="text-slate-400">Prefer phone call?</span>
            <button
              onClick={() => alert('Dialing Customer Support Helpline: +91 91234 56789')}
              className="text-amber-400 font-bold flex items-center gap-1 hover:underline"
            >
              <Phone className="w-3 h-3" />
              <span>+91 91234 56789</span>
            </button>
          </div>

          {/* Input Box */}
          <form onSubmit={handleSend} className="flex gap-2 shrink-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your question..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="bg-amber-500 text-slate-950 p-2 rounded-xl flex items-center justify-center font-bold"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
