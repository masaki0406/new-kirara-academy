import { FirestoreAdapter } from './firestoreAdapter';
import {
  AdjustPlayerForTestPayload,
  DEFAULT_FOUNDATION_STOCK,
  FOUNDATION_COSTS,
  FoundationCardStock,
  FoundationCost,
  CraftedLens,
  CraftedLensSideItem,
  CraftedLensSourceCard,
  GameState,
  LifecycleStage,
  PlayerId,
} from './types';

export interface CreateRoomParams {
  roomId: string;
  hostId: string;
  hostName: string;
}

export interface JoinRoomParams {
  roomId: string;
  playerId: string;
  playerName: string;
}

export interface LeaveRoomParams {
  roomId: string;
  playerId: string;
}

export interface UpdateTurnOrderParams {
  roomId: string;
  order: PlayerId[];
}

export interface SelectCharacterParams {
  roomId: string;
  playerId: PlayerId;
  characterId: string;
}

export interface BeginCharacterSelectionParams {
  roomId: string;
  requesterId: PlayerId;
}

export interface UpdateLifecycleStageParams {
  roomId: string;
  stage: LifecycleStage;
}

export interface AdjustPlayerForTestParams extends AdjustPlayerForTestPayload {
  roomId: string;
}

function cloneDefaultFoundationStock(): FoundationCardStock {
  const stock: FoundationCardStock = {};
  FOUNDATION_COSTS.forEach((cost) => {
    const value = DEFAULT_FOUNDATION_STOCK[cost];
    if (typeof value === 'number') {
      stock[cost] = value;
    }
  });
  return stock;
}

function normalizeFoundationCost(value: unknown): FoundationCost | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const numeric = Math.floor(value);
  if (!FOUNDATION_COSTS.includes(numeric as (typeof FOUNDATION_COSTS)[number])) {
    return null;
  }
  return numeric as FoundationCost;
}

function sanitizeCraftedLensSideItems(value: unknown): CraftedLensSideItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: CraftedLensSideItem[] = [];
  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const record = entry as Record<string, unknown>;
    const cardId = typeof record.cardId === 'string' ? record.cardId : null;
    const cardType =
      record.cardType === 'development' || record.cardType === 'vp' ? record.cardType : null;
    if (!cardId || !cardType) {
      return;
    }
    const position =
      typeof record.position === 'number' && Number.isFinite(record.position)
        ? Math.floor(record.position)
        : null;
    const item =
      typeof record.item === 'string'
        ? record.item
        : record.item === null || record.item === undefined
          ? null
          : String(record.item);
    const sanitized: CraftedLensSideItem = {
      cardId,
      cardType,
      position,
      item,
    };
    if (typeof record.quantity === 'number' && Number.isFinite(record.quantity)) {
      sanitized.quantity = record.quantity;
    } else if (record.quantity === null) {
      sanitized.quantity = null;
    }
    items.push(sanitized);
  });
  return items;
}

function sanitizeCraftedLensSources(value: unknown): CraftedLensSourceCard[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const sources: CraftedLensSourceCard[] = [];
  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const record = entry as Record<string, unknown>;
    const cardId = typeof record.cardId === 'string' ? record.cardId : null;
    const cardType =
      record.cardType === 'development' || record.cardType === 'vp' ? record.cardType : null;
    const flipped = typeof record.flipped === 'boolean' ? record.flipped : false;
    if (!cardId || !cardType) {
      return;
    }
    sources.push({
      cardId,
      cardType,
      flipped,
    });
  });
  return sources;
}

