import {
  ActionContext,
  ActionResult,
  GamePhase,
  GameSession,
  MutableGameState,
  PhaseManager,
  PlayerAction,
  Ruleset,
  TurnOrder,
} from './types';
import { ActionResolver } from './types';

interface GameSessionDeps {
  phaseManager: PhaseManager;
  turnOrder: TurnOrder;
  stateLoader: () => Promise<MutableGameState>;
  actionResolver: ActionResolver;
  maxRounds?: number;
  logWriter?: (entry: ActionResultLogEntry) => Promise<void>;
}

export class GameSessionImpl implements GameSession {
  public currentRound = 1;
  public currentPhase: GamePhase = 'setup';
  private readonly maxRounds: number;

  constructor(public readonly roomId: string, private readonly deps: GameSessionDeps) {
    this.maxRounds = this.deps.maxRounds ?? 4;
  }

  async start(): Promise<void> {
    const mutableState = await this.deps.stateLoader();
    this.currentPhase = 'setup';
    await this.deps.phaseManager.preparePhase(mutableState);
  }

  async advancePhase(): Promise<void> {
    const mutableState = await this.deps.stateLoader();
    switch (this.currentPhase) {
      case 'setup':
        this.currentPhase = 'main';
        await this.deps.phaseManager.mainPhase(mutableState);
        break;
      case 'main':
        this.currentPhase = 'end';
        await this.deps.phaseManager.endPhase(mutableState);
        break;
      case 'end':
        if (await this.endRoundIfNeeded()) {
          return;
        }
        this.currentPhase = 'main';
        await this.deps.phaseManager.mainPhase(mutableState);
        break;
      case 'finalScoring':
        // Nothing to do; game is over
        break;
      default:
        break;
    }
  }

  async endRoundIfNeeded(): Promise<boolean> {
    const mutableState = await this.deps.stateLoader();
    if (this.deps.turnOrder.hasAllPassed()) {
      const state = mutableState.state;
      // 終了フェーズ処理
      await this.deps.phaseManager.endPhase(mutableState);
      if (this.currentRound >= this.maxRounds) {
        await this.deps.phaseManager.finalScoring(mutableState);
        this.currentPhase = 'finalScoring';
        return true;
      }

      this.currentRound += 1;
      state.currentRound = this.currentRound;
      state.currentPhase = 'setup';
      await this.deps.phaseManager.preparePhase(mutableState);
      this.currentPhase = 'setup';
      return true;
    }
    return false;
  }

  async processAction(action: PlayerAction, ruleset: Ruleset, timestamp: number): Promise<ActionResult> {
    const mutableState = await this.deps.stateLoader();
    const context: ActionContext = {
      gameState: mutableState.state,
      ruleset,
      timestamp,
      turnOrder: this.deps.turnOrder,
    };

    const result = await this.deps.actionResolver.resolve(action, context);
    if (result.success) {
      await mutableState.save();
      await this.writeLog({
        action,
        timestamp,
        result,
      });

      if (action.actionType === 'pass') {
        await this.endRoundIfNeeded();
      }
    }

    return result;
  }

  private async writeLog(entry: ActionResultLogEntry): Promise<void> {
    if (!this.deps.logWriter) {
      return;
    }
    await this.deps.logWriter(entry);
  }
}

export interface ActionResultLogEntry {
  action: PlayerAction;
  timestamp: number;
  result: ActionResult;
}
