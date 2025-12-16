import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, PlayerState, Ruleset } from '../src/types';
import { createActionHandler } from '../src/actionHandlers';
import { PhaseManagerImpl } from '../src/phaseManager';
import { characters } from '../src/rules/characters';

describe('Midori Rina Corrections Verification', () => {
    let gameState: GameState;
    let ruleset: Ruleset;
    let handler: any;

    beforeEach(() => {
        ruleset = {
            characters: characters,
            lenses: {},
            developmentCards: {},
            endgameConversions: {},
        } as unknown as Ruleset;
        gameState = {
            roomId: 'test-room',
            currentRound: 1,
            currentPhase: 'main',
            currentPlayerId: 'p1',
            lifecycleStage: 'inGame',
            turnOrder: ['p1', 'p2'],
            players: {
                p1: {
                    playerId: 'p1',
                    characterId: 'midori-rina',
                    displayName: 'P1',
                    vp: 0,
                    resources: {
                        light: 0,
                        rainbow: 0,
                        stagnation: 0,
                        creativity: 5,
                        actionPoints: 10,
                        maxCapacity: { stagnation: 10, light: 10, rainbow: 10 },
                    },
                    unlockedCharacterNodes: ['midori-rina:s', 'midori-rina:2', 'midori-rina:3', 'midori-rina:4', 'midori-rina:5', 'midori-rina:8', 'midori-rina:9'],
                    lobbyReserve: 5,
                    lobbyAvailable: 5,
                    lobbyUsed: 0,
                    collectedDevelopmentCards: [],
                    collectedVpCards: [],
                    craftedLenses: [],
                    ownedLenses: ['lens1', 'lens3'],
                } as unknown as PlayerState,
                p2: {
                    playerId: 'p2',
                    characterId: 'shirogami-yuu',
                    displayName: 'P2',
                    vp: 0,
                    resources: {
                        light: 0,
                        rainbow: 0,
                        stagnation: 0,
                        creativity: 5,
                        actionPoints: 10,
                        maxCapacity: { stagnation: 10, light: 10, rainbow: 10 },
                    },
                    unlockedCharacterNodes: [],
                    lobbyAvailable: 5,
                    collectedDevelopmentCards: [],
                    collectedVpCards: [],
                    craftedLenses: [],
                    ownedLenses: ['lens2'],
                } as unknown as PlayerState,
            },
            board: {
                lenses: {
                    'lens1': {
                        lensId: 'lens1',
                        ownerId: 'p1',
                        cost: { actionPoints: 3 }, // Level 3
                        rewards: [{ type: 'resource', value: { stagnation: 1 } }],
                        slots: 1,
                        tags: [],
                        status: 'available',
                        rightItems: [],
                        leftItems: [],
                    },
                    'lens2': {
                        lensId: 'lens2',
                        ownerId: 'p2',
                        cost: { actionPoints: 1 },
                        rewards: [],
                        slots: 1,
                        tags: [],
                        status: 'available',
                        rightItems: [],
                        leftItems: [],
                    }
                },
                lobbySlots: [
                    { lensId: 'lens1', ownerId: 'p1', isActive: true },
                    { lensId: 'lens2', ownerId: 'p2', isActive: true },
                ],
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
        handler = createActionHandler({
            validate: async () => [],
            apply: async () => { },
        });
    });

    it('Node 4: should gain stagnation and VP (valid)', async () => {
        const p1 = gameState.players.p1;
        p1.resources.stagnation = 7;

        const { applyWill } = await import('../src/actionHandlers');

        await applyWill({
            playerId: 'p1',
            actionType: 'will',
            payload: {
                nodeId: 'midori-rina:4',
                customAction: 'convertStagnation',
                amount: 3,
            },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        expect(p1.resources.stagnation).toBe(10); // 7 + 3
        expect(p1.vp).toBe(6);
    });

    it('Node 4: should throw error on overflow', async () => {
        const p1 = gameState.players.p1;
        p1.resources.stagnation = 8;

        const { applyWill } = await import('../src/actionHandlers');

        await expect(applyWill({
            playerId: 'p1',
            actionType: 'will',
            payload: {
                nodeId: 'midori-rina:4',
                customAction: 'convertStagnation',
                amount: 3,
            },
        } as any, { gameState, ruleset, timestamp: Date.now() })).rejects.toThrow('所持上限を超える個数は選択できません');
    });

    it('Node 5: should gain VP based on total stagnation move (Consumed + Gained)', async () => {
        const p1 = gameState.players.p1;
        p1.resources.stagnation = 1; // Start with 1 Stagnation

        // Modify Lens 1 to have Stagnation Cost and Reward
        gameState.board.lenses['lens1'].cost = { actionPoints: 1, stagnation: 1 };
        gameState.board.lenses['lens1'].rewards = [{ type: 'resource', value: { stagnation: 2 } }];

        const { applyLensActivate } = await import('../src/actionHandlers');

        // Activate Lens 1 (Self)
        await applyLensActivate({
            playerId: 'p1',
            actionType: 'lensActivate',
            payload: { lensId: 'lens1' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        // Consumed: 1 Stagnation.
        // Gained: 2 Stagnation.
        // Net Change: +1 (1 -> 2).
        // Total Move: 1 + 2 = 3.
        // Node 5 gives 1 VP per total move.
        // Node 3 does not trigger (Cost 1 < 3).

        expect(p1.vp).toBe(3);
        expect(p1.resources.stagnation).toBe(2);
    });

    it('Node 3 & 8: should trigger on Self/Other activation', async () => {
        const p1 = gameState.players.p1;

        const lens1 = gameState.board.lenses['lens1'];
        lens1.leftItems = [
            { cardId: 'c1', quantity: 1, cardType: 'development' },
            { cardId: 'c2', quantity: 1, cardType: 'development' },
            { cardId: 'c3', quantity: 1, cardType: 'development' },
            { cardId: 'c4', quantity: 1, cardType: 'development' },
        ]; // 4 items

        const { applyLensActivate } = await import('../src/actionHandlers');

        // 1. Self Activation (p1 activates lens1)
        await applyLensActivate({
            playerId: 'p1',
            actionType: 'lensActivate',
            payload: { lensId: 'lens1' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        // Node 3: +3 VP (Cost 3)
        // Node 8: +4 VP (Items 4)
        // Node 5: +1 VP (Stagnation gain)
        // Total +8 VP.
        expect(p1.vp).toBe(8);

        // Reset VP
        p1.vp = 0;

        // 2. Other Activation (p2 activates lens1)
        await applyLensActivate({
            playerId: 'p2',
            actionType: 'lensActivate',
            payload: { lensId: 'lens1' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        // Node 3: +3 VP
        // Node 8: +4 VP
        // Node 5: +0 VP (Self only)
        // Total +7 VP.
        expect(p1.vp).toBe(7);
    });

    it('Node 9: should activate all lenses at endgame (Final Chain) with resource checks', async () => {
        const p1 = gameState.players.p1;
        // Lens 1: Cost 3 AP. No resource cost. Should activate. Reward: 1 Stagnation.
        // Lens 3: Cost 1 AP, 1 Light. Reward: 2 VP.
        gameState.board.lenses['lens3'] = {
            lensId: 'lens3',
            ownerId: 'p1',
            cost: { actionPoints: 1, light: 1 },
            rewards: [{ type: 'vp', value: 2 }],
            slots: 1,
            tags: [],
            status: 'available',
            rightItems: [],
            leftItems: [],
        };
        gameState.board.lobbySlots.push({ lensId: 'lens3', ownerId: 'p1', isActive: true });

        // Lens 4: Cost 1 AP, 1 Rainbow. Reward: 5 VP.
        gameState.board.lenses['lens4'] = {
            lensId: 'lens4',
            ownerId: 'p1',
            cost: { actionPoints: 1, rainbow: 1 },
            rewards: [{ type: 'vp', value: 5 }],
            slots: 1,
            tags: [],
            status: 'available',
            rightItems: [],
            leftItems: [],
        };
        gameState.board.lobbySlots.push({ lensId: 'lens4', ownerId: 'p1', isActive: true });

        // Give player resources
        p1.resources.light = 1;
        p1.resources.rainbow = 0; // Not enough for Lens 4

        // Run Endgame Phase
        const phaseManager = new PhaseManagerImpl({
            turnOrder: { setInitialOrder: () => { }, current: () => 'p1', nextPlayer: () => null, markPass: () => { }, registerRooting: () => { }, hasAllPassed: () => true, passedCount: () => 2, totalCount: () => 2, resolveNextRoundStarter: () => null },
            ruleset,
        });

        const mutableState = {
            state: gameState,
            save: async () => { },
        };

        await phaseManager.finalScoring(mutableState);

        // Final Chain:
        // Lens 1: Activates (AP waived). +1 Stagnation.
        // Lens 3: Activates (AP waived, 1 Light paid). +2 VP. Light becomes 0.
        // Lens 4: Skips (Not enough Rainbow). +0 VP.
        // Node 2: +10 VP.
        // Total VP = 2 (Lens 3) + 10 (Node 2) = 12.
        // Stagnation = 1 (Lens 1).
        // Light = 0.

        expect(p1.vp).toBe(12);
        expect(p1.resources.stagnation).toBe(1);
        expect(p1.resources.light).toBe(0);
    });
});
