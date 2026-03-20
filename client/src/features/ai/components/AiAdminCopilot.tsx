/**
 * AiAdminCopilot – Admin-only AI analysis dashboard.
 *
 * Features:
 *  - Pre-built analysis cards (event performance, sentiment, volunteers, anomalies)
 *  - Content generation panel (blog summary, social post, event report, email template)
 *  - Embedded chat with admin context
 *  - Markdown rendering of AI results
 */

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useAiChat } from "../hooks/useAiChat";
import { type ChatMessage } from "../hooks/useAiChat";

// ─── Markdown renderer ────────────────────────────────────────────────────────
function MarkdownContent({ content }: { content: string }) {
  const html = content
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```([\s\S]*?)```/g, "<pre class='bg-gray-100 dark:bg-gray-800 rounded p-3 overflow-x-auto text-xs'><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code class='bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs'>$1</code>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3 class='font-semibold text-base mt-3 mb-1'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='font-bold text-lg mt-4 mb-2'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='font-bold text-xl mt-4 mb-2'>$1</h1>")
    .replace(/^[*-] (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li class='ml-4 list-decimal'>$1</li>")
    .replace(/\n\n/g, "</p><p class='mb-2'>")
    .replace(/\n/g, "<br/>");

  return (
    <div
      className="text-sm text-gray-800 dark:text-gray-200 prose prose-sm dark:prose-invert max-w-none leading-relaxed"
      dangerouslySetInnerHTML={{ __html: `<p class='mb-2'>${html}</p>` }}
    />
  );
}

// ─── Analysis card ────────────────────────────────────────────────────────────
const ANALYSIS_OPTIONS = [
  {
    id: "event_performance" as const,
    label: "Performance événement",
    description: "KPIs, taux de remplissage, présence bénévoles",
    icon: "📊",
    color: "blue",
  },
  {
    id: "feedback_sentiment" as const,
    label: "Analyse sentiment",
    description: "Satisfaction, NPS, thèmes récurrents, points de friction",
    icon: "💬",
    color: "purple",
  },
  {
    id: "volunteer_activity" as const,
    label: "Activité bénévoles",
    description: "Engagement, géographie, taux de présence",
    icon: "🤝",
    color: "green",
  },
  {
    id: "anomaly_detection" as const,
    label: "Détection anomalies",
    description: "Doublons, no-shows, incohérences de données",
    icon: "🔍",
    color: "orange",
  },
];

const CONTENT_OPTIONS = [
  { id: "blog_summary" as const, label: "Résumé article blog", icon: "📝" },
  { id: "social_post" as const, label: "Post réseaux sociaux", icon: "📱" },
  { id: "event_report" as const, label: "Rapport d'événement", icon: "📋" },
  { id: "email_template" as const, label: "Template email", icon: "✉️" },
];

type AnalysisType = typeof ANALYSIS_OPTIONS[number]["id"];
type ContentType = typeof CONTENT_OPTIONS[number]["id"];

// ─── Admin chat message ────────────────────────────────────────────────────────
function AdminChatMessage({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2 mb-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-green-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-1">
          AI
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2 text-sm",
          isUser
            ? "bg-green-700 text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <>
            <MarkdownContent content={msg.content} />
            {msg.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-green-600 animate-pulse ml-0.5 rounded-sm" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function AiAdminCopilot() {
  const [activeTab, setActiveTab] = useState<"analysis" | "content" | "chat">("analysis");

  // Analysis state
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisType | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const analysisMutation = trpc.ai.adminAnalysis.useMutation({
    onSuccess: data => setAnalysisResult(data.result),
  });

  // Content generation state
  const [contentType, setContentType] = useState<ContentType>("blog_summary");
  const [contentContext, setContentContext] = useState("");
  const [contentLanguage, setContentLanguage] = useState<"fr" | "ar" | "en">("fr");
  const [generatedContent, setGeneratedContent] = useState("");
  const contentMutation = trpc.ai.generateContent.useMutation({
    onSuccess: data => setGeneratedContent(data.content),
  });

  // Chat
  const {
    messages,
    isStreaming,
    error: chatError,
    sendMessage,
    stopStreaming,
    newConversation,
  } = useAiChat();
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const handleAnalysis = (type: AnalysisType) => {
    setSelectedAnalysis(type);
    setAnalysisResult("");
    analysisMutation.mutate({ type });
  };

  const handleContentGen = () => {
    if (!contentContext.trim()) return;
    setGeneratedContent("");
    contentMutation.mutate({ type: contentType, context: contentContext, language: contentLanguage });
  };

  const handleChatSend = () => {
    if (!chatInput.trim() || isStreaming) return;
    sendMessage(chatInput);
    setChatInput("");
  };

  const tabs = [
    { id: "analysis" as const, label: "Analyses IA", icon: "📊" },
    { id: "content" as const, label: "Génération", icon: "✍️" },
    { id: "chat" as const, label: "Chat Copilot", icon: "💬" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-green-700 flex items-center justify-center text-white text-lg">
            🤖
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              AI Copilot Admin
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Analyse intelligente · Ftour Bab Rayan
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-700 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-green-700 text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── ANALYSES TAB ────────────────────────────────────────────── */}
      {activeTab === "analysis" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Analysis cards */}
          <div className="space-y-3">
            {ANALYSIS_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => handleAnalysis(opt.id)}
                disabled={analysisMutation.isPending && selectedAnalysis === opt.id}
                className={cn(
                  "w-full text-left p-4 rounded-xl border-2 transition-all",
                  selectedAnalysis === opt.id && !analysisMutation.isPending
                    ? "border-green-600 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-green-400",
                  analysisMutation.isPending && selectedAnalysis === opt.id && "opacity-60 cursor-wait"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{opt.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                      {opt.label}
                      {analysisMutation.isPending && selectedAnalysis === opt.id && (
                        <span className="ml-2 text-xs text-green-600 animate-pulse">Analyse en cours...</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Result panel */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col min-h-64">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {selectedAnalysis
                  ? ANALYSIS_OPTIONS.find(o => o.id === selectedAnalysis)?.label
                  : "Résultat d'analyse"}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {analysisMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  Analyse en cours avec les données de la plateforme...
                </div>
              )}
              {analysisMutation.error && (
                <p className="text-sm text-red-600">{analysisMutation.error.message}</p>
              )}
              {analysisResult && !analysisMutation.isPending && (
                <>
                  <MarkdownContent content={analysisResult} />
                  <button
                    onClick={() => navigator.clipboard.writeText(analysisResult)}
                    className="mt-3 text-xs text-gray-500 hover:text-green-600 flex items-center gap-1"
                  >
                    📋 Copier le résultat
                  </button>
                </>
              )}
              {!analysisMutation.isPending && !analysisResult && (
                <p className="text-sm text-gray-400">Sélectionnez une analyse à gauche.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENT GENERATION TAB ──────────────────────────────────── */}
      {activeTab === "content" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Form */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide block mb-2">
                Type de contenu
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setContentType(opt.id)}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-all",
                      contentType === opt.id
                        ? "border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    )}
                  >
                    <span>{opt.icon}</span>
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide block mb-2">
                Langue
              </label>
              <div className="flex gap-2">
                {(["fr", "ar", "en"] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setContentLanguage(lang)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      contentLanguage === lang
                        ? "border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                    )}
                  >
                    {lang === "fr" ? "🇫🇷 Français" : lang === "ar" ? "🇲🇦 العربية" : "🇬🇧 English"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide block mb-2">
                Contexte / informations
              </label>
              <textarea
                value={contentContext}
                onChange={e => setContentContext(e.target.value)}
                placeholder="Décrivez le contenu à générer, donnez des informations clés, des statistiques, des points à mettre en avant..."
                rows={5}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            <button
              onClick={handleContentGen}
              disabled={!contentContext.trim() || contentMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-green-700 hover:bg-green-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 font-medium text-sm transition-colors"
            >
              {contentMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Génération en cours...
                </span>
              ) : (
                "Générer le contenu"
              )}
            </button>
          </div>

          {/* Generated content */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Contenu généré</p>
              {generatedContent && (
                <button
                  onClick={() => navigator.clipboard.writeText(generatedContent)}
                  className="text-xs text-gray-500 hover:text-green-600"
                >
                  📋 Copier
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 min-h-48">
              {contentMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  Rédaction en cours...
                </div>
              )}
              {contentMutation.error && (
                <p className="text-sm text-red-600">{contentMutation.error.message}</p>
              )}
              {generatedContent && !contentMutation.isPending && (
                <MarkdownContent content={generatedContent} />
              )}
              {!contentMutation.isPending && !generatedContent && (
                <p className="text-sm text-gray-400">Le contenu généré apparaîtra ici.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CHAT TAB ────────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col h-[calc(100vh-16rem)]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                <span className="text-4xl">🤖</span>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Posez-moi n'importe quelle question sur la plateforme
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 w-full max-w-lg">
                  {[
                    "Quels sont les 5 jours avec le plus d'inscrits ?",
                    "Résume les problèmes signalés dans les feedbacks",
                    "Quels bénévoles ont été présents le plus souvent ?",
                    "Quelle est notre note de satisfaction globale ?",
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-gray-600 dark:text-gray-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(msg => (
              <AdminChatMessage key={msg.id} msg={msg} />
            ))}
            {chatError && (
              <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                {chatError}
              </p>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex gap-2 items-end">
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSend();
                  }
                }}
                placeholder="Posez une question sur vos données..."
                rows={2}
                className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 max-h-28 overflow-y-auto"
              />
              <div className="flex flex-col gap-1">
                {isStreaming ? (
                  <button
                    onClick={stopStreaming}
                    className="w-9 h-9 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim()}
                    className="w-9 h-9 rounded-xl bg-green-700 hover:bg-green-600 disabled:bg-gray-200 text-white disabled:text-gray-400 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={newConversation}
                  title="Nouvelle conversation"
                  className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-green-600 hover:border-green-400 flex items-center justify-center"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
