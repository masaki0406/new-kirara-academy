import type {
  GameState,
  DevelopmentCardId,
  CatalogDevelopmentCard,
} from '../../packages/domain/src/types';

const DECK_DOCUMENT_PATH = 'card_foundation/cards_normal';
const DECK_COLLECTION_PATH = 'cards_normal';
const VP_COLLECTION_PATH = 'cards_vp';
const CACHE_TTL_MS = 5 * 60 * 1000;

type DeckTemplate = DevelopmentCardId[];

let cachedTemplate: DeckTemplate | null = null;
let cacheFetchedAt = 0;
let cachedVpTemplate: DeckTemplate | null = null;
let vpCacheFetchedAt = 0;

type AdminFirestore = {
  doc(path: string): {
    get(): Promise<{ exists: boolean; data(): unknown }>;
  };
  collection(path: string): {
    get(): Promise<{
      empty: boolean;
      docs: Array<{ id: string; data(): Record<string, unknown> }>;
    }>;
  };
};

export function createDevelopmentDeckInitializer(firestore: AdminFirestore) {
  return async function initializeDevelopmentDeck(gameState: GameState): Promise<void> {
    if (gameState.developmentDeckInitialized) {
      return;
    }
    if (gameState.developmentDeck.length > 0 || gameState.board.publicDevelopmentCards.length > 0) {
      gameState.developmentDeckInitialized = true;
      return;
    }

    const template = await getDeckTemplate(firestore);
    if (!template || template.length === 0) {
      console.warn(
        `[developmentDeck] No card IDs available from ${DECK_DOCUMENT_PATH}; deck remains empty.`,
      );
      return;
    }

    gameState.developmentDeck = shuffleDeck(template);
    gameState.developmentDeckInitialized = true;
  };
}

export function createVpDeckInitializer(
  firestore: AdminFirestore,
  options: { publicSlots?: number } = {},
) {
  const requiredSlots = typeof options.publicSlots === 'number' ? options.publicSlots : 2;
  return async function initializeVpDeck(gameState: GameState): Promise<void> {
    if (!Array.isArray(gameState.board.publicVpCards)) {
      gameState.board.publicVpCards = [];
    }
    if (!Array.isArray(gameState.vpDeck)) {
      gameState.vpDeck = [];
    }

    if (gameState.vpDeckInitialized) {
      if (gameState.board.publicVpCards.length < requiredSlots) {
        replenishVpRow(gameState, requiredSlots);
      }
      return;
    }

    if (gameState.vpDeck.length === 0) {
      const template = await getVpDeckTemplate(firestore);
      if (!template || template.length === 0) {
        console.warn(
          `[vpDeck] No card IDs available from ${VP_COLLECTION_PATH}; deck remains empty.`,
        );
        gameState.board.publicVpCards = [];
        gameState.vpDeckInitialized = true;
        return;
      }
      gameState.vpDeck = shuffleDeck(template);
    }

    replenishVpRow(gameState, requiredSlots);
    gameState.vpDeckInitialized = true;
  };
}

async function getDeckTemplate(firestore: AdminFirestore): Promise<DeckTemplate> {
  const now = Date.now();
  if (cachedTemplate && now - cacheFetchedAt < CACHE_TTL_MS) {
    return cachedTemplate;
  }

  try {
    const fromDocument = await loadFromDocument(firestore);
    if (fromDocument.length > 0) {
      cachedTemplate = fromDocument;
      cacheFetchedAt = now;
      return cachedTemplate;
    }

    const fromCollection = await loadFromCollection(firestore);
    cachedTemplate = fromCollection;
    cacheFetchedAt = now;
    return cachedTemplate;
  } catch (error) {
    console.error('[developmentDeck] Failed to load deck template:', error);
    cachedTemplate = [];
    cacheFetchedAt = now;
    return cachedTemplate;
  }
}