function sanitizeCraftedLenses(value: unknown): CraftedLens[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const lenses: CraftedLens[] = [];
  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const record = entry as Record<string, unknown>;
    const lensId =
      typeof record.lensId === 'string' && record.lensId.trim().length > 0 ? record.lensId : null;
    const foundationCost = normalizeFoundationCost(record.foundationCost);
    const leftTotal =
      typeof record.leftTotal === 'number' && Number.isFinite(record.leftTotal)
        ? record.leftTotal
        : null;
    const rightTotal =
      typeof record.rightTotal === 'number' && Number.isFinite(record.rightTotal)
        ? record.rightTotal
        : null;
    if (!lensId || foundationCost === null || leftTotal === null || rightTotal === null) {
      return;
    }
    const createdAt =
      typeof record.createdAt === 'number' && Number.isFinite(record.createdAt)
        ? Math.max(0, Math.floor(record.createdAt))
        : Date.now();
    const vpTotal =
      typeof record.vpTotal === 'number' && Number.isFinite(record.vpTotal) ? record.vpTotal : 0;
    const leftItems = sanitizeCraftedLensSideItems(record.leftItems);
    const rightItems = sanitizeCraftedLensSideItems(record.rightItems);
    const sourceCards = sanitizeCraftedLensSources(record.sourceCards);
    lenses.push({
      lensId,
      createdAt,
      foundationCost,
      leftTotal,
      rightTotal,
      vpTotal,
      leftItems,
      rightItems,
      sourceCards,
    });
  });
  return lenses;
}

function ensureStateDefaults(state: GameState): void {
  if (!Array.isArray(state.labPlacements)) {
    state.labPlacements = [];
  }
  if (!state.board) {
    state.board = {
      lenses: {},
      lobbySlots: [],
      publicDevelopmentCards: [],
      publicVpCards: [],
      foundationStock: cloneDefaultFoundationStock(),
    };
  } else {
    const board = state.board as GameState['board'] & {
      foundationCards?: Record<string, unknown>;
    };
    if (!board.foundationStock || typeof board.foundationStock !== 'object') {
      board.foundationStock = cloneDefaultFoundationStock();
    } else {
      const sanitized: FoundationCardStock = {};
      FOUNDATION_COSTS.forEach((cost) => {
        const raw = board.foundationStock?.[cost];
        const fallback = DEFAULT_FOUNDATION_STOCK[cost] ?? 0;
        const value =
          typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : fallback;
        if (value > 0) {
          sanitized[cost] = value;
        }
      });
      board.foundationStock = sanitized;
    }
    if (board.foundationCards) {
      delete board.foundationCards;
    }
  }
  if (state.players) {
    Object.values(state.players).forEach((player) => {
      if (typeof player.lobbyUsed !== 'number' || Number.isNaN(player.lobbyUsed)) {
        player.lobbyUsed = 0;
      } else {
        player.lobbyUsed = Math.max(0, Math.floor(player.lobbyUsed));
      }
      const legacyHand = (player as { hand?: string[] }).hand;
      if (!Array.isArray(player.collectedDevelopmentCards)) {
        player.collectedDevelopmentCards = Array.isArray(legacyHand) ? [...legacyHand] : [];
      }
      if (!Array.isArray(player.collectedVpCards)) {
        player.collectedVpCards = [];
      }
      if (!player.collectedFoundationCards || typeof player.collectedFoundationCards !== 'object') {
        player.collectedFoundationCards = {};
      } else {
        const sanitized: FoundationCardStock = {};
        FOUNDATION_COSTS.forEach((cost) => {
          const raw = player.collectedFoundationCards?.[cost];
          if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
            sanitized[cost] = Math.max(0, Math.floor(raw));
          }
        });
        player.collectedFoundationCards = sanitized;
      }
      if (!Array.isArray(player.craftedLenses)) {
        player.craftedLenses = [];
      } else {
        player.craftedLenses = sanitizeCraftedLenses(player.craftedLenses);
      }
      if (legacyHand) {
        (player as { hand?: string[] }).hand = [];
      }
      const legacyStock =
        typeof player.lobbyStock === 'number' && Number.isFinite(player.lobbyStock)
          ? Math.max(0, Math.floor(player.lobbyStock))
          : null;
      if (legacyStock !== null) {
        player.lobbyReserve = player.lobbyReserve ?? legacyStock;
        player.lobbyAvailable = player.lobbyAvailable ?? legacyStock;
      }
      if (typeof player.lobbyReserve !== 'number' || Number.isNaN(player.lobbyReserve)) {
        player.lobbyReserve = RoomService.DEFAULT_LOBBY_STOCK;
      }
      if (typeof player.lobbyAvailable !== 'number' || Number.isNaN(player.lobbyAvailable)) {
        player.lobbyAvailable = RoomService.DEFAULT_LOBBY_STOCK;
      }
      if (typeof player.lobbyUsed !== 'number' || Number.isNaN(player.lobbyUsed)) {
        player.lobbyUsed = 0;
      } else {
        player.lobbyUsed = Math.max(0, Math.floor(player.lobbyUsed));
      }
    });
  }
}

