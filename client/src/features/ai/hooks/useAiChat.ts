/**
 * useAiChat – Streaming chat hook
 *
 * Connects to POST /api/ai/chat/stream (SSE) and accumulates delta tokens
 * into a local message list. Persists conversationId in sessionStorage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
}

const SESSION_KEY = "ai_conversation_id";

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(
    () => sessionStorage.getItem(SESSION_KEY)
  );

  const abortRef = useRef<AbortController | null>(null);

  const listQuery = trpc.ai.listConversations.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const deleteConvMutation = trpc.ai.deleteConversation.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  // Persist conversationId
  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem(SESSION_KEY, conversationId);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      setError(null);

      // Add user message immediately
      const userMsg: ChatMessage = {
        id: uuid(),
        role: "user",
        content: text.trim(),
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, userMsg]);

      // Placeholder for assistant response
      const assistantId = uuid();
      setMessages(prev => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", createdAt: new Date(), isStreaming: true },
      ]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/chat/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            message: text.trim(),
            conversationId: conversationId ?? undefined,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const payload = line.slice(6).trim();
              try {
                const data = JSON.parse(payload);
                if (currentEvent === "conversation" && data.conversationId) {
                  setConversationId(data.conversationId);
                  listQuery.refetch();
                } else if (currentEvent === "delta" && data.delta) {
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantId
                        ? { ...m, content: m.content + data.delta }
                        : m
                    )
                  );
                } else if (currentEvent === "error") {
                  setError(data.message ?? "Erreur inconnue");
                } else if (currentEvent === "done") {
                  listQuery.refetch();
                }
              } catch {
                // ignore malformed SSE line
              }
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        // Mark assistant message as done
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, isStreaming, listQuery]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const newConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    abortRef.current?.abort();
  }, []);

  const loadConversation = useCallback(
    (id: string, title?: string) => {
      setConversationId(id);
      setMessages([]);
      setError(null);
      // Title is shown in the UI; we don't re-fetch full history here
      // (could be added as an enhancement)
    },
    []
  );

  const deleteConversation = useCallback(
    (id: string) => {
      deleteConvMutation.mutate({ conversationId: id });
      if (id === conversationId) newConversation();
    },
    [conversationId, deleteConvMutation, newConversation]
  );

  return {
    messages,
    isStreaming,
    error,
    conversationId,
    conversations: listQuery.data ?? [],
    sendMessage,
    stopStreaming,
    newConversation,
    loadConversation,
    deleteConversation,
  };
}
