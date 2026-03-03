import { useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

type ChatMessage = {
  id: string;
  from: 'lumina' | 'user';
  text: string;
  time: string;
};

function formatTime(d = new Date()) {
  return d.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LuminaWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      from: 'lumina',
      text: 'Hola 👋 Soy Lumina. ¿En qué puedo ayudarte hoy sobre tus proyectos o tareas?',
      time: formatTime(),
    },
  ]);

  const toggle = () => setIsOpen((v) => !v);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      from: 'user',
      text: trimmed,
      time: formatTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const result = await api.post<{ intent: string; answer: string }>('/api/chat', {
        message: trimmed,
      });

      const luminaMessage: ChatMessage = {
        id: `lumina-${Date.now()}`,
        from: 'lumina',
        text: result.answer,
        time: formatTime(),
      };
      setMessages((prev) => [...prev, luminaMessage]);
    } catch (error: any) {
      const luminaMessage: ChatMessage = {
        id: `lumina-error-${Date.now()}`,
        from: 'lumina',
        text:
          error instanceof Error
            ? `No pude responder en este momento: ${error.message}`
            : 'No pude responder en este momento. Intenta de nuevo más tarde.',
        time: formatTime(),
      };
      setMessages((prev) => [...prev, luminaMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {/* Botón flotante */}
      {!isOpen && (
        <button
          type="button"
          onClick={toggle}
          className="h-12 w-12 rounded-full bg-[#00C6B5] shadow-lg flex items-center justify-center hover:bg-[#00B0A1] transition-colors overflow-hidden"
          aria-label="Abrir asistente Lumina"
        >
          <Sparkles className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Panel de chat */}
      {isOpen && (
        <div className="w-80 sm:w-96 h-[32rem] max-h-[85vh] rounded-3xl shadow-xl flex flex-col overflow-hidden border border-black/5 relative">
          {/* Fondo: imagen + overlay suave para legibilidad */}
          <div
            className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat rounded-3xl"
            style={{ backgroundImage: 'url(/chat-bg.png)' }}
            aria-hidden
          />
          <div className="absolute inset-0 z-0 rounded-3xl bg-white/35" aria-hidden />
          <header className="relative z-10 flex items-center justify-between px-4 py-3 bg-[#00C6B5] text-white">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Lumina</span>
                <span className="text-[11px] text-white/80">Asistente en línea</span>
              </div>
            </div>
            <button
              type="button"
              onClick={toggle}
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/10"
              aria-label="Cerrar asistente"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="relative z-10 flex-1 px-3 py-2 overflow-y-auto space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    m.from === 'user'
                      ? 'bg-[#00C6B5] text-white rounded-br-sm'
                      : 'bg-white text-slate-900 rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-line">{m.text}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      m.from === 'user' ? 'text-white/70' : 'text-slate-400'
                    }`}
                  >
                    {m.time}
                  </p>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-xs text-slate-400 text-center mt-4">
                Aún no hay mensajes. Escribe algo para comenzar.
              </p>
            )}
          </div>

          <footer className="relative z-10 border-t border-slate-200/80 px-3 py-2 bg-white/90 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje..."
                className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C6B5]/40 focus:border-[#00C6B5]"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={isSending || !input.trim()}
                className="h-9 w-9 rounded-full bg-[#00C6B5] text-white flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#00B0A1] transition-colors"
                aria-label="Enviar mensaje"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}

