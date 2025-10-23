import { GameState } from './types';

export interface StatePatch<T> {
  apply(state: T): T;
}

export interface SessionStore<TState> {
  getSnapshot(): Promise<TState | null>;
  saveSnapshot(state: TState): Promise<void>;
  applyPatch(patch: StatePatch<TState>): Promise<TState>;
  clear(): Promise<void>;
}

export class InMemorySessionStore<TState> implements SessionStore<TState> {
  private snapshot: TState | null = null;

  async getSnapshot(): Promise<TState | null> {
    return this.snapshot;
  }

  async saveSnapshot(state: TState): Promise<void> {
    this.snapshot = structuredClone(state);
  }

  async applyPatch(patch: StatePatch<TState>): Promise<TState> {
    if (!this.snapshot) {
      throw new Error('No snapshot to patch.');
    }
    this.snapshot = structuredClone(patch.apply(structuredClone(this.snapshot)));
    return this.snapshot;
  }

  async clear(): Promise<void> {
    this.snapshot = null;
  }
}

export class GameStatePatch implements StatePatch<GameState> {
  constructor(private readonly mutator: (state: GameState) => void) {}

  apply(state: GameState): GameState {
    this.mutator(state);
    return state;
  }
}
