import { WebSocket, WebSocketServer } from "ws";
import type { JourneyState } from "./state.js";

const clients = new Set<WebSocket>();

export function journeyBroadcast(event: Record<string, unknown>) {
  const data = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * What the demo screen is allowed to see.
 *
 * The recommended save offer is for the human agent in Flex only, so it is
 * stripped here rather than merely hidden in the UI — it never leaves the
 * server on the journey socket.
 */
export function screenSafeState(state: JourneyState): JourneyState {
  if (!state.intel?.nextBestAction && !state.intel?.pendingNextBestAction) return state;
  const {
    nextBestAction: _withheld,
    pendingNextBestAction: _alsoWithheld,
    ...intel
  } = state.intel;
  return { ...state, intel };
}

/** Push the whole state so the UI never has to guess. */
export function pushState(state: JourneyState | undefined) {
  journeyBroadcast({
    type: "journey_state",
    state: state ? screenSafeState(state) : null,
  });
}

export function setupJourneyWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
  });
}