export class RoomService {
  constructor(private readonly adapter: FirestoreAdapter) {}

  public static readonly DEFAULT_LOBBY_STOCK = 4;

  async createRoom(params: CreateRoomParams): Promise<GameState> {
    const snapshot = await this.adapter.loadGameState(params.roomId);
    const state = snapshot.state;
    ensureStateDefaults(state);

    if (!Array.isArray(state.turnOrder)) {
      state.turnOrder = [];
    }

    state.lifecycleStage = 'lobby';

    const existingResources = state.players[params.hostId]?.resources;
    state.players[params.hostId] = {
      playerId: params.hostId,
      displayName: params.hostName,
      isHost: true,
      isReady: false,
      actionPoints: 0,
      creativity: 0,
      vp: 0,
      resources: existingResources ?? {
        light: 0,
        rainbow: 0,
        stagnation: 0,
        maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
      },
      collectedDevelopmentCards: [],
      collectedVpCards: [],
      collectedFoundationCards: {},
      craftedLenses: [],
      ownedLenses: [],
      tasksCompleted: [],
      hasPassed: false,
      isRooting: false,
      unlockedCharacterNodes: [],
      lobbyReserve: RoomService.DEFAULT_LOBBY_STOCK,
      lobbyAvailable: RoomService.DEFAULT_LOBBY_STOCK,
      lobbyUsed: 0,
    };

    if (!state.currentPlayerId) {
      state.currentPlayerId = params.hostId;
    }

    sanitizeTurnOrder(state);

    await snapshot.save();
    return state;
  }

  async beginCharacterSelection(params: BeginCharacterSelectionParams): Promise<GameState> {
    const snapshot = await this.adapter.loadGameState(params.roomId);
    const state = snapshot.state;
    ensureStateDefaults(state);
    const requester = state.players[params.requesterId];
    if (!requester) {
      throw new Error('Player not found.');
    }
    if (!requester.isHost) {
      throw new Error('Only the host can initiate character selection.');
    }
    if (state.lifecycleStage === 'inGame') {
      throw new Error('Game already started.');
    }
    state.lifecycleStage = 'characterSelect';
    await snapshot.save();
    return state;
  }

  async updateLifecycleStage(params: UpdateLifecycleStageParams): Promise<GameState> {
    const snapshot = await this.adapter.loadGameState(params.roomId);
    const state = snapshot.state;
    ensureStateDefaults(state);
    state.lifecycleStage = params.stage;
    await snapshot.save();
    return state;
  }

