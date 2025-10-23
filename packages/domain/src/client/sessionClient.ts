import { FunctionsGateway, FunctionsGatewayOptions } from './functionsGateway';
import { SessionManager } from './sessionManager';
import { SessionController, SessionControllerDeps } from './sessionController';
import { InMemorySessionStore, SessionStore } from '../sessionStore';
import { GameState } from '../types';

export interface SessionClientOptions extends Omit<FunctionsGatewayOptions, 'fetchImpl'> {
  roomId: string;
  fetchImpl?: typeof fetch;
  store?: SessionStore<GameState>;
  timestampProvider?: () => number;
}

export function createSessionClient(options: SessionClientOptions): SessionController {
  const {
    roomId,
    baseUrl,
    fetchImpl,
    store = new InMemorySessionStore<GameState>(),
    defaultHeaders,
    timestampProvider,
  } = options;

  const gateway = new FunctionsGateway({
    baseUrl,
    fetchImpl,
    defaultHeaders,
  });

  const sessionManager = new SessionManager({
    store,
    fetchLatestState: (room) => gateway.getRoomState(room),
  });

  const deps: SessionControllerDeps = {
    roomId,
    sessionManager,
    gateway,
    timestampProvider,
  };

  return new SessionController(deps);
}
