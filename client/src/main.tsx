import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import {
  clearStoredSession,
  getStoredSession,
  isSessionExpiringSoon,
  setStoredSession,
} from "./_core/authSession";
import { I18nProvider } from "./i18n";
import "./index.css";

const queryClient = new QueryClient();

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (refreshToken: string): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          clearStoredSession();
          return null;
        }

        const payload = (await response.json()) as {
          session?: { accessToken: string; refreshToken: string; expiresAt: number | null };
        };

        if (!payload.session) {
          clearStoredSession();
          return null;
        }

        setStoredSession(payload.session);
        return payload.session.accessToken;
      } catch {
        clearStoredSession();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;

  clearStoredSession();
  window.location.href = '/connexion';
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const API_URL = import.meta.env.VITE_API_URL || '/api/trpc';

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: API_URL,
      transformer: superjson,
      async headers() {
        const session = getStoredSession();

        if (!session) {
          return {};
        }

        let accessToken = session.accessToken;
        if (isSessionExpiringSoon(session.expiresAt)) {
          accessToken = (await refreshAccessToken(session.refreshToken)) ?? '';
        }

        if (!accessToken) return {};
        return { Authorization: `Bearer ${accessToken}` };
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </QueryClientProvider>
  </trpc.Provider>
);


if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(error => {
      console.warn("[PWA] Service worker registration failed", error);
    });
  });
}
