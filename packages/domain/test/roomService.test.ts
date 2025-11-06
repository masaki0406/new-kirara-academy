import { describe, it, beforeEach, expect } from 'vitest';
import { RoomService, CreateRoomParams } from '../src/roomService';
import { FirestoreAdapterImpl, FirestoreLike, DocumentReferenceLike } from '../src/firestoreAdapter';
import type { GameState } from '../src/types';
import { DEFAULT_FOUNDATION_STOCK, FOUNDATION_COSTS } from '../src/types';

function createFirestoreLike(): FirestoreLike {
  const store = new Map<string, unknown>();

  return {
    doc(path: string): DocumentReferenceLike {
      return {
        async get() {
          const data = store.get(path);
          return {
            exists: data !== undefined,
            data: () => data,
          };
        },
        async set(data: unknown) {
          store.set(path, data);
        },
        collection(collectionPath: string) {
          return {
            async add(data: unknown) {
              const key = `${path}/${collectionPath}/${Math.random().toString(36).slice(2)}`;
              store.set(key, data);
            },
          };
        },
      };
    },
  };
}

function createFoundationStock(): Record<number, number> {
  const stock: Record<number, number> = {};
  FOUNDATION_COSTS.forEach((cost) => {
    const value = DEFAULT_FOUNDATION_STOCK[cost];
    if (typeof value === 'number') {
      stock[cost] = value;
    }
  });
  return stock;
}

function createInitialState(): GameState {
  return {
    roomId: 'room-test',
    currentRound: 1,
    currentPhase: 'setup',
    currentPlayerId: null,
    lifecycleStage: 'lobby',
    turnOrder: [],
    players: {},
    board: {
      lenses: {},
      lobbySlots: [],
      publicDevelopmentCards: [],
      publicVpCards: [],
      foundationStock: createFoundationStock(),
    },
    developmentDeck: [],
    vpDeck: [],
    lensDeck: [],
    tasks: {},
    logs: [],
    labPlacements: [],
  };
}

describe('RoomService.selectCharacter', () => {
  let service: RoomService;

  beforeEach(async () => {
    const firestore = createFirestoreLike();
    const adapter = new FirestoreAdapterImpl(firestore, {
      createInitialState: (roomId) => ({ ...createInitialState(), roomId }),
    });
    service = new RoomService(adapter);

    const baseParams: CreateRoomParams = {
      roomId: 'room-test',
      hostId: 'host-1',
      hostName: 'Host Player',
    };

    await service.createRoom(baseParams);
    await service.joinRoom({ roomId: 'room-test', playerId: 'player-a', playerName: 'Player A' });
    await service.joinRoom({ roomId: 'room-test', playerId: 'player-b', playerName: 'Player B' });
  });

  it('assigns a character to the requesting player', async () => {
    const state = await service.selectCharacter({
      roomId: 'room-test',
      playerId: 'player-a',
      characterId: 'character-omega',
    });

    expect(state.players['player-a'].characterId).toBe('character-omega');
  });

  it('throws if another player already has the character', async () => {
    await service.selectCharacter({
      roomId: 'room-test',
      playerId: 'player-a',
      characterId: 'character-omega',
    });

    await expect(
      service.selectCharacter({
        roomId: 'room-test',
        playerId: 'player-b',
        characterId: 'character-omega',
      }),
    ).rejects.toThrow('Selected character is already taken.');
  });

  it('allows the same player to change characters when available', async () => {
    await service.selectCharacter({
      roomId: 'room-test',
      playerId: 'player-a',
      characterId: 'character-alpha',
    });

    const state = await service.selectCharacter({
      roomId: 'room-test',
      playerId: 'player-a',
      characterId: 'character-beta',
    });

    expect(state.players['player-a'].characterId).toBe('character-beta');
  });
});

describe('RoomService lifecycle stage', () => {
  let service: RoomService;

  beforeEach(async () => {
    const firestore = createFirestoreLike();
    const adapter = new FirestoreAdapterImpl(firestore, {
      createInitialState: (roomId) => ({ ...createInitialState(), roomId }),
    });
    service = new RoomService(adapter);

    await service.createRoom({
      roomId: 'room-test',
      hostId: 'host-1',
      hostName: 'Host Player',
    });
  });

  it('allows host to begin character selection', async () => {
    const state = await service.beginCharacterSelection({
      roomId: 'room-test',
      requesterId: 'host-1',
    });

    expect(state.lifecycleStage).toBe('characterSelect');
  });

  it('prevents non-host from beginning character selection', async () => {
    await service.joinRoom({ roomId: 'room-test', playerId: 'guest', playerName: 'Guest' });

    await expect(
      service.beginCharacterSelection({ roomId: 'room-test', requesterId: 'guest' }),
    ).rejects.toThrow('Only the host can initiate character selection.');
  });
});
