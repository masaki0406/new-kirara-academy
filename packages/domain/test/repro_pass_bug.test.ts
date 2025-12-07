
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    GameState,
    PlayerState,
    TurnOrder,
    GameSession,
    ActionResolver,
    Ruleset,
    PlayerId
} from '../src/types';
import { GameSessionImpl } from '../src/gameSession';
import { PhaseManagerImpl } from '../src/phaseManager';
import { TurnOrderImpl } from '../src/turnOrder';
import { createActionHandler } from '../src/actionHandlers';

// Mock dependencies
const mockRuleset: Ruleset = {
    calculateScore: vi.fn(),
    validateAction: vi.fn(),
    applyAction: vi.fn(),
    checkWinCondition: vi.fn(),
    getInitialResources: vi.fn(),
    resolveRound: vi.fn(),
} as unknown as Ruleset;

// Mock ActionResolver
const mockActionResolver: ActionResolver = {
    resolve: async (action, context) => {
        if (action.actionType === 'pass') {
            const { gameState, turnOrder } = context;
            const player = gameState.players[action.playerId];
            player.hasPassed = true;
            turnOrder?.markPass(action.playerId);
            return { success: true };
        }
        return { success: true };
    }
};

describe('Reproduction: Pass Bug', () => {
    let gameState: GameState;

    // Helper to create a session with fresh TurnOrder but shared state
    const createSession = (state: GameState): GameSession => {
        const turnOrder = new TurnOrderImpl();

        // Simulate syncTurnOrderFromState logic
        const playerIds = Object.keys(state.players) as PlayerId[];
        const ordered = state.turnOrder && state.turnOrder.length > 0 ? state.turnOrder : playerIds;
        turnOrder.setInitialOrder(ordered);
        ordered.forEach(pid => {
            if (state.players[pid].hasPassed) {
                turnOrder.markPass(pid);
            }
        });

        const phaseManager = new PhaseManagerImpl({
            turnOrder,
            ruleset: mockRuleset,
        });

        // Mock endPhase and preparePhase to avoid complex logic
        phaseManager.endPhase = vi.fn().mockResolvedValue(undefined);
        phaseManager.preparePhase = vi.fn().mockResolvedValue(undefined);
        phaseManager.finalScoring = vi.fn().mockResolvedValue(undefined);

        return new GameSessionImpl('test-room', {
            phaseManager,
            turnOrder,
            actionResolver: mockActionResolver,
            stateLoader: async () => ({
                state,
                save: async () => { },
            }),
            logWriter: async () => { },
        });
    };

    beforeEach(() => {
        gameState = {
            roomId: 'test-room',
            currentRound: 1,
            maxRounds: 3,
            currentPhase: 'main',
            players: {
                'p1': { playerId: 'p1', hasPassed: false } as PlayerState,
                'p2': { playerId: 'p2', hasPassed: false } as PlayerState,
            },
            turnOrder: ['p1', 'p2'],
            board: { lobbySlots: [], labPlacements: [] },
        } as unknown as GameState;
    });

    it('should advance round when all players pass across different sessions', async () => {
        // Session 1: Player 1 passes
        const session1 = createSession(gameState);
        await session1.processAction({ playerId: 'p1', actionType: 'pass', payload: {} }, mockRuleset, Date.now());

        expect(gameState.players['p1'].hasPassed).toBe(true);
        expect(gameState.currentRound).toBe(1);

        // Session 2: Player 2 passes
        const session2 = createSession(gameState);
        await session2.processAction({ playerId: 'p2', actionType: 'pass', payload: {} }, mockRuleset, Date.now());

        expect(gameState.players['p2'].hasPassed).toBe(true);

        // Check if round advanced
        // endRoundIfNeeded is called in processAction.
        // If it worked, currentRound should be 2 (since we mocked preparePhase/endPhase but GameSessionImpl increments it)
        // Wait, GameSessionImpl increments it inside endRoundIfNeeded.

        // Let's check if phaseManager.endPhase was called
        // We need to access the spy.
        // But createSession creates new spies every time.
        // We can check gameState.currentRound if GameSessionImpl updates it.
        // GameSessionImpl:
        // this.currentRound += 1;
        // state.currentRound = this.currentRound;

        // So gameState.currentRound should be 2.
        expect(gameState.currentRound).toBe(2);
    });
});
