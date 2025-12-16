import { CharacterProfile } from '../types';

export const characters: Record<string, CharacterProfile> = {
    'shirogami-yuu': {
        characterId: 'shirogami-yuu',
        name: '白神 幽',
        nodes: [
            {
                nodeId: 'shirogami-yuu:s',
                position: 'S',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'vpFlat', amount: -10 },
                    },
                    {
                        type: 'active',
                        payload: {
                            cost: { creativity: 2 },
                            rewards: [
                                { type: 'resource', value: { stagnation: 1, light: 1, rainbow: 1 } },
                            ],
                        },
                    },
                ],
            },
            {
                nodeId: 'shirogami-yuu:1',
                position: '①',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'vpFlat', amount: -5 },
                    },
                ],
            },
            {
                nodeId: 'shirogami-yuu:2',
                position: '②',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            condition: 'materialRewardMismatch',
                            amount: 2,
                        },
                    },
                ],
            },
            {
                nodeId: 'shirogami-yuu:3',
                position: '③',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'lensActivatedByOther',
                            amount: 3,
                        },
                    },
                ],
            },
            {
                nodeId: 'shirogami-yuu:4',
                position: '④',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'vpFlat', amount: -10 },
                    },
                ],
            },
            {
                nodeId: 'shirogami-yuu:5',
                position: '⑤',
                effects: [
                    {
                        type: 'immediate',
                        payload: {
                            customAction: 'forcedCollection',
                        },
                    },
                ],
            },
            {
                nodeId: 'shirogami-yuu:6',
                position: '⑥',
                effects: [
                    {
                        type: 'active',
                        payload: {
                            cost: { creativity: 3 },
                            rewards: [{ type: 'vp', value: 13 }],
                        },
                    },
                ],
            },
            {
                nodeId: 'shirogami-yuu:7',
                position: '⑦',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'vpPerLobby', amount: 3 },
                    },
                ],
            },
            {
                nodeId: 'shirogami-yuu:8',
                position: '⑧',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'conditionalVp', condition: 'noLightNoRainbow', amount: 20 },
                    },
                ],
            },
            {
                nodeId: 'shirogami-yuu:9',
                position: '⑨',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'convertNegativeVp' },
                    },
                ],
            },
        ],
    },
    'akito-daidou': {
        characterId: 'akito-daidou',
        name: '橙堂 アキラ',
        nodes: [
            {
                nodeId: 'akito-daidou:s',
                position: 'S',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            condition: 'lensActivatedOfOther',
                            amount: 2,
                        },
                    },
                ],
            },
            {
                nodeId: 'akito-daidou:1',
                position: '①',
                effects: [
                    {
                        type: 'passive',
                        payload: {
                            costReduction: {
                                actionType: 'persuasion',
                                amount: 1,
                            },
                        },
                    },
                ],
            },
            {
                nodeId: 'akito-daidou:2',
                position: '②',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'vpFlat', amount: 10 },
                    },
                    {
                        type: 'passive',
                        payload: {
                            customAction: 'growthLock', // Special flag to prevent further growth
                        },
                    },
                ],
            },
            {
                nodeId: 'akito-daidou:3',
                position: '③',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            condition: 'persuasionTargeted',
                            amount: 2,
                            rewards: [{ type: 'resource', value: { stagnation: 1 } }],
                        },
                    },
                ],
            },
            {
                nodeId: 'akito-daidou:4',
                position: '④',
                effects: [],
            },
            {
                nodeId: 'akito-daidou:5',
                position: '⑤',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            actionType: 'persuasion',
                            amount: 2,
                        },
                    },
                ],
            },
            {
                nodeId: 'akito-daidou:6',
                position: '⑥',
                effects: [],
            },
            {
                nodeId: 'akito-daidou:7',
                position: '⑦',
                effects: [
                    {
                        type: 'active',
                        payload: {
                            cost: { creativity: 1 },
                            customAction: 'resonanceIntervention',
                        },
                    },
                ],
            },
            {
                nodeId: 'akito-daidou:8',
                position: '⑧',
                effects: [],
            },
            {
                nodeId: 'akito-daidou:9',
                position: '⑨',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'vpMultiplier', multiplier: 1.5 },
                    },
                ],
            },
        ],
    },
    'kazari-hizumi': {
        characterId: 'kazari-hizumi',
        name: '黄昏 灯純',
        nodes: [
            {
                nodeId: 'kazari-hizumi:s',
                position: 'S',
                effects: [
                    {
                        type: 'active',
                        payload: {
                            cost: { creativity: 2 },
                            rewards: [{ type: 'growth', value: 1 }],
                        },
                    },
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            condition: 'lobbyCreated', // Upgrade resource on lobby creation
                            actionType: 'createLobby',
                        },
                    },
                ],
            },
            {
                nodeId: 'kazari-hizumi:1',
                position: '①',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'roundEnd',
                            resourceType: 'stagnation',
                            amount: 1,
                        },
                    },
                ],
            },
            {
                nodeId: 'kazari-hizumi:2',
                position: '②',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'vpFlat', amount: 10 },
                    },
                    {
                        type: 'passive',
                        payload: {
                            customAction: 'growthLock',
                        },
                    },
                ],
            },
            {
                nodeId: 'kazari-hizumi:3',
                position: '③',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'roundEnd',
                            resourceType: 'light',
                            amount: 1,
                        },
                    },
                ],
            },
            {
                nodeId: 'kazari-hizumi:4',
                position: '④',
                effects: [], // Prerequisite
            },
            {
                nodeId: 'kazari-hizumi:5',
                position: '⑤',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'roundEnd',
                            resourceType: 'rainbow',
                            amount: 2,
                        },
                    },
                ],
            },
            {
                nodeId: 'kazari-hizumi:6',
                position: '⑥',
                effects: [], // Prerequisite
            },
            {
                nodeId: 'kazari-hizumi:7',
                position: '⑦',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed', // Trigger on lobby return
                            condition: 'lobbyReturned',
                            rewards: [{ type: 'resource', value: { light: 1 } }],
                        },
                    },
                ],
            },
            {
                nodeId: 'kazari-hizumi:8',
                position: '⑧',
                effects: [
                    {
                        type: 'passive',
                        payload: {
                            setCapacityUnlimited: ['light', 'rainbow', 'stagnation'],
                        },
                    },
                    {
                        type: 'active',
                        payload: {
                            customAction: 'gainLobby',
                            cost: { creativity: 2 },
                        },
                    },
                ],
            },
            {
                nodeId: 'kazari-hizumi:9',
                position: '⑨',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'roundEnd',
                            condition: 'distributeResources', // Distribute to poorer players
                        },
                    },
                ],
            },
        ],
    },
    'midori-rina': {
        characterId: 'midori-rina',
        name: '翠川 燐名',
        nodes: [
            {
                nodeId: 'midori-rina:s',
                position: 'S',
                effects: [
                    {
                        type: 'active',
                        payload: {
                            cost: { creativity: 1 },
                            rewards: [{ type: 'action', value: 'collect' }],
                        },
                    },
                ],
            },
            {
                nodeId: 'midori-rina:2',
                position: '②',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'vpFlat', amount: 10 },
                    },
                ],
            },
            {
                nodeId: 'midori-rina:3',
                position: '③',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed', // Triggers on ANY action, condition will filter for lens activation
                            condition: 'lensCostMin3',
                            amount: 3,
                        },
                    },
                ],
            },
            {
                nodeId: 'midori-rina:4',
                position: '④',
                effects: [
                    {
                        type: 'active',
                        payload: {
                            cost: { creativity: 1 },
                            customAction: 'convertStagnation',
                        },
                    },
                ],
            },
            {
                nodeId: 'midori-rina:5',
                position: '⑤',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            condition: 'lensStagnation',
                        },
                    },
                ],
            },
            {
                nodeId: 'midori-rina:8',
                position: '⑧',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed', // Triggers on ANY action, condition will filter
                            condition: 'lensSlotMin4',
                            amount: 4,
                        },
                    },
                ],
            },
            {
                nodeId: 'midori-rina:9',
                position: '⑨',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'conditionalVp', condition: 'finalChain' },
                    },
                ],
            },
        ],
    },
    'aono-haruyo': {
        characterId: 'aono-haruyo',
        name: '青野 春陽',
        nodes: [
            {
                nodeId: 'aono-haruyo:s',
                position: 'S',
                effects: [
                    {
                        type: 'active',
                        payload: {
                            cost: { creativity: 1 },
                            rewards: [{ type: 'resource', value: { actionPoints: 2 } }],
                        },
                    },
                ],
            },
            {
                nodeId: 'aono-haruyo:1',
                position: '①',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            condition: 'selfLens',
                            amount: 2,
                        },
                    },
                ],
            },
            {
                nodeId: 'aono-haruyo:2',
                position: '②',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'vpFlat', amount: 10 },
                    },
                ],
            },
            {
                nodeId: 'aono-haruyo:3',
                position: '③',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'growth',
                            amount: 2,
                            rewardType: 'actionPoints', // New field to specify reward type
                        },
                    },
                ],
            },
            {
                nodeId: 'aono-haruyo:5',
                position: '⑤',
                effects: [
                    {
                        type: 'passive',
                        payload: {
                            // "Cannot activate others' lenses" -> Restriction.
                            // "Self activation +2VP" -> Trigger.
                        },
                    },
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            condition: 'selfLens',
                            amount: 2,
                        },
                    },
                ],
            },
            {
                nodeId: 'aono-haruyo:6',
                position: '⑥',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            condition: 'gainLight',
                            amount: 2,
                            // Also adds +1 Light (handled in actionHandlers)
                        },
                    },
                ],
            },
            {
                nodeId: 'aono-haruyo:7',
                position: '⑦',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            condition: 'gainRainbow',
                            amount: 2,
                            // Also adds +1 Rainbow (handled in actionHandlers)
                        },
                    },
                ],
            },
            {
                nodeId: 'aono-haruyo:8',
                position: '⑧',
                effects: [
                    {
                        type: 'passive', // Changed from endGame to passive
                        payload: {
                            // Lens Activation VP x1.5 (handled in actionHandlers)
                        },
                    },
                ],
            },
            {
                nodeId: 'aono-haruyo:9',
                position: '⑨',
                effects: [
                    {
                        type: 'passive',
                        payload: {
                            costZero: { actionType: 'persuasion' },
                        },
                    },
                    {
                        type: 'passive',
                        payload: {
                            costZero: { actionType: 'refresh' }, // "Reboot" -> refresh
                        },
                    },
                ],
            },
            {
                nodeId: 'aono-haruyo:10',
                position: '⑩',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            condition: 'selfLens',
                            amount: 2,
                        },
                    },
                ],
            },
        ],
    },
    'akane-hiyori': {
        characterId: 'akane-hiyori',
        name: '赤嶺 ひより',
        nodes: [
            {
                nodeId: 'akane-hiyori:s',
                position: 'S',
                effects: [
                    {
                        type: 'active',
                        payload: {
                            cost: { creativity: 1 },
                            rewards: [{ type: 'resource', value: { light: 1 } }],
                        },
                    },
                ],
            },
            {
                nodeId: 'akane-hiyori:1',
                position: '①',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'lensCompleted',
                            amount: 4,
                        },
                    },
                ],
            },
            {
                nodeId: 'akane-hiyori:2',
                position: '②',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'vpFlat', amount: 10 },
                    },
                    {
                        type: 'passive', // Conceptual effect for Growth Lock
                        payload: { restriction: 'growthLock' },
                    },
                ],
            },
            {
                nodeId: 'akane-hiyori:3',
                position: '③',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'growth',
                            amount: 1,
                            rewardType: 'rainbow',
                        },
                    },
                ],
            },
            {
                nodeId: 'akane-hiyori:5',
                position: '⑤',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            condition: 'consumeLight',
                            amount: 3,
                        },
                    },
                ],
            },
            {
                nodeId: 'akane-hiyori:7',
                position: '⑦',
                effects: [
                    {
                        type: 'trigger',
                        payload: {
                            event: 'actionPerformed',
                            condition: 'consumeRainbow',
                            amount: 4,
                        },
                    },
                ],
            },
            {
                nodeId: 'akane-hiyori:8',
                position: '⑧',
                effects: [
                    {
                        type: 'endGame',
                        payload: { kind: 'conditionalVp', condition: 'rainbow7', amount: 30 },
                    },
                ],
            },
            {
                nodeId: 'akane-hiyori:9',
                position: '⑨',
                effects: [
                    {
                        type: 'active',
                        payload: {
                            cost: { creativity: 1 },
                            customAction: 'akaneNode9', // Choice: Rainbow or Lobby
                        },
                    },
                ],
            },
        ],
    },
};