  async joinRoom(params: JoinRoomParams): Promise<GameState> {
    const snapshot = await this.adapter.loadGameState(params.roomId);
    const state = snapshot.state;
    ensureStateDefaults(state);

    if (!Array.isArray(state.turnOrder)) {
      state.turnOrder = [];
    }

    if (!state.players[params.playerId]) {
      const resources = state.players[params.playerId]?.resources ?? {
        light: 0,
        rainbow: 0,
        stagnation: 0,
        maxCapacity: { light: 6, rainbow: 6, stagnation: 6 },
      };
      state.players[params.playerId] = {
        playerId: params.playerId,
        displayName: params.playerName,
        isHost: false,
        isReady: false,
        actionPoints: 0,
        creativity: 0,
        vp: 0,
        resources,
        collectedDevelopmentCards: [],
        collectedVpCards: [],
      collectedFoundationCards: {},
      craftedLenses: [],
      ownedLenses: [],
      tasksCompleted: [],
      hasPassed: false,
      isRooting: false,
      unlockedCharacterNodes: [],
      lobbyReserve: RoomService.DEFAULT_LOBBY_STOCK,
      lobbyAvailable: RoomService.DEFAULT_LOBBY_STOCK,
      lobbyUsed: 0,
    };
  }

    if (!state.turnOrder.includes(params.playerId)) {
      state.turnOrder.push(params.playerId);
    }
    sanitizeTurnOrder(state);

    await snapshot.save();
    return state;
  }

  async leaveRoom(params: LeaveRoomParams): Promise<GameState> {
    const snapshot = await this.adapter.loadGameState(params.roomId);
    const state = snapshot.state;
    ensureStateDefaults(state);

    delete state.players[params.playerId];

    if (Array.isArray(state.turnOrder)) {
      state.turnOrder = state.turnOrder.filter((id) => id !== params.playerId);
    } else {
      state.turnOrder = [];
    }

    const remainingPlayers = Object.keys(state.players);

    if (remainingPlayers.length === 0) {
      state.currentPlayerId = null;
    } else if (state.currentPlayerId === params.playerId) {
      state.currentPlayerId = this.pickRandomPlayer(remainingPlayers);
    }

    sanitizeTurnOrder(state);

    await snapshot.save();
    return state;
  }

  async randomizeTurnOrder(roomId: string): Promise<PlayerId[] | null> {
    const snapshot = await this.adapter.loadGameState(roomId);
    const state = snapshot.state;
    ensureStateDefaults(state);
    const playerIds = Object.keys(state.players);
    if (playerIds.length === 0) {
      state.turnOrder = [];
      state.currentPlayerId = null;
      return null;
    }
    shuffle(playerIds);
    state.turnOrder = [...playerIds];
    state.currentPlayerId = playerIds[0];
    sanitizeTurnOrder(state);
    await snapshot.save();
    return state.turnOrder;
  }

  async updateTurnOrder(params: UpdateTurnOrderParams): Promise<PlayerId[]> {
    const snapshot = await this.adapter.loadGameState(params.roomId);
    const state = snapshot.state;
    ensureStateDefaults(state);

    const playerIds = new Set(Object.keys(state.players));
    const nextOrder: PlayerId[] = [];

    params.order.forEach((playerId) => {
      if (playerIds.has(playerId) && !nextOrder.includes(playerId)) {
        nextOrder.push(playerId);
      }
    });

    playerIds.forEach((playerId) => {
      if (!nextOrder.includes(playerId)) {
        nextOrder.push(playerId);
      }
    });

    state.turnOrder = nextOrder;
    state.currentPlayerId = nextOrder[0] ?? null;
    sanitizeTurnOrder(state);
    await snapshot.save();
    return state.turnOrder;
  }

