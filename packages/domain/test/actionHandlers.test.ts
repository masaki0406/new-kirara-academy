import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateRooting,
  applyRooting,
  validatePass,
  applyPass,
  validateLabActivate,
  validateLensActivate,
  applyLensActivate,
  validateCollect,
  applyCollect,
  validateWill,
  applyWill,
} from '@domain/actionHandlers';
import { TurnOrderImpl } from '@domain/turnOrder';
import {
  ActionContext,
  GameState,
  PlayerAction,
  Ruleset,
  PlayerId,
} from '@domain/types';

const baseRuleset: Ruleset = {
  version: 'test',
  resourceCaps: { light: 6, rainbow: 6, stagnation: 6 },
  endgameConversions: { light: 0, rainbow: 0, stagnation: 0 },
  characters: {
    hero: {
      characterId: 'hero',
      name: 'Hero',
      nodes: [
        {
          nodeId: 'will-resource',
          position: '①',
          effect: {
            type: 'active',
            payload: {
              cost: { creativity: 2 },
              rewards: [
                {
                  type: 'resource',
                  value: { light: 1, rainbow: 1 },
                },
                {
                  type: 'growth',
                  value: { unlockNodeId: 'nxt', vp: 5 },
                },
              ],
            },
          },
        },
        {
          nodeId: 'will-capacity',
          position: '②',
          effect: {
            type: 'active',
            payload: {
              cost: { creativity: 1 },
              setCapacityUnlimited: ['rainbow'],
              rewards: [
                {
                  type: 'resource',
                  value: { rainbow: 3 },
                },
              ],
            },
          },
        },
        {
          nodeId: 'trigger-lens-owner',
          position: '③',
          effect: {
            type: 'trigger',
            payload: {
              event: 'lensActivatedByOther',
              amount: 3,
            },
          },
        },
        {
          nodeId: 'trigger-lens-actor',
          position: '④',
          effect: {
            type: 'trigger',
            payload: {
              event: 'actionPerformed',
              actionType: 'lensActivate',
              amount: 2,
            },
          },
        },
        {
          nodeId: 'trigger-collect',
          position: '⑤',
          effect: {
            type: 'trigger',
            payload: {
              event: 'actionPerformed',
              actionType: 'collect',
              amount: 1,
            },
          },
        },
        {
          nodeId: 'trigger-slot',
          position: '⑥',
          effect: {
            type: 'trigger',
            payload: {
              event: 'developmentSlotFreed',
              amount: 1,
            },
          },
        },
      ],
    },
  },
  labs: {
    'lab-1': {
      labId: 'lab-1',
      name: 'Starter Lab',
      rewards: [
        {
          type: 'resource',
          value: { light: 1 },
        },
      ],
    },
  },
  lenses: {},
  developmentCards: {},
  tasks: {},
};

function createGameState(overrides?: Partial<GameState>): GameState {
  const players: GameState['players'] = {
    a: {
      playerId: 'a',
      displayName: 'Player A',
      characterId: 'hero',
      actionPoints: 2,
      creativity: 3,
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
      unlockedCharacterNodes: [],
    },
    b: {
      playerId: 'b',
      displayName: 'Player B',
      characterId: 'hero',
      actionPoints: 2,
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
      unlockedCharacterNodes: [],
    },
  };

  const state: GameState = {
    roomId: 'room-1',
    currentRound: 1,
    currentPhase: 'main',
    currentPlayerId: 'a',
    lifecycleStage: 'lobby',
    turnOrder: ['a', 'b'],
    players,
    board: {
      lenses: {},
      lobbySlots: [],
      publicDevelopmentCards: ['dev-1'],
    },
    developmentDeck: [],
    lensDeck: [],
    tasks: {},
    logs: [],
  };

  return {
    ...state,
    ...overrides,
    players: {
      ...state.players,
      ...(overrides?.players ?? {}),
    },
  };
}

function createContext(gameState: GameState, turnOrder?: TurnOrderImpl): ActionContext {
  return {
    gameState,
    ruleset: baseRuleset,
    timestamp: Date.now(),
    turnOrder,
  };
}

describe('rooting action', () => {
  it('allows rooting when no one has rooted yet', async () => {
    const gameState = createGameState();
    const result = await validateRooting({
      playerId: 'a',
      actionType: 'rooting',
      payload: {},
    }, createContext(gameState));

    expect(result).toHaveLength(0);
  });

  it('prevents rooting if another player already rooted', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          isRooting: true,
        },
      },
    });

    const result = await validateRooting({
      playerId: 'b',
      actionType: 'rooting',
      payload: {},
    }, createContext(gameState));

    expect(result).toContain('根回しはこのラウンドで既に行われています');
  });

  it('applies rooting effects (flag + light gain)', async () => {
    const gameState = createGameState();
    await applyRooting({
      playerId: 'a',
      actionType: 'rooting',
      payload: {},
    }, createContext(gameState));

    expect(gameState.players.a.isRooting).toBe(true);
    expect(gameState.players.a.resources.light).toBe(1);
  });
});

describe('pass action', () => {
  let turnOrder: TurnOrderImpl;
  let gameState: GameState;

  beforeEach(() => {
    turnOrder = new TurnOrderImpl();
    turnOrder.setInitialOrder(['a', 'b']);
    gameState = createGameState();
  });

  it('validates current player and prevents double pass', async () => {
    const context = createContext(gameState, turnOrder);
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'pass',
      payload: {},
    };

    expect(await validatePass(action, context)).toHaveLength(0);

    // mark pass once and try again
    await applyPass(action, context);
    expect(gameState.players.a.hasPassed).toBe(true);
    const secondAttempt = await validatePass(action, context);
    expect(secondAttempt).toContain('既にパスしています');
  });

  it('advances turn order to next player when passing', async () => {
    const context = createContext(gameState, turnOrder);
    await applyPass({ playerId: 'a', actionType: 'pass', payload: {} }, context);

    expect(gameState.currentPlayerId).toBe('b');
    expect(turnOrder.current()).toBe('b');
    expect(gameState.players.a.hasPassed).toBe(true);
  });
});

