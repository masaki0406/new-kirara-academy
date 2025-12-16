import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, PlayerState, Ruleset, GamePhase, LifecycleStage, LensDefinition } from '../src/types';
import { triggerEvent } from '../src/triggerEngine';

describe('Aono Haruyo Corrections Verification', () => {
    let gameState: GameState;
    let ruleset: Ruleset;

    beforeEach(() => {
        ruleset = {
            characters: {
                'aono-haruyo': {
                    characterId: 'aono-haruyo',
                    name: 'Aono Haruyo',
                    nodes: [
                        { nodeId: 'aono-haruyo:1', position: '1', effects: [{ type: 'trigger', payload: { event: 'actionPerformed', condition: 'selfLens', amount: 2 } }] },
                        {
                            nodeId: 'aono-haruyo:5', position: '5', effects: [
                                { type: 'passive', payload: { restriction: 'noOtherLens' } }, // Restriction is implicit in code check
                                { type: 'trigger', payload: { event: 'actionPerformed', condition: 'selfLens', amount: 2 } }
                            ]
                        },
                        { nodeId: 'aono-haruyo:3', position: '3', effects: [{ type: 'trigger', payload: { event: 'growth', amount: 2, rewardType: 'actionPoints' } }] },
                        { nodeId: 'aono-haruyo:6', position: '6', effects: [{ type: 'trigger', payload: { event: 'actionPerformed', condition: 'gainLight', amount: 2 } }] },
                        { nodeId: 'aono-haruyo:7', position: '7', effects: [{ type: 'trigger', payload: { event: 'actionPerformed', condition: 'gainRainbow', amount: 2 } }] },
                        { nodeId: 'aono-haruyo:8', position: '8', effects: [{ type: 'passive', payload: {} }] },
                        {
                            nodeId: 'aono-haruyo:9',
                            position: '9',
                            effects: [
                                { type: 'passive', payload: { costZero: { actionType: 'persuasion' } } },
                                { type: 'passive', payload: { costZero: { actionType: 'refresh' } } }
                            ]
                        },
                        { nodeId: 'aono-haruyo:10', position: '10', effects: [{ type: 'trigger', payload: { event: 'actionPerformed', condition: 'selfLens', amount: 2 } }] },
                    ],
                },
            },
            lenses: {},
            endgameConversions: {},
        } as unknown as Ruleset;

        gameState = {
            players: {
                p1: {
                    playerId: 'p1',
                    characterId: 'aono-haruyo',
                    vp: 0,
                    actionPoints: 10,
                    resources: { stagnation: 0, light: 0, rainbow: 0, maxCapacity: { stagnation: 10, light: 10, rainbow: 10 } },
                    unlockedCharacterNodes: ['aono-haruyo:5'],
                    lobbyAvailable: 5,
                    lobbyUsed: 0,
                    lobbyReserve: 5,
                    hand: [],
                    board: [],
                    displayName: 'Player 1',
                    collectedDevelopmentCards: [],
                    collectedVpCards: [],
                    craftedLenses: [],
                    ownedLenses: [],
                } as unknown as PlayerState,
                p2: {
                    playerId: 'p2',
                    vp: 0,
                    actionPoints: 10,
                    resources: { stagnation: 0, light: 0, rainbow: 0, maxCapacity: { stagnation: 10, light: 10, rainbow: 10 } },
                    lobbyAvailable: 5,
                    lobbyUsed: 0,
                    lobbyReserve: 5,
                    hand: [],
                    board: [],
                    displayName: 'Player 2',
                    collectedDevelopmentCards: [],
                    collectedVpCards: [],
                    craftedLenses: [],
                    ownedLenses: [],
                } as unknown as PlayerState,
            },
            board: {
                lenses: {
                    'lens1': { lensId: 'lens1', ownerId: 'p1', cost: { actionPoints: 1 }, rewards: [] },
                    'lens2': { lensId: 'lens2', ownerId: 'p2', cost: { actionPoints: 1 }, rewards: [] },
                    'lens3': { lensId: 'lens3', ownerId: 'p1', cost: { actionPoints: 1 }, rewards: [{ type: 'resource', value: { light: 1 } }] },
                    'lens4': { lensId: 'lens4', ownerId: 'p1', cost: { actionPoints: 1 }, rewards: [{ type: 'resource', value: { rainbow: 1 } }] },
                },
                lobbySlots: [
                    { lensId: 'lens1', ownerId: 'p1', occupantId: undefined, isActive: false },
                    { lensId: 'lens2', ownerId: 'p2', occupantId: undefined, isActive: false },
                    { lensId: 'lens2', ownerId: 'p2', occupantId: 'p2', isActive: false }, // Occupied by owner
                ],
            },
            currentPhase: 'action',
            lifecycleStage: 'inGame',
            logs: [],
            labPlacements: [],
        } as unknown as GameState;
    });

    it('Node 1, 5, 10: should gain VP on Self Lens Activation', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['aono-haruyo:1', 'aono-haruyo:5', 'aono-haruyo:10'];

        const { applyLensActivate } = await import('../src/actionHandlers');

        await applyLensActivate({
            playerId: 'p1',
            actionType: 'lensActivate',
            payload: { lensId: 'lens1' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        // +2 VP from Node 1
        // +2 VP from Node 5
        // +2 VP from Node 10
        // Total +6 VP
        expect(p1.vp).toBe(6);
    });

    it('Node 5: should prevent activating Other Lens', async () => {
        const p1 = gameState.players.p1;
        // p1.unlockedCharacterNodes is set in beforeEach

        const { applyLensActivate } = await import('../src/actionHandlers');

        // Try to activate p2's lens (lens2)
        // It should NOT throw, but log an error in gameState.logs
        await applyLensActivate({
            playerId: 'p1',
            actionType: 'lensActivate',
            payload: { lensId: 'lens2' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        const errorLog = gameState.logs.find(log => (log.payload?.error as string)?.includes('他人のレンズは起動できません'));
        expect(errorLog).toBeDefined();
    });

    it('Node 3: should gain AP on Growth', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['aono-haruyo:3'];
        p1.actionPoints = 0;

        // Trigger growth event manually (since applyGrowthSelection calls triggerEvent)
        triggerEvent(gameState, ruleset, 'growth', {
            actorId: 'p1',
        });

        // +2 AP from Node 3 (rewardType: 'actionPoints')
        expect(p1.actionPoints).toBe(2);
        expect(p1.vp).toBe(0);
    });

    it('Node 6: should gain Extra Light and VP on Gain Light', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['aono-haruyo:6'];

        const { applyLensActivate } = await import('../src/actionHandlers');

        // Activate lens3 (gives 1 Light)
        await applyLensActivate({
            playerId: 'p1',
            actionType: 'lensActivate',
            payload: { lensId: 'lens3' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        // +2 VP from Node 6 trigger
        expect(p1.vp).toBe(2);
        // 1 Light from Lens + 1 Light from Node 6 = 2 Light
        expect(p1.resources.light).toBe(2);
    });

    it('Node 7: should gain Extra Rainbow and VP on Gain Rainbow', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['aono-haruyo:7'];

        const { applyLensActivate } = await import('../src/actionHandlers');

        // Activate lens4 (gives 1 Rainbow)
        await applyLensActivate({
            playerId: 'p1',
            actionType: 'lensActivate',
            payload: { lensId: 'lens4' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        // +2 VP from Node 7 trigger
        expect(p1.vp).toBe(2);
        // 1 Rainbow from Lens + 1 Rainbow from Node 7 = 2 Rainbow
        expect(p1.resources.rainbow).toBe(2);
    });

    it('Node 8: should multiply VP by 1.5 on Lens Activation', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['aono-haruyo:8', 'aono-haruyo:1']; // Node 1 gives +2 VP on self activation

        const { applyLensActivate } = await import('../src/actionHandlers');

        // Activate lens1 (Self Lens)
        // Node 1 gives +2 VP.
        // Node 8 multiplies it by 1.5 -> 3 VP.
        await applyLensActivate({
            playerId: 'p1',
            actionType: 'lensActivate',
            payload: { lensId: 'lens1' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        expect(p1.vp).toBe(3);
    });

    it('Node 2: should prevent Growth', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['aono-haruyo:2'];

        const { canUnlockGrowthNode } = await import('../src/characterGrowth');

        // Try to unlock Node 3 (which requires Node S, but Node 2 lock should prevent ANY growth? 
        // Or just subsequent nodes?
        // Logic says: if Node 2 unlocked, return false.
        const canUnlock = canUnlockGrowthNode('aono-haruyo', 'aono-haruyo:3', new Set(p1.unlockedCharacterNodes));
        expect(canUnlock).toBe(false);
    });

    it('Node 9: should reduce Persuasion cost to 0 (AP)', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['aono-haruyo:9'];
        p1.actionPoints = 2; // Just enough for base cost if not reduced

        // Setup a slot occupied by P2 for persuasion
        gameState.board.lobbySlots.push({ lensId: 'lens2', ownerId: 'p2', occupantId: 'p2', isActive: false });

        const { applyPersuasion } = await import('../src/actionHandlers');

        await applyPersuasion({
            playerId: 'p1',
            actionType: 'persuasion',
            payload: { lensId: 'lens2' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        // Cost should be 0 AP.
        // P1 started with 2 AP. Should still have 2 AP.
        expect(p1.actionPoints).toBe(2);
        // Slot should now be occupied by P1
        const slot = gameState.board.lobbySlots.find(s => s.lensId === 'lens2' && s.occupantId === 'p1');
        expect(slot).toBeDefined();
    });

    it('Node 9: should reduce Refresh cost to 0 (AP)', async () => {
        const p1 = gameState.players.p1;
        p1.unlockedCharacterNodes = ['aono-haruyo:9'];
        p1.actionPoints = 2; // Base cost is 3 + lens cost. 2 is not enough unless reduced.

        // Setup a slot occupied by P1 but inactive (needs refresh)
        // Lens1 cost is 1 AP. Total refresh cost = 3 + 1 = 4 AP.
        // If reduced, cost is 0 AP.
        gameState.board.lobbySlots.push({ lensId: 'lens1', ownerId: 'p1', occupantId: 'p1', isActive: false });

        const { applyRefresh } = await import('../src/actionHandlers');

        await applyRefresh({
            playerId: 'p1',
            actionType: 'refresh',
            payload: { lensId: 'lens1' },
        } as any, { gameState, ruleset, timestamp: Date.now() });

        // Cost should be 0 AP.
        // P1 started with 2 AP. Should still have 2 AP.
        expect(p1.actionPoints).toBe(2);
    });
});