  async adjustPlayerForTest(params: AdjustPlayerForTestParams): Promise<void> {
    const snapshot = await this.adapter.loadGameState(params.roomId);
    const state = snapshot.state;
    ensureStateDefaults(state);
    const player = state.players[params.playerId];
    if (!player) {
      throw new Error('Player not found.');
    }

    if (typeof player.lobbyReserve !== 'number' || Number.isNaN(player.lobbyReserve)) {
      player.lobbyReserve = RoomService.DEFAULT_LOBBY_STOCK;
    }
    if (typeof player.lobbyAvailable !== 'number' || Number.isNaN(player.lobbyAvailable)) {
      player.lobbyAvailable = RoomService.DEFAULT_LOBBY_STOCK;
    }

    if (params.resources) {
      (['light', 'rainbow', 'stagnation'] as const).forEach((resource) => {
        const value = params.resources?.[resource];
        if (typeof value === 'number' && Number.isFinite(value)) {
          player.resources[resource] = Math.max(0, Math.floor(value));
        }
      });
    }

    if (typeof params.lobbyReserve === 'number' && Number.isFinite(params.lobbyReserve)) {
      player.lobbyReserve = Math.max(0, Math.floor(params.lobbyReserve));
    }
    if (typeof params.lobbyAvailable === 'number' && Number.isFinite(params.lobbyAvailable)) {
      player.lobbyAvailable = Math.max(0, Math.floor(params.lobbyAvailable));
    }
    if (typeof params.lobbyUsed === 'number' && Number.isFinite(params.lobbyUsed)) {
      player.lobbyUsed = Math.max(0, Math.floor(params.lobbyUsed));
    }
    if (typeof params.lobbyStock === 'number' && Number.isFinite(params.lobbyStock)) {
      const stock = Math.max(0, Math.floor(params.lobbyStock));
      player.lobbyReserve = stock;
      player.lobbyAvailable = stock;
    }

    if (typeof params.lensCount === 'number' && Number.isFinite(params.lensCount)) {
      const target = Math.max(0, Math.floor(params.lensCount));
      if (!Array.isArray(player.ownedLenses)) {
        player.ownedLenses = [];
      }
      const realLenses = player.ownedLenses.filter((lensId) => !lensId.startsWith('debug-lens-'));
      let nextOwned = realLenses.slice(0, Math.min(realLenses.length, target));
      if (target > nextOwned.length) {
        const needed = target - nextOwned.length;
        const timestamp = Date.now();
        const debugLenses = Array.from({ length: needed }, (_, index) => `debug-lens-${timestamp}-${index}`);
        nextOwned = nextOwned.concat(debugLenses);
      }
      player.ownedLenses = nextOwned;
    }

    await snapshot.save();
  }

  async selectCharacter(params: SelectCharacterParams): Promise<GameState> {
    const snapshot = await this.adapter.loadGameState(params.roomId);
    const state = snapshot.state;
    ensureStateDefaults(state);

    const player = state.players[params.playerId];
    if (!player) {
      throw new Error('Player not found.');
    }

    const conflicting = Object.values(state.players).find(
      (p) => p.playerId !== params.playerId && p.characterId === params.characterId,
    );
    if (conflicting) {
      throw new Error('Selected character is already taken.');
    }

    player.characterId = params.characterId;

    await snapshot.save();
    return state;
  }

  async getRoomState(roomId: string): Promise<GameState> {
    const snapshot = await this.adapter.loadGameState(roomId);
    const state = snapshot.state;
    ensureStateDefaults(state);
    if (!state.lifecycleStage) {
      state.lifecycleStage = 'lobby';
    }
    sanitizeTurnOrder(state);
    return state;
  }

  private pickRandomPlayer(playerIds: PlayerId[]): PlayerId {
    if (playerIds.length === 0) {
      throw new Error('Cannot pick a player from an empty list.');
    }
    const index = Math.floor(Math.random() * playerIds.length);
    return playerIds[index];
  }
}

function shuffle<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function sanitizeTurnOrder(state: GameState): void {
  const players = Object.keys(state.players);
  if (!Array.isArray(state.turnOrder)) {
    state.turnOrder = [];
  }

  const playerSet = new Set(players);
  const newOrder: PlayerId[] = [];
  state.turnOrder.forEach((playerId) => {
    if (playerSet.has(playerId) && !newOrder.includes(playerId)) {
      newOrder.push(playerId);
    }
  });

  players.forEach((playerId) => {
    if (!newOrder.includes(playerId)) {
      newOrder.push(playerId);
    }
  });

  state.turnOrder = newOrder;

  if (newOrder.length === 0) {
    state.currentPlayerId = null;
    return;
  }

  if (!newOrder.includes(state.currentPlayerId ?? '')) {
    state.currentPlayerId = newOrder[0];
  }
}
