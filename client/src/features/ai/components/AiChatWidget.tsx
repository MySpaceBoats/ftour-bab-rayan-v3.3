/**
 * AiChatWidget – Floating AI chat available across the entire app.
 *
 * Features:
 *  - Floating button (bottom-right)
 *  - Full-screen overlay on mobile, panel on desktop
 *  - Streaming responses with typing animation
 *  - Markdown rendering (via dangerouslySetInnerHTML + simple parser)
 *  - Conversation sidebar
 *  - Keyboard: Enter to send, Shift+Enter for newline
 */

import { useEffect, useRef, useState } from "react";
import { useAiChat, type ChatMessage } from "../hooks/useAiChat";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";

// ─── Simple inline markdown → HTML ──────────────────────────────────────────
// Only processes the subset we need (bold, italic, code, lists, headings, links)
function markdownToHtml(md: string): string {
  return md
    // Escape HTML entities
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Code blocks (```...```)
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Unordered list items
    .replace(/^[*-] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    // Numbered list
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Line breaks
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    // Wrap in paragraph
    .replace(/^(.+)$/, "<p>$1</p>");
}

// ─── Message bubble ──────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={cn("flex gap-2 mb-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-green-700 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1">
          AI
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-green-700 text-white rounded-br-sm"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <>
            <span
              className="prose prose-sm dark:prose-invert max-w-none [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:bg-black/10 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-black/10 [&_pre]:p-2 [&_pre]:rounded [&_ul]:pl-4 [&_li]:list-disc"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
            />
            {msg.isStreaming && (
              <span className="inline-block w-2 h-4 bg-green-600 animate-pulse ml-0.5 rounded-sm align-middle" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Conversation list item ──────────────────────────────────────────────────
function ConversationItem({
  id,
  title,
  isActive,
  onSelect,
  onDelete,
}: {
  id: string;
  title: string | null;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer group",
        isActive ? "bg-green-100 dark:bg-green-900/30" : "hover:bg-gray-100 dark:hover:bg-gray-800"
      )}
    >
      <button
        className="flex-1 text-left text-xs text-gray-700 dark:text-gray-300 truncate"
        onClick={onSelect}
      >
        {title || "Nouvelle conversation"}
      </button>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs px-1"
        title="Supprimer"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main widget ─────────────────────────────────────────────────────────────
export default function AiChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isStreaming,
    error,
    conversationId,
    conversations,
    sendMessage,
    stopStreaming,
    newConversation,
    loadConversation,
    deleteConversation,
  } = useAiChat();

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus textarea on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!inputValue.trim() || isStreaming) return;
    sendMessage(inputValue);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
          "bg-green-700 hover:bg-green-600 text-white",
          isOpen && "rotate-45"
        )}
        aria-label="Assistant IA"
        title="Assistant IA Ftour Bab Rayan"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[min(400px,calc(100vw-3rem))] h-[min(600px,calc(100vh-8rem))] flex flex-col rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 animate-in slide-in-from-bottom-4 duration-200">

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-green-700 text-white shrink-0">
            <button
              onClick={() => setShowSidebar(s => !s)}
              className="p-1 rounded hover:bg-green-600 transition-colors"
              title="Historique"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-none">Assistant IA</p>
              <p className="text-xs text-green-200 mt-0.5">Ftour Bab Rayan</p>
            </div>
            <button
              onClick={newConversation}
              className="p-1 rounded hover:bg-green-600 transition-colors text-xs"
              title="Nouvelle conversation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            {showSidebar && (
              <div className="w-44 shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1 uppercase tracking-wide">
                  Historique
                </p>
                {conversations.length === 0 && (
                  <p className="text-xs text-gray-400 px-2 py-2">Aucune conversation</p>
                )}
                {conversations.map(conv => (
                  <ConversationItem
                    key={conv.id}
                    id={conv.id}
                    title={conv.title}
                    isActive={conv.id === conversationId}
                    onSelect={() => {
                      loadConversation(conv.id, conv.title ?? "");
                      setShowSidebar(false);
                    }}
                    onDelete={() => deleteConversation(conv.id)}
                  />
                ))}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Comment puis-je vous aider ?</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Posez-moi des questions sur les bénévoles, les réservations, les statistiques...
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 w-full mt-1">
                      {[
                        "Combien de bénévoles sont inscrits ?",
                        "Quel est le taux de remplissage des jours ?",
                        "Résume les derniers avis",
                      ].map(q => (
                        <button
                          key={q}
                          onClick={() => sendMessage(q)}
                          className="text-xs text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-gray-600 dark:text-gray-300"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}

                {error && (
                  <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-2">
                    {error}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Posez votre question..."
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all max-h-32 overflow-y-auto"
                    style={{ minHeight: "38px" }}
                  />
                  {isStreaming ? (
                    <button
                      onClick={stopStreaming}
                      className="w-9 h-9 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center shrink-0 transition-colors"
                      title="Arrêter"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim()}
                      className="w-9 h-9 rounded-xl bg-green-700 hover:bg-green-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 flex items-center justify-center shrink-0 transition-colors"
                      title="Envoyer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="text-center text-[10px] text-gray-400 mt-1.5">
                  Entrée pour envoyer · Maj+Entrée pour saut de ligne
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
