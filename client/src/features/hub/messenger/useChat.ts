import { useEffect, useReducer, useRef } from "react";
import { isConnected, isOnline, retain, subscribe, type ServerEvent } from "./chat-socket";

/** Retains the hub socket while mounted; re-renders on presence or connection changes; forwards every event to `onEvent`. */
export function useChat(onEvent?: (e: ServerEvent) => void) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const handler = useRef(onEvent);
  handler.current = onEvent;
  useEffect(() => {
    const release = retain();
    const off = subscribe(e => {
      if (e.type === "presence" || e.type === "presence_snapshot") bump();
      handler.current?.(e);
    });
    return () => { off(); release(); };
  }, []);
  return { isOnline, connected: isConnected() };
}
