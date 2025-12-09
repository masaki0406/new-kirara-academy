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
                        payload: { kind: 'convertNegativeVp' }, // Approximate: "Reduce penalty to -5VP" -> Maybe custom logic needed? Or just +5VP?
                        // Description: "Game End penalty reduced to -5VP". Original is -10VP. So this node gives +5VP effectively?
                        // Or maybe it modifies the S node effect?
                        // For now, let's assume +5VP flat to offset.
                    },
                ],
            },
            // ... other nodes
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
                            event: 'lensActivatedByOther',
                            amount: 2,
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
                ],
            },
            // ... other nodes
        ],
    },
};
