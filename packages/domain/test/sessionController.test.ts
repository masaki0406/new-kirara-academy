import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameState, PlayerAction } from '../src/types';
import { InMemorySessionStore } from '../src/sessionStore';
import { SessionManager } from '../src/client/sessionManager';
import { SessionController, ActionPerformer } from '../src/client/sessionController';

describe('SessionController', () => {
  const roomId = 'room-123';
  let remoteState: GameState;
  let gateway: ActionPerformer;
  let controller: SessionController;

  beforeEach(() => {
    remoteState = createState(roomId);
    const getRoomState = vi.fn(async () => clone(remoteState));
    const performAction = vi.fn(async (_roomId: string, action: PlayerAction) => {
      if (action.actionType === 'pass') {
        remoteState = {
          ...remoteState,
          players: {
            ...remoteState.players,
            [action.playerId]: {
              ...remoteState.players[action.playerId],
              hasPassed: true,
            },
          },
        };
        return { success: true };
      }
      return { success: false, errors: ['unknown action'] };
    });

    gateway = {
      getRoomState,
      performAction,
    };

    const store = new InMemorySessionStore<GameState>();
    const sessionManager = new SessionManager({
      store,
      fetchLatestState: gateway.getRoomState,
    });

    controller = new SessionController({
      roomId,
      sessionManager,
      gateway,
      timestampProvider: () => 1728400000000,
    });
  });

  it('initializes from session manager and notifies listeners', async () => {
    const listener = vi.fn();
    controller.onStateChange(listener);
    const initial = await controller.initialize();

    expect(initial.roomId).toBe(roomId);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].roomId).toBe(roomId);
  });

  it('performs action and refreshes state on success', async () => {
    await controller.initialize();
    const result = await controller.performAction({
      playerId: 'player-1',
      actionType: 'pass',
      payload: {},
    });

    expect(result.success).toBe(true);
    const state = controller.getState();
    expect(state?.players?.['player-1']?.hasPassed).toBe(true);
    expect(gateway.performAction).toHaveBeenCalledWith(roomId, expect.any(Object), expect.any(Number));
  });

  it('supports manual refresh', async () => {
    await controller.initialize();
    remoteState = {
      ...remoteState,
      currentRound: 2,
    };
    const refreshed = await controller.refresh();
    expect(refreshed.currentRound).toBe(2);
  });
});

function createState(id: string): GameState {
  return {
    roomId: id,
    currentRound: 1,
    currentPhase: 'setup',
    currentPlayerId: 'player-1',
    lifecycleStage: 'lobby',
    turnOrder: ['player-1'],
    players: {
      'player-1': {
        playerId: 'player-1',
        displayName: 'P1',
        isHost: true,
        isReady: false,
        actionPoints: 0,
        creativity: 0,
        vp: 0,
        resources: {
          light: 0,
          rainbow: 0,
          stagnation: 0,
          maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
        },
        hand: [],
        ownedLenses: [],
        tasksCompleted: [],
        hasPassed: false,
        isRooting: false,
        unlockedCharacterNodes: [],
      },
    },
    board: {
      lenses: {},
      lobbySlots: [],
      publicDevelopmentCards: [],
      publicVpCards: [],
    },
    developmentDeck: [],
    vpDeck: [],
    lensDeck: [],
    tasks: {},
    logs: [],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
