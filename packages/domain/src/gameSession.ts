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
    this.currentRound = mutableState.state.currentRound;
    this.currentPhase = 'setup';
    await this.deps.phaseManager.preparePhase(mutableState);
  }

  async advancePhase(): Promise<void> {
    const mutableState = await this.deps.stateLoader();
    this.currentPhase = mutableState.state.currentPhase;
    switch (this.currentPhase) {
      case 'setup':
        // Setup typically transitions to Supply now
        this.currentPhase = 'supply';
        // But if we are calling advancePhase manually, we might mean "Skip Setup/Supply"?
        // Usually preparePhase sets it to 'supply'.
        // If we are in 'setup', it means we just started.
        // Let's assume 'setup' -> 'supply' is automatic or handled by preparePhase.
        // If we are here, maybe we want to go to main?
        // Actually, preparePhase sets it to 'supply'.
        // So if currentPhase is 'supply', we wait for actions.
        // If we are in 'setup' (legacy?), go to 'main'.
        this.currentPhase = 'main';
        await this.deps.phaseManager.mainPhase(mutableState);
        break;
      case 'supply':
        this.currentPhase = 'main';
        await this.deps.phaseManager.mainPhase(mutableState);
        break;
      case 'main':
        this.currentPhase = 'end';
        await this.deps.phaseManager.endPhase(mutableState);
        break;
      case 'end':
        if (await this.endRoundIfNeeded(mutableState)) {
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

  async endRoundIfNeeded(mutableState?: MutableGameState): Promise<boolean> {
    const stateWrapper = mutableState ?? await this.deps.stateLoader();
    this.currentRound = stateWrapper.state.currentRound;
    this.currentPhase = stateWrapper.state.currentPhase;

    if (this.deps.turnOrder.hasAllPassed()) {
      console.log('[endRoundIfNeeded] All players passed. Advancing round.');
      const state = stateWrapper.state;
      // 終了フェーズ処理
      await this.deps.phaseManager.endPhase(stateWrapper);
      if (this.currentRound >= this.maxRounds) {
        await this.deps.phaseManager.finalScoring(stateWrapper);
        this.currentPhase = 'finalScoring';
        return true;
      }

      this.currentRound += 1;
      state.currentRound = this.currentRound;
      state.currentRound = this.currentRound;
      state.currentPhase = 'supply';
      await this.deps.phaseManager.preparePhase(stateWrapper);
      this.currentPhase = 'supply';
      return true;
    }
    console.log('[endRoundIfNeeded] Not all players passed.');
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
      mutableState.state.lastActionCounter = (mutableState.state.lastActionCounter ?? 0) + 1;
      mutableState.state.lastActionAt = timestamp;
      mutableState.state.lastActionBy = action.playerId;
      mutableState.state.lastActionType = action.actionType;
      if (action.actionType !== 'pass') {
        const nextPlayer = this.deps.turnOrder.nextPlayer();
        if (nextPlayer) {
          mutableState.state.currentPlayerId = nextPlayer;
        }
      }
      await mutableState.save();
      await this.writeLog({
        action,
        timestamp,
        result,
      });

      if (action.actionType === 'pass') {
        await this.endRoundIfNeeded(mutableState);
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
