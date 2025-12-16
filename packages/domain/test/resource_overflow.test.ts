import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, PlayerState, Ruleset } from '../src/types';
import { applyLensActivate } from '../src/actionHandlers';
import { characters } from '../src/rules/characters';

describe('Resource Overflow Verification', () => {
    let gameState: GameState;
    let ruleset: Ruleset;

    beforeEach(() => {
        ruleset = {
            characters: characters,
            lenses: {},
            developmentCards: {},
            endgameConversions: {},
            labs: {
                'lab1': {
                    labId: 'lab1',
                    name: 'Test Lab',
                    cost: { actionPoints: 1 },
                    rewards: [{ type: 'resource', value: { light: 1, rainbow: 1 } }],
                    slots: [],
                }
            }
        } as unknown as Ruleset;

        gameState = {
            roomId: 'test-room',
            currentRound: 1,
            currentPhase: 'main',
            currentPlayerId: 'p1',
            lifecycleStage: 'inGame',
            turnOrder: ['p1'],
            players: {
                p1: {
                    playerId: 'p1',
                    characterId: 'midori-rina', // Use Midori for consistency
                    displayName: 'P1',
                    vp: 0,
                    resources: {
                        light: 0,
                        rainbow: 0,
                        stagnation: 0,
                        creativity: 0,
                        actionPoints: 10,
                        maxCapacity: { stagnation: 10, light: 10, rainbow: 10 },
                    },
                    unlockedCharacterNodes: [],
                    lobbyAvailable: 5,
                    collectedDevelopmentCards: [],
                    collectedVpCards: [],
                    craftedLenses: [],
                    ownedLenses: ['lens1'],
                } as unknown as PlayerState,
            },
            board: {
                lenses: {
                    'lens1': {
                        lensId: 'lens1',
                        ownerId: 'p1',
                        cost: { actionPoints: 1 },
                        rewards: [{ type: 'resource', value: { light: 1, rainbow: 1 } }],
                        slots: 1,
                        tags: [],
                        status: 'available',
                        rightItems: [],
                        leftItems: [],
                    },
                },
                lobbySlots: [
                    { lensId: 'lens1', ownerId: 'p1', isActive: true },
                ],
                publicDevelopmentCards: [],
                publicVpCards: [],
                labPlacements: [],
            },
            logs: [],
            tasks: {},
        } as unknown as GameState;
    });

    it('should log error when limit is reached and no choice is provided', async () => {
        const p1 = gameState.players.p1;
        p1.resources.stagnation = 11;

        // Lens gives 1 Light, 1 Rainbow.
        // Space: 1.
        // Should log error because no choice provided.

        await applyLensActivate({
            playerId: 'p1',
            actionType: 'lensActivate',
            payload: { lensId: 'lens1' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        const errorLog = gameState.logs.find(log =>
            (log.actionType === 'error') ||
            (log.actionType === 'pass' && (log.payload as any).message === '[DEBUG] CRITICAL ERROR IN APPLY')
        );
        expect(errorLog).toBeDefined();
        expect((errorLog?.payload as any).error).toMatch(/上限/);
    });

    it('should apply choice when provided', async () => {
        const p1 = gameState.players.p1;
        p1.resources.stagnation = 11;

        // Choose Rainbow (1).
        await applyLensActivate({
            playerId: 'p1',
            actionType: 'lensActivate',
            payload: {
                lensId: 'lens1',
                resourceChoice: { rainbow: 1 }
            },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        expect(p1.resources.stagnation).toBe(11);
        expect(p1.resources.light).toBe(0);
        expect(p1.resources.rainbow).toBe(1);
        // Total: 12.
    });
});