async function getVpDeckTemplate(firestore: AdminFirestore): Promise<DeckTemplate> {
  const now = Date.now();
  if (cachedVpTemplate && now - vpCacheFetchedAt < CACHE_TTL_MS) {
    return cachedVpTemplate;
  }

  try {
    const snapshot = await firestore.collection(VP_COLLECTION_PATH).get();
    if (snapshot.empty) {
      console.warn(
        `[vpDeck] Collection ${VP_COLLECTION_PATH} is empty; deck cannot be built.`,
      );
      cachedVpTemplate = [];
      vpCacheFetchedAt = now;
      return cachedVpTemplate;
    }

    const result: DevelopmentCardId[] = [];
    snapshot.docs.forEach((doc) => {
      const data = doc.data() ?? {};
      const ids = extractCardIds(data);
      if (ids.length > 0) {
        result.push(...ids);
        return;
      }
      const raw = typeof data.cardId === 'string' ? data.cardId : undefined;
      const resolved = (raw ?? doc.id).trim();
      if (resolved) {
        result.push(resolved as DevelopmentCardId);
      }
    });
    cachedVpTemplate = result;
    vpCacheFetchedAt = now;
    return cachedVpTemplate;
  } catch (error) {
    console.error(
      `[vpDeck] Failed to load collection ${VP_COLLECTION_PATH}:`,
      error instanceof Error ? error.message : error,
    );
    cachedVpTemplate = [];
    vpCacheFetchedAt = now;
    return cachedVpTemplate;
  }
}

async function loadFromDocument(firestore: AdminFirestore): Promise<DeckTemplate> {
  if (!DECK_DOCUMENT_PATH.includes('/')) {
    return [];
  }

  try {
    const snapshot = await firestore.doc(DECK_DOCUMENT_PATH).get();
    if (!snapshot.exists) {
      return [];
    }
    const cardIds = extractCardIds(snapshot.data());
    if (cardIds.length === 0) {
      return [];
    }
    return cardIds;
  } catch (error) {
    console.warn(
      `[developmentDeck] Unable to read document ${DECK_DOCUMENT_PATH}:`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function loadFromCollection(firestore: AdminFirestore): Promise<DeckTemplate> {
  try {
    const snapshot = await firestore.collection(DECK_COLLECTION_PATH).get();
    if (snapshot.empty) {
      console.warn(
        `[developmentDeck] Collection ${DECK_COLLECTION_PATH} is empty; deck cannot be built.`,
      );
      return [];
    }

    const result: DevelopmentCardId[] = [];
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const ids = extractCardIds(data);
      if (ids.length > 0) {
        result.push(...ids);
        return;
      }
      result.push(doc.id as DevelopmentCardId);
    });
    return result;
  } catch (error) {
    console.error(
      `[developmentDeck] Failed to load collection ${DECK_COLLECTION_PATH}:`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function extractCardIds(source: unknown): DevelopmentCardId[] {
  if (!source || typeof source !== 'object') {
    return [];
  }

  const record = source as Record<string, unknown>;
  const candidateKeys = ['cards', 'cardIds', 'deck', 'ids', 'list'];
  for (const key of candidateKeys) {
    if (key in record) {
      const ids = normalizeCardIdList(record[key]);
      if (ids.length > 0) {
        return ids;
      }
    }
  }

  const single = maybeSingleCardId(record);
  if (single) {
    const repeat = toRepeatCount(record.count ?? record.quantity ?? record.repeat ?? 1);
    return new Array(repeat).fill(single) as DevelopmentCardId[];
  }

  return [];
}

function normalizeCardIdList(value: unknown): DevelopmentCardId[] {
  const result: DevelopmentCardId[] = [];
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (trimmed) {
          result.push(trimmed as DevelopmentCardId);
        }
        return;
      }
      if (entry && typeof entry === 'object') {
        const map = entry as Record<string, unknown>;
        const id = maybeSingleCardId(map);
        if (id) {
          const repeat = toRepeatCount(map.count ?? map.quantity ?? map.repeat ?? map.copies ?? 1);
          for (let i = 0; i < repeat; i += 1) {
            result.push(id);
          }
        }
      }
    });
    return result;
  }

  if (value && typeof value === 'object') {
    const map = value as Record<string, unknown>;
    const id = maybeSingleCardId(map);
    if (id) {
      const repeat = toRepeatCount(map.count ?? map.quantity ?? map.repeat ?? map.copies ?? 1);
      for (let i = 0; i < repeat; i += 1) {
        result.push(id);
      }
      return result;
    }
  }

  return result;
}