describe('will action', () => {
  it('validates cost and applies rewards', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          creativity: 3,
          unlockedCharacterNodes: ['will-resource'],
        },
      },
    });

    const context = createContext(gameState);
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'will',
      payload: { nodeId: 'will-resource' },
    };

    expect(await validateWill(action, context)).toHaveLength(0);
    await applyWill(action, context);

    expect(gameState.players.a.creativity).toBe(1);
    expect(gameState.players.a.resources.light).toBe(1);
    expect(gameState.players.a.resources.rainbow).toBe(1);
    expect(gameState.players.a.unlockedCharacterNodes).toContain('nxt');
    expect(gameState.players.a.vp).toBe(5);
  });

  it('fails when creativity is insufficient', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          creativity: 1,
          unlockedCharacterNodes: ['will-resource'],
        },
      },
    });

    const context = createContext(gameState);
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'will',
      payload: { nodeId: 'will-resource' },
    };

    const errors = await validateWill(action, context);
    expect(errors).toContain('創造力が不足しています');
  });

  it('allows capacity unlock before granting resources', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          creativity: 2,
          resources: {
            light: 0,
            rainbow: 6,
            stagnation: 0,
            maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
          },
          unlockedCharacterNodes: ['will-capacity'],
        },
      },
    });

    const context = createContext(gameState);
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'will',
      payload: { nodeId: 'will-capacity' },
    };

    expect(await validateWill(action, context)).toHaveLength(0);
    await applyWill(action, context);

    expect(gameState.players.a.creativity).toBe(1);
    expect(gameState.players.a.resources.rainbow).toBe(9);
    expect(gameState.players.a.resources.unlimited?.rainbow).toBe(true);
  });
});

describe('trigger events', () => {
  it('awards lens owner when another player activates their lens', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          characterId: 'hero',
          unlockedCharacterNodes: ['trigger-lens-owner'],
        },
        b: {
          ...createGameState().players.b,
          characterId: 'hero',
          unlockedCharacterNodes: [],
        },
      },
      currentPlayerId: 'b',
      board: {
        lenses: {
          lens1: {
            lensId: 'lens1',
            ownerId: 'a',
            cost: {},
            rewards: [],
            slots: 1,
            tags: [],
            status: 'available',
          },
        },
        lobbySlots: [
          {
            lensId: 'lens1',
            ownerId: 'a',
            occupantId: 'b',
            isActive: true,
          },
        ],
        publicDevelopmentCards: ['dev-1'],
      },
    });

    const context = createContext(gameState);
    const action: PlayerAction = {
      playerId: 'b',
      actionType: 'lensActivate',
      payload: { lensId: 'lens1' },
    };

    expect(await validateLensActivate(action, context)).toHaveLength(0);
    await applyLensActivate(action, context);

    expect(gameState.players.a.vp).toBe(3);
  });

  it('awards actor when they have lens activation trigger', async () => {
    const base = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          characterId: 'hero',
          unlockedCharacterNodes: ['trigger-lens-actor'],
        },
      },
      board: {
        lenses: {
          lens1: {
            lensId: 'lens1',
            ownerId: 'a',
            cost: {},
            rewards: [],
            slots: 1,
            tags: [],
            status: 'available',
          },
        },
        lobbySlots: [
          {
            lensId: 'lens1',
            ownerId: 'a',
            occupantId: undefined,
            isActive: true,
          },
        ],
        publicDevelopmentCards: ['dev-1'],
      },
    });

    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'lensActivate',
      payload: { lensId: 'lens1' },
    };

    const context = createContext(base);
    expect(await validateLensActivate(action, context)).toHaveLength(0);
    await applyLensActivate(action, context);

    expect(base.players.a.vp).toBe(2);
  });

  it('applies collect and slot triggers', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          actionPoints: 2,
          characterId: 'hero',
          unlockedCharacterNodes: ['trigger-collect', 'trigger-slot'],
        },
      },
      board: {
        lenses: {},
        lobbySlots: [],
        publicDevelopmentCards: ['dev-1', 'dev-2'],
      },
      developmentDeck: ['dev-3'],
    });

    const context = createContext(gameState);
    const action: PlayerAction = {
      playerId: 'a',
      actionType: 'collect',
      payload: { slotIndex: 0 },
    };

    expect(await validateCollect(action, context)).toHaveLength(0);
    await applyCollect(action, context);

    expect(gameState.players.a.vp).toBe(2);
    expect(gameState.board.publicDevelopmentCards.length).toBe(2);
  });
});

describe('lab activation capacity check', () => {
  it('prevents activation when resource cap would overflow', async () => {
    const gameState = createGameState({
      players: {
        a: {
          ...createGameState().players.a,
          resources: {
            light: 6,
            rainbow: 0,
            stagnation: 0,
            maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
          },
        },
      },
    });

    const errors = await validateLabActivate({
      playerId: 'a',
      actionType: 'labActivate',
      payload: { labId: 'lab-1' },
    }, createContext(gameState));

    expect(errors).toContain('light の上限を超えます');
  });
});
