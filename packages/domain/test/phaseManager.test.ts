import { describe, it, expect, vi } from 'vitest';
import { PhaseManagerImpl } from '@domain/phaseManager';
import { TurnOrderImpl } from '@domain/turnOrder';
import { GameState, MutableGameState, Ruleset } from '@domain/types';

const ruleset: Ruleset = {
  version: 'test',
  resourceCaps: { light: 6, rainbow: 6, stagnation: 6 },
  endgameConversions: { light: 1, rainbow: 2, stagnation: 0 },
  characters: {
    hero: {
      characterId: 'hero',
      name: 'Hero',
      nodes: [
        {
          nodeId: 'n1',
          position: '①',
          effect: {
            type: 'endGame',
            payload: { kind: 'vpFlat', amount: 10 },
          },
        },
        {
          nodeId: 'n2',
          position: '②',
          effect: {
            type: 'endGame',
            payload: { kind: 'conditionalVp', amount: 20, condition: 'noLightNoRainbow' },
          },
        },
        {
          nodeId: 'n3',
          position: '③',
          effect: {
            type: 'endGame',
            payload: { kind: 'vpMultiplier', multiplier: 1.5 },
          },
        },
        {
          nodeId: 'n4',
          position: '④',
          effect: {
            type: 'endGame',
            payload: { kind: 'convertNegativeVp' },
          },
        },
      ],
    },
  },
  labs: {},
  lenses: {},
  developmentCards: {},
  tasks: {},
};

describe('PhaseManagerImpl.finalScoring', () => {
  it('converts remaining resources into VP based on ruleset', async () => {
    const turnOrder = new TurnOrderImpl();
    const phaseManager = new PhaseManagerImpl({
      turnOrder,
      ruleset,
      rulesetConfig: {
        stagnationPenalty: 2,
        initialActionPoints: 2,
        publicDevelopmentSlots: 8,
      },
    });

    const gameState: GameState = {
      roomId: 'room-1',
      currentRound: 4,
      currentPhase: 'end',
      currentPlayerId: 'a',
      lifecycleStage: 'inGame',
      turnOrder: ['a', 'b'],
      players: {
        a: {
          playerId: 'a',
          displayName: 'Player A',
          actionPoints: 0,
          creativity: 0,
          vp: 10,
          resources: {
            light: 2,
            rainbow: 1,
            stagnation: 0,
            maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
          },
          hand: [],
          ownedLenses: [],
          tasksCompleted: [],
          hasPassed: true,
          unlockedCharacterNodes: [],
        },
        b: {
          playerId: 'b',
          displayName: 'Player B',
          actionPoints: 0,
          creativity: 0,
          vp: 5,
          resources: {
            light: 0,
            rainbow: 0,
            stagnation: 3,
            maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
          },
          hand: [],
          ownedLenses: [],
          tasksCompleted: [],
          hasPassed: true,
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
      labPlacements: [],
    };

    const save = vi.fn();
    const mutable: MutableGameState = {
      state: gameState,
      save,
    };

    await phaseManager.finalScoring(mutable);

    expect(gameState.currentPhase).toBe('finalScoring');
    expect(gameState.players.a.vp).toBe(10 + 2 * 1 + 1 * 2); // 14
    expect(gameState.players.b.vp).toBe(5 - 3 * 2); // -1
    expect(save).toHaveBeenCalled();
  });

  it('applies character endgame effects', async () => {
    const turnOrder = new TurnOrderImpl();
    const phaseManager = new PhaseManagerImpl({
      turnOrder,
      ruleset,
      rulesetConfig: {
        stagnationPenalty: 2,
        initialActionPoints: 2,
        publicDevelopmentSlots: 8,
      },
    });

    const gameState: GameState = {
      roomId: 'room-1',
      currentRound: 4,
      currentPhase: 'end',
      currentPlayerId: 'a',
      lifecycleStage: 'inGame',
      turnOrder: ['a', 'b'],
      players: {
        a: {
          playerId: 'a',
          displayName: 'Player A',
          characterId: 'hero',
          actionPoints: 0,
          creativity: 0,
          vp: 10,
          resources: {
            light: 0,
            rainbow: 0,
            stagnation: 0,
            maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
          },
          hand: [],
          ownedLenses: [],
          tasksCompleted: [],
          hasPassed: true,
          unlockedCharacterNodes: ['n1', 'n2', 'n3'],
        },
        b: {
          playerId: 'b',
          displayName: 'Player B',
          characterId: 'hero',
          actionPoints: 0,
          creativity: 0,
          vp: -5,
          resources: {
            light: 1,
            rainbow: 1,
            stagnation: 2,
            maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
          },
          hand: [],
          ownedLenses: [],
          tasksCompleted: [],
          hasPassed: true,
          unlockedCharacterNodes: ['n4'],
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
      labPlacements: [],
    };

    const save = vi.fn();
    const mutable: MutableGameState = {
      state: gameState,
      save,
    };

    await phaseManager.finalScoring(mutable);

    // Player A: base 10 + vpFlat(10) + conditional(20) -> 40, multiplier 1.5 => 60 (ceil)
    expect(gameState.players.a.vp).toBe(60);
    // Player B: base -5 + resource conversion (+3) + converted penalty (+4) => 2
    expect(gameState.players.b.vp).toBe(2);
    expect(save).toHaveBeenCalled();
  });
});
