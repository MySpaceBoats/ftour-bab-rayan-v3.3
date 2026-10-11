import * as pro from "../pro/pro-api";
import * as mk from "../market/market-api";
import * as st from "../stay/stay-api";

export interface Msg { id: number; sender_id: number; body: string; created_at: string; read_at: string | null }
export interface Convo {
  messages: Msg[];
  other: { id: number; display_name: string; avatar: string | null };
  context: string | null;
  /** path relative to /:lang/benevole/espace/ */
  link: { path: string; label: string } | null;
  closed: boolean;
}
export interface Adapter { load(id: number): Promise<Convo>; send(id: number, body: string): Promise<unknown>; read(id: number): Promise<unknown> }

export const SOURCES: pro.InboxSource[] = ["pro", "market", "stay"];
export const SOURCE_LABEL: Record<pro.InboxSource, string> = { pro: "Pro", market: "Marketplace", stay: "Séjour" };

export const ADAPTERS: Record<pro.InboxSource, Adapter> = {
  pro: {
    load: async id => {
      const c = await pro.getMessages(id);
      return { messages: c.messages, other: c.other, context: c.job?.title ?? null, link: c.job ? { path: `pro/emplois/${c.job.id}`, label: "Voir l'offre" } : null, closed: false };
    },
    send: pro.sendMessage,
    read: pro.markRead,
  },
  market: {
    load: async id => {
      const c = await mk.listMessages(id);
      return { messages: c.messages, other: c.other, context: c.listing.title, link: { path: `marketplace/${c.listing.id}`, label: "Voir l'annonce" }, closed: false };
    },
    send: mk.sendMessage,
    read: mk.markRead,
  },
  stay: {
    load: async id => {
      const c = await st.listStayMessages(id);
      const closed = c.request.status === "declined" || c.request.status === "cancelled" || c.request.listing.status === "hidden";
      return { messages: c.messages, other: c.other, context: c.request.listing.title, link: { path: `hebergement/demandes/${c.request.id}`, label: "Voir la demande" }, closed };
    },
    send: st.sendStayMessage,
    read: st.markStayRead,
  },
};