function maybeSingleCardId(record: Record<string, unknown>): DevelopmentCardId | null {
  const candidate =
    typeof record.cardId === 'string'
      ? record.cardId
      : typeof record.id === 'string'
        ? record.id
        : typeof record.card_id === 'string'
          ? record.card_id
          : typeof record.key === 'string'
            ? record.key
            : undefined;

  if (candidate) {
    const trimmed = candidate.trim();
    if (trimmed) {
      return trimmed as DevelopmentCardId;
    }
  }
  return null;
}

function toRepeatCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }
  return 1;
}

function shuffleDeck(source: DeckTemplate): DeckTemplate {
  const deck = [...source];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function replenishVpRow(gameState: GameState, requiredSlots: number): void {
  const board = gameState.board;
  if (!Array.isArray(board.publicVpCards)) {
    board.publicVpCards = [];
  }
  if (!Array.isArray(gameState.vpDeck)) {
    gameState.vpDeck = [];
  }

  while (board.publicVpCards.length < requiredSlots && gameState.vpDeck.length > 0) {
    const card = gameState.vpDeck.shift();
    if (!card) {
      break;
    }
    board.publicVpCards.push(card);
  }
}

export async function loadDevelopmentCardCatalog(
  firestore: AdminFirestore,
): Promise<CatalogDevelopmentCard[]> {
  const snapshot = await firestore.collection(DECK_COLLECTION_PATH).get();
  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map((doc) => {
    const data = doc.data() ?? {};
    const cardIdRaw = typeof data.cardId === 'string' ? data.cardId : undefined;
    const cardId = (cardIdRaw ?? doc.id).trim();
    const costItem = typeof data.cost_item === 'string' ? data.cost_item : undefined;
    const costNumber = toOptionalNumber(data.cost_num);
    const costPosition = toOptionalNumber(data.cost_pos);
    const costLeftUp = toNumberMap(data.cost_leftup);
    const costLeftDown = toNumberMap(data.cost_leftdown);

    const extras: Record<string, unknown> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (
        key === 'cardId' ||
        key === 'cost_item' ||
        key === 'cost_num' ||
        key === 'cost_pos' ||
        key === 'cost_leftup' ||
        key === 'cost_leftdown'
      ) {
        return;
      }
      extras[key] = value;
    });

    return {
      id: doc.id,
      cardId,
      costItem,
      costNumber,
      costPosition,
      costLeftUp,
      costLeftDown,
      extras: Object.keys(extras).length > 0 ? extras : undefined,
    };
  });
}

export async function loadVpCardCatalog(
  firestore: AdminFirestore,
): Promise<CatalogDevelopmentCard[]> {
  const snapshot = await firestore.collection(VP_COLLECTION_PATH).get();
  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map((doc) => {
    const data = doc.data() ?? {};
    const cardIdRaw = typeof data.cardId === 'string' ? data.cardId : undefined;
    const cardId = (cardIdRaw ?? doc.id).trim();
    const costItem = typeof data.cost_item === 'string' ? data.cost_item : undefined;
    const costNumber = toOptionalNumber(data.cost_num);
    const costPosition = toOptionalNumber(data.cost_pos);
    const costLeftUp = toNumberMap(data.cost_leftup);
    const costLeftDown = toNumberMap(data.cost_leftdown);

    const extras: Record<string, unknown> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (
        key === 'cardId' ||
        key === 'cost_item' ||
        key === 'cost_num' ||
        key === 'cost_pos' ||
        key === 'cost_leftup' ||
        key === 'cost_leftdown'
      ) {
        return;
      }
      extras[key] = value;
    });

    return {
      id: doc.id,
      cardId,
      costItem,
      costNumber,
      costPosition,
      costLeftUp,
      costLeftDown,
      extras: Object.keys(extras).length > 0 ? extras : undefined,
    };
  });
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function toNumberMap(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const result: Record<string, number> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    const num = toOptionalNumber(raw);
    if (typeof num === 'number') {
      result[key] = num;
    }
  });
  return Object.keys(result).length > 0 ? result : undefined;
}
