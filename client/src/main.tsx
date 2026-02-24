import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { clearStoredSession, getStoredSession, isSessionExpiringSoon, setStoredSession } from "./_core/authToken";
import { I18nProvider } from "./i18n";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

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

// Utiliser l'API externe en production, locale en développement
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
          try {
            const refreshed = await trpcClient.auth.refreshSession.mutate({
              refreshToken: session.refreshToken,
            });
            setStoredSession(refreshed.session);
            localStorage.setItem('supabase_token', refreshed.session.accessToken);
            accessToken = refreshed.session.accessToken;
          } catch (error) {
            clearStoredSession();
            accessToken = '';
          }
        }

        if (!accessToken) {
          return {};
        }

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
