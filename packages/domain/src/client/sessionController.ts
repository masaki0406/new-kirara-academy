import { SessionManager } from './sessionManager';
import { ActionResult, AdjustPlayerForTestPayload, GameState, PlayerAction } from '../types';

export interface ActionPerformer {
  performAction(roomId: string, action: PlayerAction, timestamp?: number): Promise<ActionResult>;
  getRoomState(roomId: string): Promise<GameState>;
  adjustPlayerForTest(roomId: string, payload: AdjustPlayerForTestPayload): Promise<void>;
}

export interface SessionControllerDeps {
  roomId: string;
  sessionManager: SessionManager;
  gateway: ActionPerformer;
  timestampProvider?: () => number;
}

export type SessionListener = (state: GameState) => void;

export class SessionController {
  private currentState: GameState | null = null;

  private readonly listeners = new Set<SessionListener>();

  private readonly roomId: string;

  private readonly sessionManager: SessionManager;

  private readonly gateway: ActionPerformer;

  private readonly timestampProvider: () => number;

  constructor(deps: SessionControllerDeps) {
    this.roomId = deps.roomId;
    this.sessionManager = deps.sessionManager;
    this.gateway = deps.gateway;
    this.timestampProvider = deps.timestampProvider ?? (() => Date.now());
  }

  async initialize(): Promise<GameState> {
    this.currentState = await this.sessionManager.getOrLoad(this.roomId);
    this.emit();
    return cloneState(this.currentState);
  }

  async refresh(): Promise<GameState> {
    this.currentState = await this.sessionManager.refresh(this.roomId);
    this.emit();
    return cloneState(this.currentState);
  }

  getState(): GameState | null {
    return this.currentState ? cloneState(this.currentState) : null;
  }

  onStateChange(listener: SessionListener): () => void {
    this.listeners.add(listener);
    if (this.currentState) {
      listener(cloneState(this.currentState));
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  async performAction(action: PlayerAction): Promise<ActionResult> {
    const timestamp = this.timestampProvider();
    const result = await this.gateway.performAction(this.roomId, action, timestamp);
    if (result.success) {
      this.currentState = await this.sessionManager.refresh(this.roomId);
      this.emit();
    }
    return result;
  }

  async adjustPlayerForTest(payload: AdjustPlayerForTestPayload): Promise<void> {
    await this.gateway.adjustPlayerForTest(this.roomId, payload);
    this.currentState = await this.sessionManager.refresh(this.roomId);
    this.emit();
  }

  async clear(): Promise<void> {
    await this.sessionManager.clear();
    this.currentState = null;
    this.emit();
  }

  private emit(): void {
    if (!this.currentState) {
      return;
    }
    const snapshot = cloneState(this.currentState);
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

function cloneState<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
