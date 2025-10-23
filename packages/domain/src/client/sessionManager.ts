import { GameState } from '../types';
import { SessionStore, StatePatch } from '../sessionStore';

export interface SessionManagerDeps {
  store: SessionStore<GameState>;
  fetchLatestState: (roomId: string) => Promise<GameState>;
}

export class SessionManager {
  constructor(private readonly deps: SessionManagerDeps) {}

  async getOrLoad(roomId: string): Promise<GameState> {
    const cached = await this.deps.store.getSnapshot();
    if (cached && cached.roomId === roomId) {
      return cloneState(cached);
    }
    const remote = await this.deps.fetchLatestState(roomId);
    await this.deps.store.saveSnapshot(remote);
    return cloneState(remote);
  }

  async refresh(roomId: string): Promise<GameState> {
    const remote = await this.deps.fetchLatestState(roomId);
    await this.deps.store.saveSnapshot(remote);
    return cloneState(remote);
  }

  async replaceSnapshot(state: GameState): Promise<void> {
    await this.deps.store.saveSnapshot(state);
  }

  async applyPatch(patch: StatePatch<GameState>): Promise<GameState> {
    const updated = await this.deps.store.applyPatch(patch);
    return cloneState(updated);
  }

  async clear(): Promise<void> {
    await this.deps.store.clear();
  }
}

function cloneState<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
