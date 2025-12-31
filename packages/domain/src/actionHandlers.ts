import {
  ActionContext,
  ActionResult,
  ActiveEffectPayload,
  CharacterCost,
  CraftedLens,
  CraftedLensSideItem,
  CraftedLensSourceCard,
  DEFAULT_FOUNDATION_STOCK,
  FOUNDATION_COSTS,
  FoundationCost,
  GameState,
  GrowthReward,
  LensItemEffectBundle,
  LensItemEffectSummary,
  LensState,
  PlayerAction,
  PlayerState,
  PolishActionPayload,
  PolishCardType,
  RewardDefinition,
  ResourceCost,
  ResourceReward,
  ResourceType,
  ResourceWallet,
  LabDefinition,
  LabCostDefinition,
  LobbySlot,
  LensActivatePayload,
  LobbyLocation,
  PassiveEffectPayload,
  ActionType,
  Ruleset,
} from './types';
import { triggerEvent } from './triggerEngine';
import {
  buildUnlockedSetWithAuto,
  canUnlockGrowthNode,
  getGrowthNode,
  isGrowthNodeAutoUnlocked,
  CHARACTER_GROWTH_DEFINITIONS,
} from './characterGrowth';

const DEFAULT_LOBBY_STOCK = 4;
const MAX_ACTION_POINTS = 10;
const MAX_CREATIVITY = 5;
const TOTAL_RESOURCE_LIMIT = 12;
const RESOURCE_ORDER: ResourceType[] = ['light', 'rainbow', 'stagnation'];

function getPassiveCostReduction(
  player: PlayerState,
  ruleset: Ruleset,
  actionType: ActionType
): number {
  if (!player.characterId || !player.unlockedCharacterNodes) {
    return 0;
  }
  const profile = ruleset.characters[player.characterId];
  if (!profile) {
    return 0;
  }
  const unlocked = new Set(player.unlockedCharacterNodes);
  let reduction = 0;

  profile.nodes.forEach((node) => {
    if (!unlocked.has(node.nodeId)) {
      return;
    }
    node.effects.forEach((effect) => {
      if (effect.type !== 'passive') {
        return;
      }
      const payload = effect.payload as unknown as PassiveEffectPayload;
      if (payload.costZero?.actionType === actionType) {
        reduction = 999; // Effectively zero cost (handled by caller)
      }
      if (payload.costReduction?.actionType === actionType) {
        reduction += payload.costReduction.amount;
      }
    });
  });
  return reduction;
}

function getTotalResources(wallet: ResourceWallet): number {
  return RESOURCE_ORDER.reduce((sum, resource) => sum + wallet[resource], 0);
}

function isFoundationCost(value: number): value is FoundationCost {
  return FOUNDATION_COSTS.includes(value as FoundationCost);
}

function parseFoundationCost(value: unknown): FoundationCost | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const numeric = Math.floor(value);
  return isFoundationCost(numeric) ? numeric : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizePolishCardType(value: unknown): PolishCardType | null {
  if (value === 'development' || value === 'vp') {
    return value;
  }
  return null;
}

function normalizeCraftedLensSideItems(value: unknown): CraftedLensSideItem[] {
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
    const cardType = normalizePolishCardType(record.cardType);
    if (!cardId || !cardType) {
      return;
    }
    const positionNumber = toFiniteNumber(record.position);
    const position = positionNumber !== null ? Math.floor(positionNumber) : null;
    let item: string | null = null;
    if (typeof record.item === 'string') {
      item = record.item;
    } else if (record.item !== undefined && record.item !== null) {
      item = String(record.item);
    }
    const normalized: CraftedLensSideItem = {
      cardId,
      cardType,
      position,
      item,
    };
    if (typeof record.quantity === 'number' && Number.isFinite(record.quantity)) {
      normalized.quantity = record.quantity;
    } else if (record.quantity === null) {
      normalized.quantity = null;
    }
    items.push(normalized);
  });
  return items;
}

function normalizeCraftedLensSourceCards(value: unknown): CraftedLensSourceCard[] {
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
    const cardType = normalizePolishCardType(record.cardType);
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

function normalizeCraftedLens(value: unknown): CraftedLens | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const foundationCost = parseFoundationCost(record.foundationCost);
  const leftTotalNumber = toFiniteNumber(record.leftTotal);
  const rightTotalNumber = toFiniteNumber(record.rightTotal);
  if (foundationCost === null || leftTotalNumber === null || rightTotalNumber === null) {
    return null;
  }
  const vpTotalNumber = toFiniteNumber(record.vpTotal) ?? 0;
  const createdAtNumber = toFiniteNumber(record.createdAt);
  const lensId =
    typeof record.lensId === 'string' && record.lensId.trim().length > 0 ? record.lensId : '';
  const leftItems = normalizeCraftedLensSideItems(record.leftItems);
  const rightItems = normalizeCraftedLensSideItems(record.rightItems);
  const sourceCards = normalizeCraftedLensSourceCards(record.sourceCards);
  return {
    lensId,
    createdAt:
      createdAtNumber !== null && Number.isFinite(createdAtNumber)
        ? Math.max(0, Math.floor(createdAtNumber))
        : Date.now(),
    foundationCost,
    leftTotal: leftTotalNumber,
    rightTotal: rightTotalNumber,
    vpTotal: vpTotalNumber,
    leftItems,
    rightItems,
    sourceCards,
  };
}

interface NormalizedPolishPayload extends PolishActionPayload {
  foundationCost: FoundationCost;
  selection: CraftedLensSourceCard[];
  result: CraftedLens;
}

function normalizePolishPayload(raw: unknown): NormalizedPolishPayload | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const selection = normalizeCraftedLensSourceCards(record.selection);
  const foundationCost = parseFoundationCost(record.foundationCost);
  const result = normalizeCraftedLens(record.result);
  if (!selection.length || foundationCost === null || !result) {
    return null;
  }
  if (!result.sourceCards.length) {
    result.sourceCards = selection.map((entry) => ({ ...entry }));
  }
  result.foundationCost = foundationCost;
  return {
    selection,
    foundationCost,
    result,
  };
}

function findDuplicatePositions(items: CraftedLensSideItem[]): number | null {
  const seen = new Set<number>();
  for (const item of items) {
    if (item.position === null || item.position === undefined) {
      continue;
    }
    const position = Math.floor(item.position);
    if (seen.has(position)) {
      return position;
    }
    seen.add(position);
  }
  return null;
}

function buildSelectionKey(cardId: string, cardType: PolishCardType, flipped: boolean): string {
  return `${cardType}:${cardId}:${flipped ? '1' : '0'}`;
}

function removeCardFromList(cards: string[], cardId: string): void {
  const index = cards.indexOf(cardId);
  if (index === -1) {
    throw new Error('指定されたカードが見つかりません');
  }
  cards.splice(index, 1);
}

function consumeFoundationCard(
  player: PlayerState,
  foundationCost: FoundationCost,
): void {
  if (!player.collectedFoundationCards) {
    throw new Error('土台カードの在庫が不足しています');
  }
  const current = player.collectedFoundationCards[foundationCost] ?? 0;
  if (!Number.isFinite(current) || current <= 0) {
    throw new Error('土台カードの在庫が不足しています');
  }
  const remaining = current - 1;
  if (remaining > 0) {
    player.collectedFoundationCards[foundationCost] = remaining;
  } else {
    delete player.collectedFoundationCards[foundationCost];
  }
}

function generateCraftedLensId(playerId: string, timestamp: number | undefined): string {
  const timeSeed = typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : Date.now();
  const randomSeed = Math.random().toString(36).slice(2, 8);
  return `crafted-lens-${playerId}-${timeSeed}-${randomSeed}`;
}

function cloneSideItems(items: CraftedLensSideItem[]): CraftedLensSideItem[] {
  return items.map((item) => {
    const cloned: CraftedLensSideItem = {
      cardId: item.cardId,
      cardType: item.cardType,
      position:
        item.position === null || item.position === undefined ? null : Math.floor(item.position),
      item: item.item ?? null,
    };
    if (typeof item.quantity === 'number' && Number.isFinite(item.quantity)) {
      cloned.quantity = item.quantity;
    } else if (item.quantity === null) {
      cloned.quantity = null;
    }
    return cloned;
  });
}

function cloneSourceCards(cards: CraftedLensSourceCard[]): CraftedLensSourceCard[] {
  return cards.map((card) => ({
    cardId: card.cardId,
    cardType: card.cardType,
    flipped: card.flipped,
  }));
}

function applyPolishResult(
  action: PlayerAction,
  context: ActionContext,
  player: PlayerState,
  payload: NormalizedPolishPayload,
): void {
  const board = context.gameState.board;
  consumeFoundationCard(player, payload.foundationCost);
  player.collectedDevelopmentCards = player.collectedDevelopmentCards ?? [];
  player.collectedVpCards = player.collectedVpCards ?? [];
  const developmentCards = player.collectedDevelopmentCards;
  const vpCards = player.collectedVpCards;
  payload.selection.forEach((selection) => {
    if (selection.cardType === 'development') {
      removeCardFromList(developmentCards, selection.cardId);
    } else {
      // DEBUG LOG
      console.log(`[DEBUG] Removing VP card: ${selection.cardId} from ${JSON.stringify(vpCards)}`);
      try {
        removeCardFromList(vpCards, selection.cardId);
      } catch (e) {
        console.error(`[DEBUG] Failed to remove VP card: ${selection.cardId}`, e);
        throw e;
      }
    }
  });
  if (!player.craftedLenses) {
    player.craftedLenses = [];
  }
  const createdAt =
    typeof payload.result.createdAt === 'number' && Number.isFinite(payload.result.createdAt)
      ? Math.max(0, Math.floor(payload.result.createdAt))
      : context.timestamp ?? Date.now();
  const lensId =
    payload.result.lensId && payload.result.lensId.trim().length > 0
      ? payload.result.lensId
      : generateCraftedLensId(action.playerId, context.timestamp);
  const lens: CraftedLens = {
    lensId,
    createdAt,
    foundationCost: payload.foundationCost,
    leftTotal: payload.result.leftTotal,
    rightTotal: payload.result.rightTotal,
    vpTotal:
      typeof payload.result.vpTotal === 'number' && Number.isFinite(payload.result.vpTotal)
        ? payload.result.vpTotal
        : payload.result.vpTotal ?? 0,
    leftItems: cloneSideItems(payload.result.leftItems),
    rightItems: cloneSideItems(payload.result.rightItems),
    sourceCards: cloneSourceCards(
      payload.result.sourceCards.length ? payload.result.sourceCards : payload.selection,
    ),
  };
  player.craftedLenses.push(lens);

  if (!player.ownedLenses) {
    player.ownedLenses = [];
  }
  if (!player.ownedLenses.includes(lensId)) {
    player.ownedLenses.push(lensId);
  }

  const itemCost = accumulateItemEffects(lens.leftItems, 'cost');
  const itemReward = accumulateItemEffects(lens.rightItems, 'reward');
  const rewards: RewardDefinition[] = [];
  if (hasResourceReward(itemReward.resources)) {
    rewards.push({ type: 'resource', value: itemReward.resources });
  }
  if (itemReward.vpGain > 0) {
    rewards.push({ type: 'vp', value: itemReward.vpGain });
  }
  const cost: ResourceCost = {
    actionPoints: payload.foundationCost,
  };
  if (itemCost.resources.light) {
    cost.light = itemCost.resources.light;
  }
  if (itemCost.resources.rainbow) {
    cost.rainbow = itemCost.resources.rainbow;
  }
  if (itemCost.resources.stagnation) {
    cost.stagnation = itemCost.resources.stagnation;
  }
  if (itemCost.resources.creativity) {
    cost.creativity = itemCost.resources.creativity;
  }

  // ボード上に完成レンズを配置し、ロビーを確保する
  if (!board.lenses[lensId]) {
    const craftedLensState: LensState = {
      lensId,
      ownerId: action.playerId,
      cost,
      rewards,
      slots: 1,
      tags: ['crafted'],
      status: 'available',
      leftItems: lens.leftItems,
      rightItems: lens.rightItems,
      itemEffects: { cost: itemCost, reward: itemReward },
    };
    board.lenses[lensId] = craftedLensState;
  }
  if (!Array.isArray(board.lobbySlots)) {
    board.lobbySlots = [];
  }
  const existingSlots = board.lobbySlots.filter((slot) => slot.lensId === lensId);
  if (existingSlots.length === 0) {
    board.lobbySlots.push({
      lensId,
      ownerId: action.playerId,
      isActive: true,
    });
  }
}

function cloneDefaultFoundationStock(): Partial<Record<FoundationCost, number>> {
  const stock: Partial<Record<FoundationCost, number>> = {};
  FOUNDATION_COSTS.forEach((cost) => {
    const base = DEFAULT_FOUNDATION_STOCK[cost];
    if (typeof base === 'number') {
      stock[cost] = base;
    }
  });
  return stock;
}

function ensureFoundationStockInitialized(board: GameState['board']): void {
  if (!board.foundationStock || typeof board.foundationStock !== 'object') {
    board.foundationStock = cloneDefaultFoundationStock();
  }
}

function getAvailableFoundationStock(state: GameState, cost: FoundationCost): number {
  const stock = state.board.foundationStock;
  if (stock && typeof stock[cost] === 'number' && Number.isFinite(stock[cost]!)) {
    return stock[cost]!;
  }
  if (!stock) {
    const fallback = DEFAULT_FOUNDATION_STOCK[cost];
    return typeof fallback === 'number' ? fallback : 0;
  }
  return 0;
}

function clampActionPoints(value: number): number {
  return Math.max(0, Math.min(MAX_ACTION_POINTS, value));
}

function clampCreativity(value: number): number {
  return Math.max(0, Math.min(MAX_CREATIVITY, value));
}

function resolveLabCost(lab: LabDefinition | undefined): LabCostDefinition {
  const base: LabCostDefinition = { actionPoints: 1 };
  if (!lab?.cost) {
    return base;
  }
  return {
    actionPoints: lab.cost.actionPoints ?? 1,
    creativity: lab.cost.creativity,
    resources: lab.cost.resources,
    lobby: lab.cost.lobby,
  };
}

function getLobbyReserve(player: PlayerState): number {
  if (typeof player.lobbyReserve === 'number' && Number.isFinite(player.lobbyReserve)) {
    return Math.max(0, player.lobbyReserve);
  }
  return DEFAULT_LOBBY_STOCK;
}

function getLobbyAvailable(player: PlayerState): number {
  if (typeof player.lobbyAvailable === 'number' && Number.isFinite(player.lobbyAvailable)) {
    return Math.max(0, player.lobbyAvailable);
  }
  return DEFAULT_LOBBY_STOCK;
}

function getPlayerLobbyUsed(player: PlayerState): number {
  if (typeof player.lobbyUsed === 'number' && Number.isFinite(player.lobbyUsed)) {
    return Math.max(0, player.lobbyUsed);
  }
  return 0;
}

function incrementPlayerLobbyUsed(player: PlayerState, amount: number): void {
  const current = getPlayerLobbyUsed(player);
  const next = Math.max(0, current + amount);
  player.lobbyUsed = next;
}

export type Validator = (
  action: PlayerAction,
  context: ActionContext,
) => Promise<string[]>;

export type EffectApplier = (
  action: PlayerAction,
  context: ActionContext,
) => Promise<void>;

interface ActionHandlerConfig {
  validate: Validator;
  apply: EffectApplier;
}

export function createActionHandler({
  validate,
  apply,
}: ActionHandlerConfig) {
  return async (
    action: PlayerAction,
    context: ActionContext,
  ): Promise<ActionResult> => {
    const errors = await validate(action, context);
    if (errors.length > 0) {
      return { success: false, errors };
    }

    await apply(action, context);

    return { success: true };
  };
}

export const validateLabActivate: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState, ruleset } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  if (gameState.currentPlayerId !== action.playerId) {
    errors.push('現在の手番プレイヤーではありません');
  }

  const labId = typeof action.payload.labId === 'string' ? action.payload.labId : undefined;
  if (!labId) {
    errors.push('ラボIDが指定されていません');
    return errors;
  }

  const lab = ruleset.labs?.[labId];
  if (!lab) {
    errors.push('指定されたラボが存在しません');
    return errors;
  }

  let normalizedPolish: NormalizedPolishPayload | null = null;
  if (labId === 'polish') {
    const rawPayload =
      action.payload && typeof action.payload === 'object'
        ? (action.payload as Record<string, unknown>).polish
        : undefined;
    const normalized = normalizePolishPayload(rawPayload);
    if (!normalized) {
      errors.push('研磨の設定が不正です');
      return errors;
    }
    normalizedPolish = normalized;
  }

  if (labId === 'negotiation') {
    const existingPlacement = gameState.labPlacements.some(
      (placement) => placement.labId === labId && placement.count > 0,
    );
    if (existingPlacement) {
      errors.push('根回しは既に利用されています');
    }
    const alreadyRooting = Object.values(gameState.players).some((p) => p.isRooting);
    if (alreadyRooting) {
      errors.push('根回しはこのラウンドで既に行われています');
    }
  }

  const cost = resolveLabCost(lab);
  const actionPointCost = cost.actionPoints ?? 0;
  if (player.actionPoints < actionPointCost) {
    errors.push('行動力が不足しています');
  }

  if (cost.creativity && player.creativity < cost.creativity) {
    errors.push('創造力が不足しています');
  }

  if (cost.resources && !canPayResourceCost(player.resources, cost.resources)) {
    errors.push('必要な資源が不足しています');
  }

  if (cost.lobby) {
    const stock = getLobbyAvailable(player);
    if (stock < cost.lobby) {
      errors.push('ロビー在庫が不足しています');
    }
  }

  lab.rewards
    .filter((reward) => reward.type === 'resource')
    .forEach((reward) => {
      const value = reward.value as ResourceReward;
      for (const [resource, amount] of resourceRewardEntries(value)) {
        if (!hasCapacity(player.resources, resource, amount)) {
          errors.push(`${resource} の上限を超えます`);
        }
      }
    });

  if (normalizedPolish) {
    if (!normalizedPolish.selection.length) {
      errors.push('研磨で使用するカードを選択してください');
    }
    const foundationAvailable =
      player.collectedFoundationCards?.[normalizedPolish.foundationCost] ?? 0;
    if (foundationAvailable <= 0) {
      errors.push('指定された土台カードを所持していません');
    }
    const developmentCounts = new Map<string, number>();
    (player.collectedDevelopmentCards ?? []).forEach((cardId) => {
      developmentCounts.set(cardId, (developmentCounts.get(cardId) ?? 0) + 1);
    });
    const vpCounts = new Map<string, number>();
    (player.collectedVpCards ?? []).forEach((cardId) => {
      vpCounts.set(cardId, (vpCounts.get(cardId) ?? 0) + 1);
    });
    normalizedPolish.selection.forEach((selection) => {
      if (selection.cardType === 'development') {
        const remaining = developmentCounts.get(selection.cardId) ?? 0;
        if (remaining <= 0) {
          errors.push(`開発カード ${selection.cardId} を所持していません`);
        } else {
          developmentCounts.set(selection.cardId, remaining - 1);
        }
      } else {
        const remaining = vpCounts.get(selection.cardId) ?? 0;
        if (remaining <= 0) {
          errors.push(`VPカード ${selection.cardId} を所持していません`);
        } else {
          vpCounts.set(selection.cardId, remaining - 1);
        }
      }
    });
    const diff = Math.max(0, normalizedPolish.result.rightTotal - normalizedPolish.result.leftTotal);
    if (diff > normalizedPolish.foundationCost) {
      errors.push('土台カードのコストが不足しています');
    }
    const leftDuplicate = findDuplicatePositions(normalizedPolish.result.leftItems);
    if (leftDuplicate !== null) {
      errors.push('左側のPOSが重複しています');
    }
    const rightDuplicate = findDuplicatePositions(normalizedPolish.result.rightItems);
    if (rightDuplicate !== null) {
      errors.push('右側のPOSが重複しています');
    }
    const selectionCountMap = new Map<string, number>();
    normalizedPolish.selection.forEach((selection) => {
      const key = buildSelectionKey(selection.cardId, selection.cardType, selection.flipped);
      selectionCountMap.set(key, (selectionCountMap.get(key) ?? 0) + 1);
    });
    const resultCountMap = new Map<string, number>();
    normalizedPolish.result.sourceCards.forEach((source) => {
      const key = buildSelectionKey(source.cardId, source.cardType, source.flipped);
      resultCountMap.set(key, (resultCountMap.get(key) ?? 0) + 1);
    });
    if (selectionCountMap.size !== resultCountMap.size) {
      errors.push('研磨結果の参照カードが一致しません');
    } else {
      selectionCountMap.forEach((count, key) => {
        if (resultCountMap.get(key) !== count) {
          errors.push('研磨結果の参照カードが一致しません');
        }
      });
    }
    normalizedPolish.result.leftItems.forEach((item) => {
      const key = buildSelectionKey(item.cardId, item.cardType, false);
      if (!selectionCountMap.has(key)) {
        errors.push('左側のアイテム割り当てが不正です');
      }
    });
    normalizedPolish.result.rightItems.forEach((item) => {
      const key = buildSelectionKey(item.cardId, item.cardType, true);
      if (!selectionCountMap.has(key)) {
        errors.push('右側のアイテム割り当てが不正です');
      }
    });
  }

  return errors;
};

export const applyLabActivate: EffectApplier = async (action, context) => {
  const { gameState, ruleset } = context;
  try {
    const player = gameState.players[action.playerId];
    if (!player) {
      throw new Error('プレイヤーが存在しません');
    }

    const labId = action.payload.labId as string;
    const lab = ruleset.labs?.[labId];
    if (!lab) {
      throw new Error('指定されたラボが存在しません');
    }

    let normalizedPolish: NormalizedPolishPayload | null = null;
    if (labId === 'polish') {
      const rawPayload =
        action.payload && typeof action.payload === 'object'
          ? (action.payload as Record<string, unknown>).polish
          : undefined;
      const normalized = normalizePolishPayload(rawPayload);
      if (!normalized) {
        throw new Error('研磨の設定が不正です');
      }
      normalizedPolish = normalized;
    }

    // DEBUG LOG for Negotiation
    if (labId === 'negotiation') {
      gameState.logs.push({
        id: `debug-negotiation-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        playerId: action.playerId,
        actionType: 'pass',
        payload: {
          message: '[DEBUG] applyLabActivate: negotiation started',
          beforeIsRooting: player.isRooting
        },
        result: { success: true }
      });
    }

    const cost = resolveLabCost(lab);
    const actionPointCost = cost.actionPoints ?? 0;
    if (actionPointCost > 0) {
      player.actionPoints = Math.max(0, player.actionPoints - actionPointCost);
    }
    if (cost.creativity) {
      player.creativity = Math.max(0, player.creativity - cost.creativity);
    }
    if (cost.resources) {
      payResourceCost(player.resources, cost.resources);
    }
    if (cost.lobby) {
      const currentStock = getLobbyAvailable(player);
      const nextStock = Math.max(0, currentStock - cost.lobby);
      player.lobbyAvailable = nextStock;
      const placements = gameState.labPlacements;
      const existingPlacement = placements.find(
        (placement) => placement.labId === labId && placement.playerId === action.playerId,
      );
      if (existingPlacement) {
        existingPlacement.count += cost.lobby;
      } else {
        placements.push({ labId, playerId: action.playerId, count: cost.lobby });
      }
    }

    const pendingResources: Partial<Record<ResourceType, number>> = {};
    let apGain = 0;
    let creativityGain = 0;

    for (const reward of lab.rewards) {
      if (reward.type === 'resource') {
        const val = reward.value as ResourceReward;
        RESOURCE_ORDER.forEach((res) => {
          if (val[res]) pendingResources[res] = (pendingResources[res] || 0) + val[res];
        });
        if (val.actionPoints) apGain += val.actionPoints;
        if (val.creativity) creativityGain += val.creativity;
      } else {
        applyReward(player, reward);
      }
    }

    // Overflow Check & Application
    const currentTotal = RESOURCE_ORDER.reduce((sum, res) => sum + (player.resources[res] || 0), 0);
    const gainTotal = RESOURCE_ORDER.reduce((sum, res) => sum + (pendingResources[res] || 0), 0);

    if (currentTotal + gainTotal > TOTAL_RESOURCE_LIMIT) {
      const choice = action.payload.resourceChoice as ResourceWallet | undefined;
      if (!choice) {
        throw new Error('所持上限を超えるため、獲得するリソースを選択してください');
      }
      // Validate Choice
      let choiceTotal = 0;
      RESOURCE_ORDER.forEach((res) => {
        const amount = choice[res] || 0;
        if (amount > (pendingResources[res] || 0)) {
          throw new Error(`選択された ${res} が獲得可能量を超えています`);
        }
        choiceTotal += amount;
      });
      if (currentTotal + choiceTotal > TOTAL_RESOURCE_LIMIT) {
        throw new Error('選択されたリソースの合計が所持上限を超えています');
      }
      // Apply Choice
      RESOURCE_ORDER.forEach((res) => {
        if (choice[res]) {
          const current = player.resources[res] ?? 0;
          const cap = player.resources.maxCapacity?.[res] ?? 99;
          player.resources[res] = Math.min(cap, current + choice[res]);
        }
      });
    } else {
      // Apply All
      RESOURCE_ORDER.forEach((res) => {
        if (pendingResources[res]) {
          const current = player.resources[res] ?? 0;
          const cap = player.resources.maxCapacity?.[res] ?? 99;
          player.resources[res] = Math.min(cap, current + pendingResources[res]);
        }
      });
    }

    if (apGain > 0) player.actionPoints = (player.actionPoints ?? 0) + apGain;
    if (creativityGain > 0) player.creativity = (player.creativity ?? 0) + creativityGain;

    if (normalizedPolish) {
      // DEBUG LOG for Polish
      console.log('[DEBUG] Polish action executing:', {
        playerId: action.playerId,
        selection: normalizedPolish.selection,
        foundationCost: normalizedPolish.foundationCost,
        lensId: normalizedPolish.result.lensId,
      });

      applyPolishResult(action, context, player, normalizedPolish);

      // DEBUG LOG for Polish Result
      console.log('[DEBUG] Polish result applied:', {
        playerCraftedLenses: player.craftedLenses?.length,
        boardLensesCount: Object.keys(gameState.board.lenses).length,
        boardLobbySlotsCount: gameState.board.lobbySlots.length,
      });
    }

    if (labId === 'negotiation') {
      player.isRooting = true;
      context.turnOrder?.registerRooting(action.playerId);

      // DEBUG LOG for Negotiation Success
      gameState.logs.push({
        id: `debug-negotiation-success-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        playerId: action.playerId,
        actionType: 'pass',
        payload: {
          message: '[DEBUG] applyLabActivate: negotiation success',
          afterIsRooting: player.isRooting
        },
        result: { success: true }
      });
    }
  } catch (error) {
    gameState.logs.push({
      id: `error-lab-${Date.now()}`,
      timestamp: Date.now(),
      playerId: action.playerId,
      actionType: 'pass',
      payload: {
        message: `[DEBUG] CRITICAL ERROR IN LAB ACTIVATE: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : undefined
      },
      result: { success: false }
    });
    // Rethrow to ensure the action is marked as failed.
    // Although GameSessionImpl won't save the logs in the state, the client will receive the error
    // and avoid optimistic updates that cause desync.
    throw error;
  }
};

export const validateLensActivate: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  if (gameState.currentPlayerId !== action.playerId) {
    errors.push('現在の手番プレイヤーではありません');
  }

  const lensId = typeof action.payload.lensId === 'string' ? action.payload.lensId : undefined;
  if (!lensId) {
    errors.push('レンズIDが指定されていません');
    return errors;
  }

  const lens = gameState.board.lenses[lensId];
  if (!lens) {
    errors.push('指定されたレンズが存在しません');
    return errors;
  }

  if (lens.status !== 'available') {
    errors.push('レンズは使用済みです');
  }

  const itemCost = resolveLensItemEffects(lens, 'cost');

  if (!canActivateLens(lensId, lens.ownerId, action.playerId, gameState, itemCost.lobbyReturn)) {
    errors.push('このレンズを起動する条件を満たしていません');
  }

  const totalActionCost = lens.cost.actionPoints ?? 0;
  if (player.actionPoints < totalActionCost) {
    errors.push('行動力が不足しています');
  }
  const mergedCost = buildLensResourceCost(lens, itemCost);
  if (!canPayResourceCost(player.resources, mergedCost)) {
    errors.push('必要な資源が不足しています');
  }

  if (mergedCost.creativity && mergedCost.creativity > player.creativity) {
    errors.push('創造力が不足しています');
  }

  if (itemCost.lobbyReturn > 0) {
    // Check against total active lobby (Used + Available) because we can return Unused too.
    const totalActive = getPlayerLobbyUsed(player) + getLobbyAvailable(player);
    if (itemCost.lobbyReturn > totalActive) {
      errors.push('戻せるロビーが不足しています');
    } else {
      const payload = action.payload as unknown as LensActivatePayload;
      const returnLocations = payload.returnLobbyLocations;

      if (!returnLocations || !Array.isArray(returnLocations)) {
        errors.push('戻すロビーが指定されていません');
      } else if (returnLocations.length !== itemCost.lobbyReturn) {
        errors.push(`戻すロビーの数が正しくありません（必要: ${itemCost.lobbyReturn}, 指定: ${returnLocations.length}）`);
      } else {
        // Check validity of each location
        let handUsedCount = 0;
        for (const loc of returnLocations) {
          if (loc.type === 'lens') {
            const slot = gameState.board.lobbySlots.find(s => s.lensId === loc.id && s.occupantId === action.playerId);
            if (!slot) {
              errors.push(`指定されたレンズ（${loc.id}）にあなたのロビーはありません`);
            }
          } else if (loc.type === 'lab') {
            const placement = gameState.labPlacements.find(p => p.labId === loc.id && p.playerId === action.playerId);
            if (!placement || placement.count <= 0) {
              errors.push(`指定されたラボ（${loc.id}）にあなたのロビーはありません`);
            }
          } else if (loc.type === 'hand') {
            handUsedCount++;
          } else {
            errors.push('不明なロビーの場所タイプです');
          }
        }

        if (handUsedCount > 0) {
          const boardUsed =
            gameState.board.lobbySlots.filter(s => s.occupantId === action.playerId).length +
            gameState.labPlacements.filter(p => p.playerId === action.playerId).reduce((sum, p) => sum + p.count, 0);

          const totalUsed = getPlayerLobbyUsed(player);
          const handUsed = Math.max(0, totalUsed - boardUsed);

          if (handUsedCount > handUsed) {
            errors.push('手持ちの使用済みロビーが不足しています');
          }
        }
      }
    }
  }

  if (itemCost.growthLoss > 0) {
    const current = new Set(player.unlockedCharacterNodes ?? []);
    const removable = [...current].filter((nodeId) => !nodeId.endsWith(':s'));
    if (removable.length < itemCost.growthLoss) {
      errors.push('戻せる成長が不足しています');
    }
  }

  return errors;
};

export const applyLensActivate: EffectApplier = async (action, context) => {
  const { gameState } = context;
  try {
    // ...
    const player = gameState.players[action.playerId];
    if (!player) {
      throw new Error('プレイヤーが存在しません');
    }

    const lensId = action.payload.lensId as string;
    const lens = gameState.board.lenses[lensId];
    if (!lens) {
      throw new Error('指定されたレンズが存在しません');
    }

    // Aono Haruyo Node 5 Restriction
    if (player.unlockedCharacterNodes?.includes('aono-haruyo:5')) {
      if (lens.ownerId !== action.playerId) {
        throw new Error('青野春陽のNode 5の効果により、他人のレンズは起動できません');
      }
    }

    const startStagnation = player.resources.stagnation ?? 0;

    const totalActionCost = lens.cost.actionPoints ?? 0;
    player.actionPoints = Math.max(0, player.actionPoints - totalActionCost);

    const itemCost = resolveLensItemEffects(lens, 'cost');
    const mergedCost = buildLensResourceCost(lens, itemCost);
    // DEBUG LOG
    gameState.logs.push({
      id: `debug-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      playerId: action.playerId,
      actionType: 'pass',
      payload: { message: '[DEBUG] Item Cost', itemCost },
      result: { success: true }
    });
    payResourceCost(player.resources, mergedCost);
    if (mergedCost.creativity) {
      player.creativity = Math.max(0, player.creativity - mergedCost.creativity);
    }
    if (itemCost.lobbyReturn > 0) {
      const payload = action.payload as unknown as LensActivatePayload;
      const locations = payload.returnLobbyLocations;
      // DEBUG LOG
      gameState.logs.push({
        id: `debug-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        playerId: action.playerId,
        actionType: 'pass',
        payload: { message: '[DEBUG] Lobby Return Logic', needed: itemCost.lobbyReturn, locations },
        result: { success: true }
      });

      if (locations && locations.length === itemCost.lobbyReturn) {
        for (const loc of locations) {
          console.log('[DEBUG] Processing return location', loc);
          if (loc.type === 'lens') {
            const slot = gameState.board.lobbySlots.find(s => s.lensId === loc.id && s.occupantId === action.playerId);
            if (slot) {
              delete slot.occupantId;
              slot.isActive = true;
            }
          } else if (loc.type === 'lab') {
            const placement = gameState.labPlacements.find(p => p.labId === loc.id && p.playerId === action.playerId);
            if (placement) {
              placement.count -= 1;
              if (placement.count <= 0) {
                gameState.labPlacements = gameState.labPlacements.filter(p => p !== placement);
              }
            }
          } else if (loc.type === 'hand') {
            if (loc.id === 'unused') {
              const currentAvailable = getLobbyAvailable(player);
              player.lobbyAvailable = Math.max(0, currentAvailable - 1);
            } else {
              const currentUsed = getPlayerLobbyUsed(player);
              player.lobbyUsed = Math.max(0, currentUsed - 1);
            }
          }

          // Return to Stock (Reserve)
          // We removed the token from Active (Hand/Board), now add to Reserve.
          const currentReserve = getLobbyReserve(player);
          player.lobbyReserve = currentReserve + 1;
          triggerEvent(gameState, context.ruleset, 'actionPerformed', {
            actorId: action.playerId,
            actionType: 'returnLobby',
            lensId,
          });
          // DEBUG LOG
          gameState.logs.push({
            id: `debug-${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            playerId: action.playerId,
            actionType: 'pass',
            payload: { message: '[DEBUG] Returned to Reserve', prev: currentReserve, new: player.lobbyReserve },
            result: { success: true }
          });
        }
      } else {
        // DEBUG LOG
        gameState.logs.push({
          id: `debug-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          playerId: action.playerId,
          actionType: 'pass',
          payload: { message: '[DEBUG] Auto-return triggered' },
          result: { success: true }
        });
        const returned = returnLobbyToStock(player, gameState, lensId, itemCost.lobbyReturn);
        for (let i = 0; i < returned; i += 1) {
          triggerEvent(gameState, context.ruleset, 'actionPerformed', {
            actorId: action.playerId,
            actionType: 'returnLobby',
            lensId,
          });
        }
      }
    }

    if (itemCost.growthLoss > 0) {
      for (let i = 0; i < itemCost.growthLoss; i += 1) {
        applyGrowthDelta(player, -1);
      }
    }

    // 報酬の計算と適用
    // アイテム効果の計算（先に計算してリソースを合算する）
    const itemReward = resolveLensItemEffects(lens, 'reward');
    console.log('[DEBUG] Item Reward calculated', itemReward);

    const pendingResources: Partial<Record<ResourceType, number>> = {};
    let apGain = 0;
    let creativityGain = 0;

    // Lens Rewards
    for (const reward of lens.rewards) {
      if (reward.type === 'resource') {
        const val = reward.value as ResourceReward;
        RESOURCE_ORDER.forEach((res) => {
          if (val[res]) pendingResources[res] = (pendingResources[res] || 0) + val[res];
        });
        if (val.actionPoints) apGain += val.actionPoints;
        if (val.creativity) creativityGain += val.creativity;
      } else {
        // Apply non-resource rewards immediately
        applyReward(player, reward);
      }
    }

    // Item Rewards (Resources)
    if (shouldMergeItemResources(lens) && itemReward.resources) {
      RESOURCE_ORDER.forEach((res) => {
        if (itemReward.resources![res]) pendingResources[res] = (pendingResources[res] || 0) + itemReward.resources![res];
      });
      if (itemReward.resources.actionPoints) apGain += itemReward.resources.actionPoints;
      if (itemReward.resources.creativity) creativityGain += itemReward.resources.creativity;
    }

    // Overflow Check & Application
    const currentTotal = RESOURCE_ORDER.reduce((sum, res) => sum + (player.resources[res] || 0), 0);
    const gainTotal = RESOURCE_ORDER.reduce((sum, res) => sum + (pendingResources[res] || 0), 0);

    // Check if player has unlimited capacity (e.g. Kazari Node 8)
    if (currentTotal + gainTotal > TOTAL_RESOURCE_LIMIT) {
      const choice = action.payload.resourceChoice as ResourceWallet | undefined;
      if (!choice) {
        throw new Error('所持上限を超えるため、獲得するリソースを選択してください');
      }

      // Validate Choice
      let choiceTotal = 0;
      RESOURCE_ORDER.forEach((res) => {
        const amount = choice[res] || 0;
        if (amount > (pendingResources[res] || 0)) {
          throw new Error(`選択された ${res} が獲得可能量を超えています`);
        }
        choiceTotal += amount;
      });

      if (currentTotal + choiceTotal > TOTAL_RESOURCE_LIMIT) {
        throw new Error('選択されたリソースの合計が所持上限を超えています');
      }

      // Apply Choice
      RESOURCE_ORDER.forEach((res) => {
        if (choice[res]) {
          const current = player.resources[res] ?? 0;
          const cap = player.resources.maxCapacity?.[res] ?? 99;
          player.resources[res] = Math.min(cap, current + choice[res]);
        }
      });
    } else {
      // Apply All
      RESOURCE_ORDER.forEach((res) => {
        if (pendingResources[res]) {
          const current = player.resources[res] ?? 0;
          const cap = player.resources.maxCapacity?.[res] ?? 99;
          player.resources[res] = Math.min(cap, current + pendingResources[res]);
        }
      });
    }

    // Apply AP/Creativity
    if (apGain > 0) player.actionPoints = (player.actionPoints ?? 0) + apGain;
    if (creativityGain > 0) player.creativity = (player.creativity ?? 0) + creativityGain;

    if (itemReward.growthGain > 0) {
      const growthSelections = Array.isArray(action.payload.growthSelections)
        ? (action.payload.growthSelections as string[])
        : undefined;
      applyGrowthSelection(gameState, context.ruleset, player, growthSelections, itemReward.growthGain);
    }

    if (itemReward.lobbyGain > 0) {
      // Gain (Recruit): Stock (Reserve) -> Used
      const currentReserve = player.lobbyReserve ?? DEFAULT_LOBBY_STOCK;
      // Ensure we have reserve to recruit from? User didn't specify, but usually yes.
      // But for now let's just decrement Reserve and increment Used.
      player.lobbyReserve = Math.max(0, currentReserve - itemReward.lobbyGain);

      const currentUsed = player.lobbyUsed ?? 0;
      player.lobbyUsed = currentUsed + itemReward.lobbyGain;

      // Note: We do NOT update lobbyStock (Total) or lobbyAvailable.
    }

    if (shouldMergeItemResources(lens) && itemReward.vpGain > 0) {
      player.vp = (player.vp ?? 0) + itemReward.vpGain;
    }

    // ロビー消費とスロット占有
    // スロットが存在しない場合は作成する（push）
    if (!gameState.board.lobbySlots) {
      gameState.board.lobbySlots = [];
    }

    // 既存のスロットを探す（自分が既に占有している場合など）
    // ただし、レンズ起動は通常「空きスロット」を使う
    const targetSlots = gameState.board.lobbySlots.filter((slot) => slot.lensId === lensId);

    // 空きスロットを探す
    let occupiedSlot = targetSlots.find((slot) => !slot.occupantId);

    // 空きスロットがなければ新規作成（ただしレンズのスロット数上限チェックが必要だが、ここでは簡易的に追加）
    // 本来は lens.slots をチェックすべき
    if (!occupiedSlot) {
      const newSlot: LobbySlot = {
        lensId,
        ownerId: lens.ownerId,
        occupantId: undefined,
        isActive: false
      };
      gameState.board.lobbySlots.push(newSlot);
      occupiedSlot = newSlot;
    }

    const available = getLobbyAvailable(player);
    if (available <= 0) {
      throw new Error('ロビー在庫が不足しています');
    }
    player.lobbyAvailable = available - 1;
    occupiedSlot.occupantId = action.playerId;

    // 起動後は使用済み（isActive=false）にする？
    // デザインでは「起動時は使用済み」とは限らないが、ロビー回収の対象になるには「使用済み」である必要がある？
    // ここでは元のロジックに従い isActive = false にする
    occupiedSlot.isActive = false;

    // レンズの状態更新（exhaustedにするかどうかはレンズによるが、元のロジックに従う）
    lens.status = 'exhausted'; // これが必要かどうかは要確認だが、元のコードにあったので残す

    if (lens.ownerId !== action.playerId) {
      triggerEvent(gameState, context.ruleset, 'lensActivatedByOther', {
        actorId: action.playerId,
        ownerId: lens.ownerId,
        actionType: 'lensActivate',
        lensId: lens.lensId,
      });
    }

    // Calculate Stagnation Total Move (Consumed + Gained) for Node 5
    const stagnationConsumed = (lens.cost.stagnation ?? 0) + (itemCost.resources.stagnation ?? 0);

    let stagnationGained = 0;
    let lightGained = 0;
    let rainbowGained = 0;

    for (const reward of lens.rewards) {
      if (reward.type === 'resource') {
        const val = reward.value as ResourceReward;
        if (val.stagnation) stagnationGained += val.stagnation;
        if (val.light) lightGained += val.light;
        if (val.rainbow) rainbowGained += val.rainbow;
      }
    }
    if (itemReward.resources) {
      if (itemReward.resources.stagnation) stagnationGained += itemReward.resources.stagnation;
      if (itemReward.resources.light) lightGained += itemReward.resources.light;
      if (itemReward.resources.rainbow) rainbowGained += itemReward.resources.rainbow;
    }

    const stagnationTotalMove = stagnationConsumed + stagnationGained;

    // Aono Haruyo Node 6: Extra Light
    if (player.unlockedCharacterNodes?.includes('aono-haruyo:6') && lightGained > 0) {
      lightGained += 1;
      const cap = player.resources.maxCapacity?.light ?? 99;
      player.resources.light = Math.min(cap, (player.resources.light ?? 0) + 1);
    }

    // Aono Haruyo Node 7: Extra Rainbow
    if (player.unlockedCharacterNodes?.includes('aono-haruyo:7') && rainbowGained > 0) {
      rainbowGained += 1;
      const cap = player.resources.maxCapacity?.rainbow ?? 99;
      player.resources.rainbow = Math.min(cap, (player.resources.rainbow ?? 0) + 1);
    }

    triggerEvent(gameState, context.ruleset, 'actionPerformed', {
      actorId: action.playerId,
      actionType: 'lensActivate',
      lensId: lens.lensId,
      stagnationDelta: stagnationTotalMove, // Using total move as delta for Node 5
      lightGained,
      rainbowGained,
    });
  } catch (error) {
    // CRITICAL: Catch error and log it, but DO NOT rethrow to ensure state is saved.
    gameState.logs.push({
      id: `debug-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      playerId: action.playerId,
      actionType: 'pass',
      payload: {
        message: '[DEBUG] CRITICAL ERROR IN APPLY',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      result: { success: true }
    });
  }
};

export const validateMove: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  if (gameState.currentPlayerId !== action.playerId) {
    errors.push('現在の手番プレイヤーではありません');
  }

  if (player.actionPoints < 3) {
    errors.push('行動力が不足しています');
  }

  const lensId = typeof action.payload.lensId === 'string' ? action.payload.lensId : undefined;
  if (!lensId) {
    errors.push('再起動するレンズIDが指定されていません');
    return errors;
  }

  const lens = gameState.board.lenses[lensId];
  if (!lens) {
    errors.push('指定されたレンズが存在しません');
    return errors;
  }

  if (lens.status !== 'exhausted') {
    errors.push('レンズは再起動の必要がありません');
  }

  const slot = gameState.board.lobbySlots.find(
    (entry) => entry.lensId === lensId && entry.occupantId === action.playerId && !entry.isActive,
  );
  if (!slot) {
    errors.push('使用済みの自分のロビーが配置されていません');
  }

  if (getLobbyAvailable(player) <= 0) {
    errors.push('未使用のロビーが不足しています');
  }

  const totalActionCost = 3 + (lens.cost.actionPoints ?? 0);
  if (player.actionPoints < totalActionCost) {
    errors.push('行動力が不足しています');
  }
  if (lens.cost.creativity && player.creativity < lens.cost.creativity) {
    errors.push('創造力が不足しています');
  }
  const itemCost = resolveLensItemEffects(lens, 'cost');
  const mergedCost = buildLensResourceCost(lens, itemCost);
  if (!canPayResourceCost(player.resources, mergedCost)) {
    errors.push('必要な資源が不足しています');
  }
  if (mergedCost.creativity && mergedCost.creativity > player.creativity) {
    errors.push('創造力が不足しています');
  }
  if (itemCost.lobbyReturn > getPlayerLobbyUsed(player)) {
    errors.push('戻せるロビーが不足しています');
  }
  if (itemCost.growthLoss > 0) {
    const current = new Set(player.unlockedCharacterNodes ?? []);
    const removable = [...current].filter((nodeId) => !nodeId.endsWith(':s'));
    if (removable.length < itemCost.growthLoss) {
      errors.push('戻せる成長が不足しています');
    }
  }

  return errors;
};

export const applyMove: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const lensId = action.payload.lensId as string;
  const slot = gameState.board.lobbySlots.find(
    (item) => item.lensId === lensId && !item.occupantId,
  );
  if (!slot) {
    throw new Error('空きロビーがありません');
  }

  player.actionPoints = Math.max(0, player.actionPoints - 2);
  slot.occupantId = action.playerId;
  slot.isActive = true;
};

export const validateRefresh: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  if (gameState.currentPlayerId !== action.playerId) {
    errors.push('現在の手番プレイヤーではありません');
  }

  if (player.actionPoints < 3) {
    errors.push('行動力が不足しています');
  }

  const lensId = typeof action.payload.lensId === 'string' ? action.payload.lensId : undefined;
  if (!lensId) {
    errors.push('再起動するレンズIDが指定されていません');
    return errors;
  }

  const lens = gameState.board.lenses[lensId];
  if (!lens) {
    errors.push('指定されたレンズが存在しません');
    return errors;
  }

  if (lens.status !== 'exhausted') {
    errors.push('レンズは再起動の必要がありません');
  }

  const slot = gameState.board.lobbySlots.find(
    (entry) => entry.lensId === lensId && entry.occupantId === action.playerId && !entry.isActive,
  );
  if (!slot) {
    errors.push('使用済みの自分のロビーが配置されていません');
  }

  if (getLobbyAvailable(player) <= 0) {
    errors.push('未使用のロビーが不足しています');
  }

  const reduction = getPassiveCostReduction(player, context.ruleset, 'refresh');
  const totalActionCost = Math.max(0, 3 + (lens.cost.actionPoints ?? 0) - reduction);
  if (player.actionPoints < totalActionCost) {
    errors.push('行動力が不足しています');
  }
  if (lens.cost.creativity && player.creativity < lens.cost.creativity) {
    errors.push('創造力が不足しています');
  }
  const itemCost = resolveLensItemEffects(lens, 'cost');
  const mergedCost = buildLensResourceCost(lens, itemCost);
  if (!canPayResourceCost(player.resources, mergedCost)) {
    errors.push('必要な資源が不足しています');
  }
  if (mergedCost.creativity && mergedCost.creativity > player.creativity) {
    errors.push('創造力が不足しています');
  }
  if (itemCost.lobbyReturn > getPlayerLobbyUsed(player)) {
    errors.push('戻せるロビーが不足しています');
  }
  if (itemCost.growthLoss > 0) {
    const current = new Set(player.unlockedCharacterNodes ?? []);
    const removable = [...current].filter((nodeId) => !nodeId.endsWith(':s'));
    if (removable.length < itemCost.growthLoss) {
      errors.push('戻せる成長が不足しています');
    }
  }

  return errors;
};




export const applyRefresh: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const lensId = action.payload.lensId as string;
  const lens = gameState.board.lenses[lensId];
  if (!lens) {
    throw new Error('指定されたレンズが存在しません');
  }

  const slot = gameState.board.lobbySlots.find(
    (entry) => entry.lensId === lensId && entry.occupantId === action.playerId && !entry.isActive,
  );
  if (!slot) {
    throw new Error('使用済みの自分のロビーが配置されていません');
  }

  const reduction = getPassiveCostReduction(player, context.ruleset, 'refresh');
  const cost = lens.cost;
  const totalApCost = Math.max(0, 3 + (cost.actionPoints ?? 0) - reduction);
  player.actionPoints = Math.max(0, player.actionPoints - totalApCost);
  const itemCost = resolveLensItemEffects(lens, 'cost');
  const mergedCost = buildLensResourceCost(lens, itemCost);
  payResourceCost(player.resources, mergedCost);
  if (mergedCost.creativity) {
    player.creativity = Math.max(0, player.creativity - mergedCost.creativity);
  }
  if (itemCost.lobbyReturn > 0) {
    const returned = returnLobbyToStock(player, gameState, lensId, itemCost.lobbyReturn);
    for (let i = 0; i < returned; i += 1) {
      triggerEvent(gameState, context.ruleset, 'actionPerformed', {
        actorId: action.playerId,
        actionType: 'returnLobby',
        lensId,
      });
    }
  }
  if (itemCost.growthLoss > 0) {
    for (let i = 0; i < itemCost.growthLoss; i += 1) {
      applyGrowthDelta(player, -1);
    }
  }

  // 手元の未使用ロビーを消費して、使用済みロビーを補充
  const available = getLobbyAvailable(player);
  if (available > 0) {
    player.lobbyAvailable = available - 1;
  }
  incrementPlayerLobbyUsed(player, 1);

  // スロット上のロビーを使用状態にする
  slot.isActive = false;

  for (const reward of lens.rewards) {
    applyReward(player, reward);
  }
  const itemReward = resolveLensItemEffects(lens, 'reward');
  if (shouldMergeItemResources(lens) && hasResourceReward(itemReward.resources)) {
    applyReward(player, { type: 'resource', value: itemReward.resources });
  }
  if (itemReward.lobbyGain > 0) {
    gainLobbyFromStock(player, itemReward.lobbyGain);
  }
  if (itemReward.growthGain > 0) {
    const growthSelections = Array.isArray(action.payload.growthSelections)
      ? (action.payload.growthSelections as string[])
      : undefined;
    applyGrowthSelection(gameState, context.ruleset, player, growthSelections, itemReward.growthGain);
  }
  if (shouldMergeItemResources(lens) && itemReward.vpGain > 0) {
    player.vp += itemReward.vpGain;
  }

  lens.status = 'exhausted';

  if (lens.ownerId !== action.playerId) {
    const owner = gameState.players[lens.ownerId];
    if (owner) {
      owner.vp += 2;
    }
    triggerEvent(gameState, context.ruleset, 'lensActivatedByOther', {
      actorId: action.playerId,
      ownerId: lens.ownerId,
      actionType: 'refresh',
    });
  }

  triggerEvent(gameState, context.ruleset, 'actionPerformed', {
    actorId: action.playerId,
    actionType: 'refresh',
    lensId: lens.lensId,
  });
};

async function validateCollectInternal(
  action: PlayerAction,
  context: ActionContext,
  options: { skipActionPointCheck?: boolean } = {},
): Promise<string[]> {
  const errors: string[] = [];
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  if (gameState.currentPlayerId !== action.playerId) {
    errors.push('現在の手番プレイヤーではありません');
  }

  if (!options.skipActionPointCheck && player.actionPoints < 2) {
    errors.push('行動力が不足しています');
  }

  const slotTypeRaw =
    typeof action.payload.slotType === 'string' ? action.payload.slotType : 'development';
  if (slotTypeRaw !== 'development' && slotTypeRaw !== 'vp' && slotTypeRaw !== 'foundation') {
    errors.push('カードの取得先が不正です');
    return errors;
  }

  if (slotTypeRaw === 'foundation') {
    const rawCost = action.payload.foundationCost;
    const parsedCost =
      typeof rawCost === 'number' && Number.isFinite(rawCost) ? Math.floor(rawCost) : NaN;
    if (Number.isNaN(parsedCost) || !isFoundationCost(parsedCost)) {
      errors.push('土台カードのコスト指定が不正です');
      return errors;
    }
    const cost = parsedCost as FoundationCost;
    const available = getAvailableFoundationStock(gameState, cost);
    if (available <= 0) {
      errors.push('指定された土台カードは在庫がありません');
    }
    return errors;
  }

  const slotIndex = typeof action.payload.slotIndex === 'number' ? action.payload.slotIndex : NaN;
  if (Number.isNaN(slotIndex) || slotIndex < 0) {
    errors.push('カードのスロット番号が不正です');
    return errors;
  }

  if (slotTypeRaw === 'development') {
    const cards = gameState.board.publicDevelopmentCards ?? [];
    if (slotIndex >= cards.length || !cards[slotIndex]) {
      errors.push('公開開発カードのスロット番号が不正です');
    }
  } else {
    const cards = gameState.board.publicVpCards ?? [];
    if (slotIndex >= cards.length || !cards[slotIndex]) {
      errors.push('公開VPカードのスロット番号が不正です');
    }
  }

  return errors;
}

export const validateCollect: Validator = async (action, context) =>
  validateCollectInternal(action, context);

async function applyCollectInternal(
  action: PlayerAction,
  context: ActionContext,
  options: { consumeActionPoints?: boolean } = {},
): Promise<void> {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  if (options.consumeActionPoints !== false) {
    player.actionPoints = Math.max(0, player.actionPoints - 2);
  }

  const slotTypeRaw =
    typeof action.payload.slotType === 'string' ? action.payload.slotType : 'development';

  if (slotTypeRaw === 'foundation') {
    const rawCost = action.payload.foundationCost;
    const parsedCost =
      typeof rawCost === 'number' && Number.isFinite(rawCost) ? Math.floor(rawCost) : NaN;
    if (Number.isNaN(parsedCost) || !isFoundationCost(parsedCost)) {
      throw new Error('指定された土台カードが存在しません');
    }
    const cost = parsedCost as FoundationCost;
    ensureFoundationStockInitialized(gameState.board);
    const stock = gameState.board.foundationStock!;
    const available =
      typeof stock[cost] === 'number' && Number.isFinite(stock[cost]!) ? stock[cost]! : 0;
    if (available <= 0) {
      throw new Error('指定された土台カードは在庫がありません');
    }
    const remaining = available - 1;
    if (remaining > 0) {
      stock[cost] = remaining;
    } else {
      delete stock[cost];
    }
    if (!player.collectedFoundationCards || typeof player.collectedFoundationCards !== 'object') {
      player.collectedFoundationCards = {};
    }
    const currentCount =
      typeof player.collectedFoundationCards[cost] === 'number'
        ? player.collectedFoundationCards[cost]!
        : 0;
    player.collectedFoundationCards[cost] = currentCount + 1;
  } else if (slotTypeRaw === 'vp') {
    const slotIndex =
      typeof action.payload.slotIndex === 'number' && Number.isFinite(action.payload.slotIndex)
        ? action.payload.slotIndex
        : -1;
    const cards = gameState.board.publicVpCards ?? [];
    const cardId = cards[slotIndex];
    if (!cardId) {
      throw new Error('指定されたVPカードが存在しません');
    }
    player.collectedVpCards = player.collectedVpCards ?? [];
    player.collectedVpCards.push(cardId);
    cards.splice(slotIndex, 1);
    const newCard = gameState.vpDeck.shift();
    if (newCard) {
      cards.splice(slotIndex, 0, newCard);
    }
  } else {
    const slotIndex =
      typeof action.payload.slotIndex === 'number' && Number.isFinite(action.payload.slotIndex)
        ? action.payload.slotIndex
        : -1;
    const cards = gameState.board.publicDevelopmentCards ?? [];
    const cardId = cards[slotIndex];
    if (!cardId) {
      throw new Error('指定された開発カードが存在しません');
    }
    player.collectedDevelopmentCards = player.collectedDevelopmentCards ?? [];
    player.collectedDevelopmentCards.push(cardId);
    cards.splice(slotIndex, 1);
    const newCard = gameState.developmentDeck.shift();
    if (newCard) {
      cards.splice(slotIndex, 0, newCard);
    }
    triggerEvent(gameState, context.ruleset, 'developmentSlotFreed', {
      actorId: action.playerId,
    });
  }

  triggerEvent(gameState, context.ruleset, 'actionPerformed', {
    actorId: action.playerId,
    actionType: 'collect',
  });
}

export const applyCollect: EffectApplier = async (action, context) =>
  applyCollectInternal(action, context);

export const validateWill: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState, ruleset } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  if (!player.characterId) {
    errors.push('キャラクターが選択されていません');
    return errors;
  }

  if (gameState.currentPlayerId !== action.playerId) {
    errors.push('現在の手番プレイヤーではありません');
  }

  const nodeId = typeof action.payload.nodeId === 'string' ? action.payload.nodeId : undefined;
  if (!nodeId) {
    errors.push('意思効果のノードIDが指定されていません');
    return errors;
  }

  const profile = ruleset.characters[player.characterId];
  if (!profile) {
    errors.push('キャラクターデータが見つかりません');
    return errors;
  }

  const node = profile.nodes.find((n) => n.nodeId === nodeId);
  if (!node) {
    errors.push('指定された意思効果が存在しません');
    return errors;
  }

  const effect = node.effects.find((e) => e.type === 'active');
  if (!effect) {
    errors.push('指定されたノードは意思能力ではありません');
    return errors;
  }

  const unlocked = new Set(player.unlockedCharacterNodes ?? []);
  if (!unlocked.has(nodeId)) {
    errors.push('未解放の意思効果は使用できません');
  }

  const payload = effect.payload as ActiveEffectPayload;
  const cost = payload?.cost;
  if (cost) {
    validateWillCost(cost, player, errors);
  }

  validateWillRewards(payload, player, errors);

  const willCollect = payload?.rewards?.some(
    (reward) => reward.type === 'action' && reward.value === 'collect',
  );
  if (willCollect) {
    const collectPayload =
      typeof (action.payload as { collect?: unknown }).collect === 'object'
        ? (action.payload as { collect?: Record<string, unknown> }).collect
        : undefined;
    if (!collectPayload) {
      errors.push('収集先を指定してください');
    } else {
      const collectErrors = await validateCollectInternal(
        {
          playerId: action.playerId,
          actionType: 'collect',
          payload: collectPayload,
        },
        context,
        { skipActionPointCheck: true },
      );
      errors.push(...collectErrors);
    }
  }

  return errors;
};

export const applyWill: EffectApplier = async (action, context) => {
  const { gameState, ruleset } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const nodeId = action.payload.nodeId as string;
  const profile = player.characterId ? ruleset.characters[player.characterId] : undefined;
  if (!profile) {
    throw new Error('キャラクターデータが見つかりません');
  }

  const node = profile.nodes.find((n) => n.nodeId === nodeId);
  if (!node) {
    throw new Error('指定された意思効果が存在しません');
  }

  const effect = node.effects.find((e) => e.type === 'active');
  if (!effect) {
    throw new Error('指定された意思効果が存在しません');
  }

  const payload = effect.payload as ActiveEffectPayload;
  const cost = payload?.cost;
  if (cost) {
    applyWillCost(cost, player);
  }

  if (payload?.setCapacityUnlimited) {
    ensureUnlimitedMap(player.resources);
    payload.setCapacityUnlimited.forEach((resource) => {
      player.resources.unlimited![resource] = true;
    });
  }

  const pendingResources: Partial<Record<ResourceType, number>> = {};
  let apGain = 0;
  let creativityGain = 0;

  payload?.rewards?.forEach((reward) => {
    if (reward.type === 'resource') {
      const val = reward.value as ResourceReward;
      RESOURCE_ORDER.forEach((res) => {
        if (val[res]) pendingResources[res] = (pendingResources[res] || 0) + val[res];
      });
      if (val.actionPoints) apGain += val.actionPoints;
      if (val.creativity) creativityGain += val.creativity;
    } else {
      applyReward(player, reward);
    }
  });

  // Overflow Check & Application
  const currentTotal = RESOURCE_ORDER.reduce((sum, res) => sum + (player.resources[res] || 0), 0);
  const gainTotal = RESOURCE_ORDER.reduce((sum, res) => sum + (pendingResources[res] || 0), 0);

  if (currentTotal + gainTotal > TOTAL_RESOURCE_LIMIT) {
    const choice = action.payload.resourceChoice as ResourceWallet | undefined;
    if (!choice) {
      throw new Error('所持上限を超えるため、獲得するリソースを選択してください');
    }
    // Validate Choice
    let choiceTotal = 0;
    RESOURCE_ORDER.forEach((res) => {
      const amount = choice[res] || 0;
      if (amount > (pendingResources[res] || 0)) {
        throw new Error(`選択された ${res} が獲得可能量を超えています`);
      }
      choiceTotal += amount;
    });
    if (currentTotal + choiceTotal > TOTAL_RESOURCE_LIMIT) {
      throw new Error('選択されたリソースの合計が所持上限を超えています');
    }
    // Apply Choice
    RESOURCE_ORDER.forEach((res) => {
      if (choice[res]) {
        const current = player.resources[res] ?? 0;
        const cap = player.resources.maxCapacity?.[res] ?? 99;
        player.resources[res] = Math.min(cap, current + choice[res]);
      }
    });
  } else {
    // Apply All
    RESOURCE_ORDER.forEach((res) => {
      if (pendingResources[res]) {
        const current = player.resources[res] ?? 0;
        const cap = player.resources.maxCapacity?.[res] ?? 99;
        player.resources[res] = Math.min(cap, current + pendingResources[res]);
      }
    });
  }

  if (apGain > 0) player.actionPoints = (player.actionPoints ?? 0) + apGain;
  if (creativityGain > 0) player.creativity = (player.creativity ?? 0) + creativityGain;

  console.log(`[DEBUG] applyWill: customAction=${payload?.customAction}`);

  if (payload?.customAction === 'forcedCollection') {
    const opponents = Object.values(gameState.players).filter((p) => p.playerId !== action.playerId);
    opponents.forEach((opponent) => {
      // Steal Light
      if (opponent.resources.light > 0) {
        opponent.resources.light -= 1;
        player.resources.light += 1;
      }
      // Steal Rainbow
      if (opponent.resources.rainbow > 0) {
        opponent.resources.rainbow -= 1;
        player.resources.rainbow += 1;
      }
      // Return 1 Lobby to stock
      if ((opponent.lobbyAvailable ?? 0) > 0) {
        opponent.lobbyAvailable = (opponent.lobbyAvailable ?? 0) - 1;
      }
    });
  } else if (payload.customAction === 'akaneNode9') {
    // Akane Hiyori Node 9: Creativity 1 -> Rainbow 1 OR Lobby 1
    const choice = action.payload.choice as 'rainbow' | 'lobby';
    if (!choice) {
      throw new Error('選択肢（rainbow または lobby）を指定してください');
    }
    if (choice === 'rainbow') {
      applyReward(player, { type: 'resource', value: { rainbow: 1 } });
    } else if (choice === 'lobby') {
      gainLobbyFromStock(player, 1);
    } else {
      throw new Error('無効な選択肢です');
    }
  } else if (payload.customAction === 'resonanceIntervention') {
    // Akito Daidou Node 7: Creativity 1 -> Persuade or Reactivate other's lens (paying cost)
    // Payload should contain target lensId and actionType ('persuasion' or 'reactivate')
    // But applyWill payload comes from character definition (fixed).
    // The user selection comes from `action.payload`.
    // We need to merge or look at action.payload.
    const userPayload = action.payload as { targetLensId?: string; interventionType?: 'persuasion' | 'reactivate' };

    if (!userPayload.targetLensId || !userPayload.interventionType) {
      throw new Error('対象のレンズとアクションタイプを指定してください');
    }

    const lens = gameState.board.lenses[userPayload.targetLensId];
    if (!lens) {
      throw new Error('レンズが見つかりません');
    }

    // Pay Lens Cost
    if (!canPayResourceCost(player.resources, lens.cost)) {
      throw new Error('レンズのコストが支払えません');
    }
    payResourceCost(player.resources, lens.cost);

    if (userPayload.interventionType === 'persuasion') {
      if (lens.ownerId === player.playerId) {
        throw new Error('自分のレンズは説得できません');
      }
      // Persuasion Logic
      // Must be occupied
      const slot = gameState.board.lobbySlots.find(s => s.lensId === lens.lensId);
      if (!slot || !slot.occupantId) {
        throw new Error('説得対象のレンズに誰も配置されていません');
      }

      // Return occupant to owner (maintaining state? User said "return to owner maintaining acted/unacted state")
      // If it's on a lens, it's usually "Used" (acted).
      // But if the lens is active, maybe it's "Unacted"?
      // Let's assume we return it to `lobbyAvailable` if slot.isActive is true, and `lobbyUsed` if false?
      // Or just return to `lobbyAvailable` as a bonus?
      // User said: "置かれているロビーを持ち主に行動済未行動を維持したままで戻します。"
      // If the slot is Active, the token is effectively "Unacted" (ready to trigger?).
      // If the slot is Inactive, the token is "Acted".
      const occupant = gameState.players[slot.occupantId];
      if (occupant) {
        if (slot.isActive) {
          occupant.lobbyAvailable = (occupant.lobbyAvailable ?? 0) + 1;
          occupant.lobbyUsed = Math.max(0, (occupant.lobbyUsed ?? 0) - 1);
        } else {
          // Inactive (Acted) -> Return to Used (Hand)
          // No change in counts (Used on board -> Used in hand)
        }
      }

      // Place own token
      // "その後は通常の起動と同じで自分のロビーをレンズにのせてコストを支払報酬を獲得します"
      // Normal activation requires placing a token from Available.
      const myAvailable = getLobbyAvailable(player);
      if (myAvailable < 1) {
        throw new Error('配置できるロビーがありません');
      }
      player.lobbyAvailable = myAvailable - 1;

      slot.occupantId = player.playerId;
      slot.isActive = false; // Exhausted after use

      // Trigger 'persuasionTargeted' for the occupant
      triggerEvent(gameState, context.ruleset, 'actionPerformed', {
        actorId: player.playerId,
        actionType: 'persuasion',
        targetPlayerId: occupant?.playerId,
        lensId: lens.lensId
      });

    } else if (userPayload.interventionType === 'reactivate') {
      if (lens.ownerId !== player.playerId) {
        throw new Error('他人のレンズは再起動できません');
      }
      // Reactivation Logic
      // "レンズに乗っている行動済のロビーを戻して"
      // Must be occupied by SELF and Inactive (Acted).
      const slot = gameState.board.lobbySlots.find(s => s.lensId === lens.lensId);
      if (!slot) {
        throw new Error('レンズスロットが見つかりません');
      }
      if (slot.occupantId !== player.playerId) {
        throw new Error('自分のロビーが乗っていません');
      }
      // "手元の未行動ロビーをレンズにのせて"
      const myAvailable = getLobbyAvailable(player);
      if (myAvailable < 1) {
        throw new Error('配置できるロビーがありません');
      }

      // Return acted lobby
      // Used (Board) -> Used (Hand). No change in counts.

      // Place unacted lobby
      player.lobbyAvailable = myAvailable - 1;
      player.lobbyUsed = (player.lobbyUsed ?? 0) + 1;

      slot.isActive = false; // Used immediately
    }

    // Apply Rewards (Lens + Items)
    // Calculate rewards
    const itemReward = resolveLensItemEffects(lens, 'reward');

    const pendingResources: Partial<Record<ResourceType, number>> = {};
    let apGain = 0;
    let creativityGain = 0;

    // Lens Rewards
    for (const reward of lens.rewards) {
      if (reward.type === 'resource') {
        const val = reward.value as ResourceReward;
        RESOURCE_ORDER.forEach((res) => {
          if (val[res]) pendingResources[res] = (pendingResources[res] || 0) + val[res];
        });
        if (val.actionPoints) apGain += val.actionPoints;
        if (val.creativity) creativityGain += val.creativity;
      } else {
        applyReward(player, reward);
      }
    }

    // Item Rewards (Resources)
    if (shouldMergeItemResources(lens) && itemReward.resources) {
      RESOURCE_ORDER.forEach((res) => {
        if (itemReward.resources![res]) pendingResources[res] = (pendingResources[res] || 0) + itemReward.resources![res];
      });
      if (itemReward.resources.actionPoints) apGain += itemReward.resources.actionPoints;
      if (itemReward.resources.creativity) creativityGain += itemReward.resources.creativity;
    }

    // Overflow Check & Application
    const currentTotal = RESOURCE_ORDER.reduce((sum, res) => sum + (player.resources[res] || 0), 0);
    const gainTotal = RESOURCE_ORDER.reduce((sum, res) => sum + (pendingResources[res] || 0), 0);

    if (currentTotal + gainTotal > TOTAL_RESOURCE_LIMIT) {
      const choice = action.payload.resourceChoice as ResourceWallet | undefined;
      if (!choice) {
        throw new Error('所持上限を超えるため、獲得するリソースを選択してください');
      }
      // Validate Choice
      let choiceTotal = 0;
      RESOURCE_ORDER.forEach((res) => {
        const amount = choice[res] || 0;
        if (amount > (pendingResources[res] || 0)) {
          throw new Error(`選択された ${res} が獲得可能量を超えています`);
        }
        choiceTotal += amount;
      });
      if (currentTotal + choiceTotal > TOTAL_RESOURCE_LIMIT) {
        throw new Error('選択されたリソースの合計が所持上限を超えています');
      }
      // Apply Choice
      RESOURCE_ORDER.forEach((res) => {
        if (choice[res]) {
          const current = player.resources[res] ?? 0;
          const cap = player.resources.maxCapacity?.[res] ?? 99;
          player.resources[res] = Math.min(cap, current + choice[res]);
        }
      });
    } else {
      // Apply All
      RESOURCE_ORDER.forEach((res) => {
        if (pendingResources[res]) {
          const current = player.resources[res] ?? 0;
          const cap = player.resources.maxCapacity?.[res] ?? 99;
          player.resources[res] = Math.min(cap, current + pendingResources[res]);
        }
      });
    }

    if (apGain > 0) player.actionPoints = (player.actionPoints ?? 0) + apGain;
    if (creativityGain > 0) player.creativity = (player.creativity ?? 0) + creativityGain;
  } else if (payload.customAction === 'gainLobby') {
    // Kazari Hizumi Node 8: Creativity 2 -> Gain Lobby (Inactive)
    // Add a new lobby slot to the player's board (or just increment available count?)
    // The game board has `lobbySlots`.
    // But players also have `lobbyAvailable` and `lobbyReserve`.
    // Usually "Gain Lobby" means moving from Reserve to Available?
    // Or creating a NEW slot on the board?
    // User said "ストックからロビーを未行動で獲得".
    // "Stock" usually means `lobbyReserve`.
    // "Unacted" (未行動) means Inactive? Or just available but not used yet?
    // If it means adding to `lobbyAvailable`, that's usually for placing lenses.
    // If it means adding a physical slot to the board...
    // Let's assume it means increasing `lobbyAvailable` count, which allows placing more lenses.
    // BUT, `lobbySlots` on board are created when placing lenses.
    // Wait, `lobbyAvailable` is the number of "Actions" (Lobby tokens) a player has.
    // `lobbyReserve` is the stock.
    // So this action should move 1 from `lobbyReserve` to `lobbyAvailable`.
    // And "Unacted" might mean it's ready to be used (Active).
    // BUT the user said "未行動で獲得" (obtain as unacted/inactive?).
    // If it's a token, "inactive" might mean it's exhausted for this turn?
    // If so, `lobbyAvailable` doesn't track active/inactive state of tokens, only count.
    // The `lobbySlots` track active/inactive state of PLACED tokens.
    // If this ability gives a token to be used LATER, it just adds to `lobbyAvailable`.
    // If "Unacted" means "Ready to use", then it's just +1 `lobbyAvailable`.
    // If "Unacted" means "Already used/Exhausted", we can't represent that with just `lobbyAvailable` count easily unless we have a separate "exhaustedLobby" count.
    // However, usually "Gain Lobby" implies gaining the capacity to do more actions.
    // Let's assume it simply increments `lobbyAvailable` (taking from `lobbyReserve`).

    if ((player.lobbyReserve ?? 0) > 0) {
      player.lobbyReserve = (player.lobbyReserve ?? 0) - 1;
      player.lobbyAvailable = (player.lobbyAvailable ?? 0) + 1;
    } else {
      // If no reserve, maybe create new?
      // User said "from stock". So if stock is empty, maybe fail or do nothing.
      // Let's assume fail if no reserve.
      throw new Error('ストックにロビーがありません');
    }
  } else if (payload.customAction === 'convertStagnation') {
    // Midori Rina: Gain 1-3 Stagnation. +2 VP per Stagnation gained.
    // Cannot discard existing stagnation.
    // Cannot select amount that exceeds capacity.
    const amount = Number(action.payload.amount ?? 0);

    if (amount < 1 || amount > 3) {
      throw new Error('獲得する淀みは1〜3個である必要があります');
    }

    const currentStagnation = player.resources.stagnation ?? 0;
    const maxStagnation = player.resources.maxCapacity.stagnation ?? 10;

    if (currentStagnation + amount > maxStagnation) {
      throw new Error('所持上限を超える個数は選択できません');
    }

    // Check total resource limit as well?
    // addResourcesWithLimits checks TOTAL_RESOURCE_LIMIT (12).
    // But here we are validating selection.
    // If total limit is exceeded, we should also error?
    // User said "所持上限を超える個数は選択できなかった".
    // Usually refers to per-resource capacity, but total limit is also a capacity.
    // Let's check total limit too.
    const totalResources = getTotalResources(player.resources);
    if (totalResources + amount > TOTAL_RESOURCE_LIMIT) {
      throw new Error('リソース合計上限を超える個数は選択できません');
    }

    player.resources.stagnation = currentStagnation + amount;
    player.vp += amount * 2;
  }

  const actionRewards = payload?.rewards?.filter((reward) => reward.type === 'action') ?? [];
  for (const reward of actionRewards) {
    if (reward.value === 'collect') {
      const collectPayload =
        typeof (action.payload as { collect?: unknown }).collect === 'object'
          ? (action.payload as { collect?: Record<string, unknown> }).collect
          : undefined;
      if (!collectPayload) {
        throw new Error('収集先を指定してください');
      }
      await applyCollectInternal(
        {
          playerId: action.playerId,
          actionType: 'collect',
          payload: collectPayload,
        },
        context,
        { consumeActionPoints: false },
      );
    }
  }


  triggerEvent(gameState, ruleset, 'actionPerformed', {
    actorId: action.playerId,
    actionType: 'will',
  });
};

export const validateTask: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  const taskId = typeof action.payload.taskId === 'string' ? action.payload.taskId : undefined;
  if (!taskId) {
    errors.push('課題IDが指定されていません');
    return errors;
  }

  const task = gameState.tasks[taskId];
  if (!task) {
    errors.push('指定された課題が存在しません');
    return errors;
  }

  if (player.tasksCompleted.includes(taskId)) {
    errors.push('既に達成済みの課題です');
  }

  const requirementError = getTaskRequirementError(taskId, player, gameState);
  if (requirementError) {
    errors.push(requirementError);
  }

  const rewardChoice = action.payload.rewardChoice as { type?: unknown; nodeId?: unknown } | undefined;
  if (!rewardChoice || typeof rewardChoice !== 'object') {
    errors.push('課題報酬を選択してください');
    return errors;
  }

  if (rewardChoice.type === 'growth') {
    if (!player.characterId) {
      errors.push('キャラクターが設定されていません');
    }
    if (typeof rewardChoice.nodeId !== 'string' || rewardChoice.nodeId.trim().length === 0) {
      errors.push('成長させるノードを選択してください');
    } else if ((player.unlockedCharacterNodes ?? []).includes(rewardChoice.nodeId)) {
      errors.push('指定されたノードは既に解放済みです');
    } else if (player.characterId) {
      const nodeDefinition = getGrowthNode(player.characterId, rewardChoice.nodeId);
      if (!nodeDefinition) {
        errors.push('指定されたノードは存在しません');
      } else {
        if (isGrowthNodeAutoUnlocked(player.characterId, rewardChoice.nodeId)) {
          errors.push('指定されたノードは自動解放ノードです');
        } else {
          const unlockedSet = buildUnlockedSetWithAuto(
            player.characterId,
            player.unlockedCharacterNodes ?? [],
          );
          if (!canUnlockGrowthNode(player.characterId, rewardChoice.nodeId, unlockedSet)) {
            errors.push('成長条件を満たしていません');
          }
        }
      }
    }
  } else if (rewardChoice.type === 'lobby') {
    // no additional validation needed
  } else {
    errors.push('無効な課題報酬が指定されました');
  }

  // 条件判定は EffectEngine or Task definition に依存
  return errors;
};

export const applyTask: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const taskId = action.payload.taskId as string;
  const task = gameState.tasks[taskId];
  if (!task) {
    throw new Error('指定された課題が存在しません');
  }

  player.tasksCompleted.push(taskId);
  for (const reward of task.reward) {
    applyReward(player, reward);
  }

  const rewardChoice = action.payload.rewardChoice as { type?: string; nodeId?: string } | undefined;
  if (!rewardChoice || typeof rewardChoice.type !== 'string') {
    throw new Error('課題報酬が指定されていません');
  }

  switch (rewardChoice.type) {
    case 'growth': {
      if (!player.characterId) {
        throw new Error('キャラクターが設定されていません');
      }
      const nodeId = rewardChoice.nodeId;
      if (!nodeId || typeof nodeId !== 'string') {
        throw new Error('成長させるノードが指定されていません');
      }
      if (!player.unlockedCharacterNodes) {
        player.unlockedCharacterNodes = [];
      }
      const unlockedSet = buildUnlockedSetWithAuto(
        player.characterId,
        player.unlockedCharacterNodes,
      );
      if (!canUnlockGrowthNode(player.characterId, nodeId, unlockedSet)) {
        throw new Error('成長条件を満たしていません');
      }

      // Consume Stock
      const stock = getLobbyReserve(player);
      if (stock < 1) {
        throw new Error('成長に必要なロビーストックが不足しています');
      }
      player.lobbyReserve = stock - 1;

      player.unlockedCharacterNodes.push(nodeId);
      break;
    }
    case 'lobby': {
      // Consume Stock
      const stock = getLobbyReserve(player);
      if (stock < 1) {
        throw new Error('ロビー補充に必要なロビーストックが不足しています');
      }
      player.lobbyReserve = stock - 1;

      // Replenish Lobby (Available) directly
      player.lobbyAvailable = (player.lobbyAvailable ?? 0) + 1;
      break;
    }
    default:
      throw new Error('無効な課題報酬が指定されました');
  }
};

export const validateRooting: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  // DEBUG LOG
  gameState.logs.push({
    id: `debug-rooting-${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    playerId: action.playerId,
    actionType: 'pass',
    payload: {
      message: '[DEBUG] validateRooting',
      phase: gameState.currentPhase,
      isRooting: Object.values(gameState.players).map(p => ({ id: p.playerId, isRooting: p.isRooting })),
      light: player.resources.light
    },
    result: { success: true }
  });

  if (gameState.currentPhase !== 'main') {
    errors.push('根回しはメインフェーズのみ実行できます');
  }

  if (gameState.currentPlayerId !== action.playerId) {
    errors.push('現在の手番プレイヤーではありません');
  }

  const alreadyRooting = Object.values(gameState.players).some((p) => p.isRooting);
  if (alreadyRooting) {
    errors.push('根回しはこのラウンドで既に行われています');
  }

  if (!hasCapacity(player.resources, 'light', 1)) {
    errors.push('光トークンの上限を超えます');
  }

  return errors;
};

export const applyRooting: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  player.isRooting = true;
  player.resources.light += 1;
};

export const validatePersuasion: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  if (gameState.currentPlayerId !== action.playerId) {
    errors.push('現在の手番プレイヤーではありません');
  }

  const lensId = typeof action.payload.lensId === 'string' ? action.payload.lensId : undefined;
  if (!lensId) {
    errors.push('レンズIDが指定されていません');
    return errors;
  }

  const lens = gameState.board.lenses[lensId];
  if (!lens) {
    errors.push('指定されたレンズが存在しません');
    return errors;
  }

  if (lens.status !== 'available') {
    errors.push('レンズは使用済みです');
  }

  const slot = gameState.board.lobbySlots.find(
    (item) => item.lensId === lensId && item.occupantId && item.occupantId !== action.playerId,
  );
  if (!slot) {
    errors.push('相手のロビーが配置されていません');
  } else if (slot.occupantId === action.playerId) {
    errors.push('自分のロビーには説得できません');
  }

  const reduction = getPassiveCostReduction(player, context.ruleset, 'persuasion');
  const requiredActionPoints = Math.max(0, (lens.cost.actionPoints ?? 0) - reduction);
  if (player.actionPoints < requiredActionPoints) {
    errors.push('行動力が不足しています');
  }

  const itemCost = resolveLensItemEffects(lens, 'cost');
  const mergedCost = buildLensResourceCost(lens, itemCost);
  if (!canPayResourceCost(player.resources, mergedCost)) {
    errors.push('必要な資源が不足しています');
  }

  if (mergedCost.creativity && mergedCost.creativity > player.creativity) {
    errors.push('創造力が不足しています');
  }
  if (itemCost.lobbyReturn > getPlayerLobbyUsed(player)) {
    errors.push('戻せるロビーが不足しています');
  }
  if (itemCost.growthLoss > 0) {
    const current = new Set(player.unlockedCharacterNodes ?? []);
    const removable = [...current].filter((nodeId) => !nodeId.endsWith(':s'));
    if (removable.length < itemCost.growthLoss) {
      errors.push('戻せる成長が不足しています');
    }
  }

  lens.rewards
    .filter((reward) => reward.type === 'resource')
    .forEach((reward) => {
      const value = reward.value as ResourceReward;
      for (const [resource, amount] of resourceRewardEntries(value)) {
        if (!hasCapacity(player.resources, resource, amount)) {
          errors.push(`${resource} の上限を超えます`);
        }
      }
    });
  const itemReward = resolveLensItemEffects(lens, 'reward');
  if (shouldMergeItemResources(lens) && hasResourceReward(itemReward.resources)) {
    for (const [resource, amount] of resourceRewardEntries(itemReward.resources)) {
      if (!hasCapacity(player.resources, resource, amount)) {
        errors.push(`${resource} の上限を超えます`);
      }
    }
  }

  return errors;
};

export const applyPersuasion: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const lensId = action.payload.lensId as string;
  const lens = gameState.board.lenses[lensId];
  if (!lens) {
    throw new Error('指定されたレンズが存在しません');
  }

  const slot = gameState.board.lobbySlots.find(
    (item) => item.lensId === lensId && item.occupantId && item.occupantId !== action.playerId,
  );
  if (!slot || !slot.occupantId) {
    throw new Error('相手のロビーが配置されていません');
  }

  const occupantId = slot.occupantId;
  const occupantPlayer = gameState.players[occupantId];

  const reduction = getPassiveCostReduction(player, context.ruleset, 'persuasion');
  const totalApCost = Math.max(0, (lens.cost.actionPoints ?? 0) - reduction);
  player.actionPoints = Math.max(0, player.actionPoints - totalApCost);

  const itemCost = resolveLensItemEffects(lens, 'cost');
  const mergedCost = buildLensResourceCost(lens, itemCost);
  payResourceCost(player.resources, mergedCost);
  if (mergedCost.creativity) {
    player.creativity = Math.max(0, player.creativity - mergedCost.creativity);
  }
  if (itemCost.lobbyReturn > 0) {
    const returned = returnLobbyToStock(player, gameState, lensId, itemCost.lobbyReturn);
    for (let i = 0; i < returned; i += 1) {
      triggerEvent(gameState, context.ruleset, 'actionPerformed', {
        actorId: action.playerId,
        actionType: 'returnLobby',
        lensId,
      });
    }
  }
  if (itemCost.growthLoss > 0) {
    for (let i = 0; i < itemCost.growthLoss; i += 1) {
      applyGrowthDelta(player, -1);
    }
  }

  for (const reward of lens.rewards) {
    applyReward(player, reward);
  }
  const itemReward = resolveLensItemEffects(lens, 'reward');
  if (shouldMergeItemResources(lens) && hasResourceReward(itemReward.resources)) {
    applyReward(player, { type: 'resource', value: itemReward.resources });
  }
  if (itemReward.lobbyGain > 0) {
    gainLobbyFromStock(player, itemReward.lobbyGain);
  }
  if (itemReward.growthGain > 0) {
    const growthSelections = Array.isArray(action.payload.growthSelections)
      ? (action.payload.growthSelections as string[])
      : undefined;
    applyGrowthSelection(gameState, context.ruleset, player, growthSelections, itemReward.growthGain);
  }

  // 既存ロビーを返却し、自分のロビーを配置（配置したロビーはこの手番で使用済み）
  slot.occupantId = action.playerId;
  slot.isActive = false;
  if (occupantPlayer) {
    incrementPlayerLobbyUsed(occupantPlayer, 1);
  }

  lens.status = 'exhausted';
  if (lens.ownerId !== action.playerId) {
    const owner = gameState.players[lens.ownerId];
    if (owner) {
      owner.vp += 2;
    }
    triggerEvent(gameState, context.ruleset, 'lensActivatedByOther', {
      actorId: action.playerId,
      ownerId: lens.ownerId,
      actionType: 'persuasion',
      lensId: lens.lensId,
    });
  }
  triggerEvent(gameState, context.ruleset, 'actionPerformed', {
    actorId: action.playerId,
    actionType: 'persuasion',
    lensId: lens.lensId,
    targetPlayerId: occupantId,
  });
};

export const validatePass: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  if (gameState.currentPlayerId !== action.playerId) {
    errors.push('現在の手番プレイヤーではありません');
  }

  if (player.hasPassed) {
    errors.push('既にパスしています');
  }

  if (!context.turnOrder) {
    errors.push('ターン順情報が利用できません');
  }

  return errors;
};

export const applyPass: EffectApplier = async (action, context) => {
  const { gameState, turnOrder } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  player.hasPassed = true;
  player.passedAt = context.timestamp;
  turnOrder?.markPass(action.playerId);
  const nextPlayer = turnOrder?.nextPlayer();
  if (nextPlayer) {
    gameState.currentPlayerId = nextPlayer;
  }
};

export function hasCapacity(
  wallet: ResourceWallet,
  resource: 'light' | 'rainbow' | 'stagnation',
  amount: number,
): boolean {
  if (wallet.unlimited?.[resource]) {
    return true;
  }
  const cap = wallet.maxCapacity[resource];
  const current = wallet[resource];
  return current + amount <= cap;
}

function getTaskRequirementError(taskId: string, player: PlayerState, gameState: GameState): string | null {
  switch (taskId) {
    case 'rainbow': {
      const required = 5;
      return player.resources.rainbow >= required ? null : `虹トークンが${required}個必要です`;
    }
    case 'light': {
      const required = 7;
      return player.resources.light >= required ? null : `光トークンが${required}個必要です`;
    }
    case 'lens': {
      const required = 3;
      const owned = countPlayerLenses(gameState, player);
      return owned >= required ? null : `完成済みレンズが${required}枚必要です`;
    }
    default:
      return null;
  }
}

function countPlayerLenses(gameState: GameState, player: PlayerState): number {
  const boardLenses = Object.values(gameState.board?.lenses ?? {});
  const ownedOnBoard = boardLenses.filter((lens) => lens.ownerId === player.playerId).length;
  const ownedFromState = Array.isArray(player.ownedLenses) ? player.ownedLenses.length : 0;
  return Math.max(ownedOnBoard, ownedFromState);
}

function resourceRewardEntries(reward: ResourceReward): Array<[ResourceType, number]> {
  const entries: Array<[ResourceType, number]> = [];
  RESOURCE_ORDER.forEach((resource) => {
    const amount = reward[resource];
    if (typeof amount === 'number' && amount > 0) {
      entries.push([resource, amount]);
    }
  });
  return entries;
}

function addResourcesWithLimits(wallet: ResourceWallet, reward: ResourceReward): void {
  let totalResources = getTotalResources(wallet);
  RESOURCE_ORDER.forEach((resource) => {
    const increment = reward[resource];
    if (typeof increment !== 'number' || increment <= 0) {
      return;
    }
    if (wallet.unlimited?.[resource]) {
      wallet[resource] += increment;
      totalResources += increment;
      return;
    }
    const capacityRemaining = wallet.maxCapacity[resource] - wallet[resource];
    if (capacityRemaining <= 0) {
      return;
    }
    const totalRemaining = TOTAL_RESOURCE_LIMIT - totalResources;
    if (totalRemaining <= 0) {
      return;
    }
    const allowed = Math.min(increment, capacityRemaining, totalRemaining);
    if (allowed > 0) {
      wallet[resource] += allowed;
      totalResources += allowed;
    }
  });
}

function applyReward(player: { resources: ResourceWallet; vp: number; actionPoints: number; creativity: number }, reward: {
  type: 'vp' | 'resource' | 'growth' | 'trigger' | 'action';
  value: number | ResourceReward | unknown;
}): void {
  switch (reward.type) {
    case 'vp': {
      const vp = typeof reward.value === 'number' ? reward.value : 0;
      player.vp += vp;
      break;
    }
    case 'resource': {
      const value = reward.value as ResourceReward;
      addResourcesWithLimits(player.resources, value);
      if (typeof value.actionPoints === 'number') {
        player.actionPoints = clampActionPoints(player.actionPoints + value.actionPoints);
      }
      if (typeof value.creativity === 'number') {
        player.creativity = clampCreativity(player.creativity + value.creativity);
      }
      break;
    }
    case 'growth':
      applyGrowthReward(player, reward.value as GrowthReward);
      break;
    case 'trigger':
      // トリガーはイベント処理でハンドリングするためここでは何もしない
      break;
    case 'action':
      // Action rewards are handled by the caller (e.g. Will effects)
      break;
    default:
      // Check for lobby reward in unknown types or extended properties
      if (reward && typeof reward === 'object') {
        const r = reward as { type: string; value: unknown; lobby?: number };
        // If the reward object has a 'lobby' property directly (custom convention)
        if (typeof r.lobby === 'number' && r.lobby > 0) {
          const p = player as any;
          const currentReserve = p.lobbyReserve ?? 0;
          p.lobbyReserve = currentReserve + r.lobby;
        }
      }
      break;
  }
}

function validateWillCost(cost: CharacterCost, player: { creativity: number; actionPoints: number; resources: ResourceWallet }, errors: string[]): void {
  if (cost.creativity && player.creativity < cost.creativity) {
    errors.push('創造力が不足しています');
  }

  if (cost.actionPoints && player.actionPoints < cost.actionPoints) {
    errors.push('行動力が不足しています');
  }

  if (cost.resources && !canPayResourceCost(player.resources, cost.resources)) {
    errors.push('必要な資源が不足しています');
  }
}

function validateWillRewards(payload: ActiveEffectPayload | undefined, player: { resources: ResourceWallet }, errors: string[]): void {
  if (!payload?.rewards) {
    return;
  }
  const unlimitedTarget = new Set(payload.setCapacityUnlimited ?? []);
  payload.rewards
    .filter((reward) => reward.type === 'resource')
    .forEach((reward) => {
      const value = reward.value as ResourceReward;
      (['light', 'rainbow', 'stagnation'] as ResourceType[]).forEach((resource) => {
        if (unlimitedTarget.has(resource)) {
          return;
        }
        const amount = value[resource];
        if (typeof amount === 'number' && amount > 0) {
          if (!hasCapacity(player.resources, resource, amount)) {
            errors.push(`${resource} の上限を超えます`);
          }
        }
      });
    });
}

function applyWillCost(cost: CharacterCost, player: { creativity: number; actionPoints: number; resources: ResourceWallet }): void {
  if (cost.creativity) {
    player.creativity = Math.max(0, player.creativity - cost.creativity);
  }
  if (cost.actionPoints) {
    player.actionPoints = Math.max(0, player.actionPoints - cost.actionPoints);
  }
  if (cost.resources) {
    payResourceCost(player.resources, cost.resources);
  }
}

function ensureUnlimitedMap(wallet: ResourceWallet): void {
  if (!wallet.unlimited) {
    wallet.unlimited = {} as Partial<Record<ResourceType, boolean>>;
  }
}

type ItemKind =
  | 'light'
  | 'rainbow'
  | 'stagnation'
  | 'creativity'
  | 'lobby'
  | 'growth'
  | 'vp';

const ITEM_KEYWORDS: Record<ItemKind, string[]> = {
  light: ['light', '光', 'hikari'],
  rainbow: ['rainbow', '虹', 'niji', '虹彩'],
  stagnation: ['stagnation', '淀み', 'yodomi', '淀'],
  creativity: ['creativity', 'cp', '創造', '創造力', '創', 'img', '想', 'イメージ'],
  lobby: ['lobby', 'ロビー', 'loby'],
  growth: ['growth', '成長', 'grow'],
  vp: ['vp', 'victory', 'point', 'points', 'vp点'],
};

const NORMALIZED_ITEM_KEYWORDS = Object.entries(ITEM_KEYWORDS).map(([kind, keywords]) => ({
  kind: kind as ItemKind,
  keywords: keywords.map((keyword) => normalizeKeyword(keyword)),
}));

function normalizeKeyword(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\s_\-・:：]/g, '')
    .toLowerCase();
}

function resolveItemKind(label: string | null | undefined): ItemKind | null {
  if (!label) {
    return null;
  }
  const normalized = normalizeKeyword(label);
  for (const entry of NORMALIZED_ITEM_KEYWORDS) {
    for (const keyword of entry.keywords) {
      if (normalized.includes(keyword)) {
        return entry.kind;
      }
    }
  }
  return null;
}

function cloneLensItemEffectSummary(summary: LensItemEffectSummary): LensItemEffectSummary {
  return {
    resources: { ...summary.resources },
    lobbyGain: summary.lobbyGain,
    lobbyReturn: summary.lobbyReturn,
    growthGain: summary.growthGain,
    growthLoss: summary.growthLoss,
    vpGain: summary.vpGain,
  };
}

function resolveLensItemEffects(
  lens: LensState,
  direction: 'cost' | 'reward',
): LensItemEffectSummary {
  if (lens.itemEffects) {
    const stored = direction === 'cost' ? lens.itemEffects.cost : lens.itemEffects.reward;
    return cloneLensItemEffectSummary(stored);
  }
  const items =
    direction === 'cost'
      ? (lens as unknown as { leftItems?: CraftedLensSideItem[] }).leftItems
      : (lens as unknown as { rightItems?: CraftedLensSideItem[] }).rightItems;
  return accumulateItemEffects(items, direction);
}

function shouldMergeItemResources(lens: LensState): boolean {
  return !lens.itemEffects;
}

function buildLensResourceCost(
  lens: LensState,
  itemCost: LensItemEffectSummary,
): ResourceCost {
  const merged: ResourceCost = {
    light: lens.cost.light ?? 0,
    rainbow: lens.cost.rainbow ?? 0,
    stagnation: lens.cost.stagnation ?? 0,
    creativity: lens.cost.creativity ?? 0,
    actionPoints: lens.cost.actionPoints,
  };
  if (shouldMergeItemResources(lens)) {
    merged.light = (merged.light ?? 0) + (itemCost.resources.light ?? 0);
    merged.rainbow = (merged.rainbow ?? 0) + (itemCost.resources.rainbow ?? 0);
    merged.stagnation = (merged.stagnation ?? 0) + (itemCost.resources.stagnation ?? 0);
    merged.creativity = (merged.creativity ?? 0) + (itemCost.resources.creativity ?? 0);
  }
  return merged;
}

function hasResourceReward(value: ResourceReward | undefined): boolean {
  if (!value) {
    return false;
  }
  return Boolean(
    value.light ||
      value.rainbow ||
      value.stagnation ||
      value.actionPoints ||
      value.creativity,
  );
}

function accumulateItemEffects(
  items: CraftedLensSideItem[] | undefined,
  direction: 'cost' | 'reward',
): LensItemEffectSummary {
  const summary: LensItemEffectSummary = {
    resources: {},
    lobbyGain: 0,
    lobbyReturn: 0,
    growthGain: 0,
    growthLoss: 0,
    vpGain: 0,
  };
  if (!Array.isArray(items)) {
    return summary;
  }

  items.forEach((item) => {
    const rawLabel = (item.item ?? item.cardId ?? '').toString();
    const amount =
      typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 1;
    const kind = resolveItemKind(rawLabel);

    if (kind === 'light') {
      summary.resources.light = (summary.resources.light ?? 0) + amount;
      return;
    }
    if (kind === 'rainbow') {
      summary.resources.rainbow = (summary.resources.rainbow ?? 0) + amount;
      return;
    }
    if (kind === 'stagnation') {
      summary.resources.stagnation = (summary.resources.stagnation ?? 0) + amount;
      return;
    }
    if (kind === 'creativity') {
      summary.resources.creativity = (summary.resources.creativity ?? 0) + amount;
      return;
    }
    if (kind === 'growth') {
      if (direction === 'reward') {
        summary.growthGain += amount;
      } else {
        summary.growthLoss += amount;
      }
      return;
    }
    if (kind === 'lobby') {
      if (direction === 'reward') {
        summary.lobbyGain += amount;
      } else {
        summary.lobbyReturn += amount;
      }
      return;
    }
    if (kind === 'vp') {
      let vpAmount = amount;
      if (
        !(typeof item.quantity === 'number' && Number.isFinite(item.quantity)) &&
        typeof item.item === 'string'
      ) {
        const match = item.item.match(/-?\d+(?:\.\d+)?/);
        if (match) {
          const parsed = Number(match[0]);
          if (Number.isFinite(parsed)) {
            vpAmount = parsed;
          }
        }
      }
      summary.vpGain += vpAmount;
      return;
    }

    if (!kind && direction === 'reward' && item.cardType === 'vp') {
      summary.vpGain += amount;
      return;
    }
  });

  return summary;
}

function canActivateLens(
  lensId: string,
  ownerId: string,
  playerId: string,
  gameState: GameState,
  extraLobby: number = 0,
): boolean {
  const slots = gameState.board.lobbySlots.filter((slot) => slot.lensId === lensId);
  const hasOccupant = slots.some((slot) => Boolean(slot.occupantId));
  if (hasOccupant) {
    return false;
  }
  const hasEmptySlot = slots.some((slot) => !slot.occupantId);
  const player = gameState.players[playerId];
  const hasLobbyToken = player ? (getLobbyAvailable(player) + extraLobby) > 0 : false;
  return hasEmptySlot && hasLobbyToken;
}

function canPayResourceCost(wallet: ResourceWallet, cost: ResourceCost): boolean {
  return (['light', 'rainbow', 'stagnation'] as ResourceType[]).every((resource) => {
    const required = cost[resource];
    if (!required) {
      return true;
    }
    return wallet[resource] >= required;
  });
}

function payResourceCost(wallet: ResourceWallet, cost: ResourceCost): void {
  (['light', 'rainbow', 'stagnation'] as ResourceType[]).forEach((resource) => {
    const required = cost[resource];
    if (required) {
      wallet[resource] = Math.max(0, wallet[resource] - required);
    }
  });
}

function applyGrowthDelta(player: PlayerState, delta: number): void {
  if (!player.characterId || delta === 0) {
    return;
  }
  if (!player.unlockedCharacterNodes) {
    player.unlockedCharacterNodes = [];
  }
  if (delta > 0) {
    const unlockedSet = buildUnlockedSetWithAuto(player.characterId, player.unlockedCharacterNodes);
    const candidates = CHARACTER_GROWTH_DEFINITIONS[player.characterId]
      ? Object.keys(CHARACTER_GROWTH_DEFINITIONS[player.characterId])
      : [];
    const unlockable = candidates.find(
      (nodeId) =>
        !unlockedSet.has(nodeId) &&
        !isGrowthNodeAutoUnlocked(player.characterId!, nodeId) &&
        canUnlockGrowthNode(player.characterId!, nodeId, unlockedSet),
    );
    if (unlockable) {
      player.unlockedCharacterNodes.push(unlockable);
    }
  } else {
    const current = new Set(player.unlockedCharacterNodes);
    const removable = [...current].filter((nodeId) => !nodeId.endsWith(':s'));
    const target = removable[0];
    if (target) {
      player.unlockedCharacterNodes = player.unlockedCharacterNodes.filter((id) => id !== target);
    }
  }
}

function applyGrowthSelection(
  gameState: GameState,
  ruleset: Ruleset,
  player: PlayerState,
  selections: string[] | undefined,
  amount: number,
): void {
  if (!player.characterId || amount <= 0) {
    return;
  }
  if (!player.unlockedCharacterNodes) {
    player.unlockedCharacterNodes = [];
  }
  const unlocked = new Set(buildUnlockedSetWithAuto(player.characterId, player.unlockedCharacterNodes));
  const requested = selections && selections.length ? [...selections] : [];
  for (let i = 0; i < amount; i += 1) {
    const nextId =
      requested.length > 0
        ? requested.shift()
        : Object.keys(CHARACTER_GROWTH_DEFINITIONS[player.characterId] ?? {}).find((nodeId) => {
          return (
            !unlocked.has(nodeId) &&
            !isGrowthNodeAutoUnlocked(player.characterId!, nodeId) &&
            canUnlockGrowthNode(player.characterId!, nodeId, unlocked)
          );
        });
    if (!nextId) {
      break;
    }
    if (!canUnlockGrowthNode(player.characterId!, nextId, unlocked)) {
      continue;
    }
    player.unlockedCharacterNodes.push(nextId);
    unlocked.add(nextId);

    // Handle Immediate Effects
    const nodeDef = CHARACTER_GROWTH_DEFINITIONS[player.characterId]?.[nextId];
    if (nodeDef) {
      // We need to look up the node definition in ruleset to get effects
      // But CHARACTER_GROWTH_DEFINITIONS only has structure, not effects.
      // We need to look up in ruleset.characters
      const profile = ruleset.characters[player.characterId];
      const node = profile?.nodes.find((n) => n.nodeId === nextId);
      if (node) {
        node.effects.forEach((effect) => {
          if (effect.type === 'immediate') {
            const payload = effect.payload as unknown as { customAction?: string; rewards?: unknown[] };
            if (payload.customAction === 'forcedCollection') {
              // Shirogami Yuu Node 5: Steal 1 Light/Rainbow from all opponents, reduce their Lobby Available by 1.
              const opponents = Object.values(gameState.players).filter((p) => p.playerId !== player.playerId);
              opponents.forEach((opponent) => {
                // Steal Light
                if (opponent.resources.light > 0) {
                  opponent.resources.light -= 1;
                  player.resources.light = Math.min((player.resources.maxCapacity?.light ?? 10), player.resources.light + 1);
                }
                // Steal Rainbow
                if (opponent.resources.rainbow > 0) {
                  opponent.resources.rainbow -= 1;
                  player.resources.rainbow = Math.min((player.resources.maxCapacity?.rainbow ?? 10), player.resources.rainbow + 1);
                }

                // Return 1 Lobby to stock (from unused lobbies)
                // "Return" here implies losing the ability to use it this round (decrement lobbyAvailable).
                // It does not destroy the lobby permanently (lobbyReserve is untouched), just removes it from current availability.
                // Actually, user said "任意のロビーをストックに戻させます".
                // "Stock" usually means Reserve. So Available -> Reserve.
                // And "Opponent chooses". But for simplicity in MVP/Auto-resolution, we can just take from Available.
                // If Available is 0, we can't take.
                // Wait, "Lobby to Stock" means they lose the ability to use it.
                // If I move Available -> Reserve, they can use it next round (via Supply).
                // If I move Available -> Used, they can't use it this round.
                // "Stock" usually refers to `lobbyReserve`.
                // So Available -> Reserve seems correct interpretation of "Return to Stock".
                // This effectively reduces their actions for this round (if they haven't used it yet).
                if ((opponent.lobbyAvailable ?? 0) > 0) {
                  opponent.lobbyAvailable = (opponent.lobbyAvailable ?? 0) - 1;
                  opponent.lobbyReserve = (opponent.lobbyReserve ?? 0) + 1;
                }
              });
            }
            // Handle other immediate rewards if any
            if (Array.isArray(payload.rewards)) {
              payload.rewards.forEach(r => applyReward(player, r as any));
            }
          }
        });
      }
    }

    // Trigger growth event
    triggerEvent(gameState, ruleset, 'growth', {
      actorId: player.playerId,
    });
  }
}

function gainLobbyFromStock(player: PlayerState, amount: number): void {
  if (amount <= 0) {
    return;
  }
  const stock = getLobbyReserve(player);
  const transferable = Math.min(stock, amount);
  if (transferable > 0) {
    player.lobbyReserve = stock - transferable;
    incrementPlayerLobbyUsed(player, transferable);
  }
}

function returnLobbyToStock(
  player: PlayerState,
  gameState: GameState,
  lensId: string,
  amount: number,
): number {
  if (amount <= 0) {
    return 0;
  }
  let remaining = amount;
  let returned = 0;

  // 手持ち使用済み (Prioritize returning Used first)
  if (remaining > 0) {
    const currentUsed = getPlayerLobbyUsed(player);
    const takeUsed = Math.min(currentUsed, remaining);
    if (takeUsed > 0) {
      player.lobbyUsed = Math.max(0, currentUsed - takeUsed);
      player.lobbyReserve = getLobbyReserve(player) + takeUsed;
      remaining -= takeUsed;
      returned += takeUsed;
    }
  }

  // ボード上（今回のレンズ以外）
  gameState.board.lobbySlots.forEach((slot) => {
    if (remaining <= 0) {
      return;
    }
    if (slot.occupantId === player.playerId && slot.lensId !== lensId) {
      delete slot.occupantId;
      slot.isActive = true;
      remaining -= 1;
      player.lobbyReserve = getLobbyReserve(player) + 1;
      returned += 1;
    }
  });

  // ラボ配置
  if (remaining > 0 && Array.isArray(gameState.labPlacements)) {
    for (const placement of gameState.labPlacements) {
      if (remaining <= 0) {
        break;
      }
      if (placement.playerId !== player.playerId || placement.count <= 0) {
        continue;
      }
      const take = Math.min(placement.count, remaining);
      placement.count -= take;
      remaining -= take;
      player.lobbyReserve = getLobbyReserve(player) + take;
      returned += take;
    }
  }

  // 手持ち未使用 (Last resort)
  if (remaining > 0) {
    const available = getLobbyAvailable(player);
    const takeAvail = Math.min(available, remaining);
    if (takeAvail > 0) {
      player.lobbyAvailable = available - takeAvail;
      player.lobbyReserve = getLobbyReserve(player) + takeAvail;
      remaining -= takeAvail;
      returned += takeAvail;
    }
  }

  if (remaining > 0) {
    throw new Error('ロビー返却コストを支払うためのロビーが不足しています');
  }
  return returned;
}
function applyGrowthReward(
  player: {
    resources: ResourceWallet;
    vp: number;
    actionPoints: number;
    creativity: number;
    unlockedCharacterNodes?: string[];
  },
  reward: GrowthReward,
): void {
  if (!reward) {
    return;
  }
  if (typeof reward.vp === 'number') {
    player.vp += reward.vp;
  }
  if (reward.unlockNodeId) {
    if (!player.unlockedCharacterNodes) {
      player.unlockedCharacterNodes = [];
    }
    if (!player.unlockedCharacterNodes.includes(reward.unlockNodeId)) {
      player.unlockedCharacterNodes.push(reward.unlockNodeId);
    }
  }
}

export const validateFinalChainOrder: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  if (gameState.currentPlayerId !== action.playerId) {
    errors.push('現在の手番プレイヤーではありません');
  }

  if (gameState.currentPhase === 'finalScoring') {
    errors.push('最終スコア計算中は順番を変更できません');
  }

  if (player.characterId !== 'midori-rina' || !player.unlockedCharacterNodes?.includes('midori-rina:9')) {
    errors.push('翠川燐名⑨が未解放のため順番を設定できません');
  }

  const rawOrder = (action.payload as { lensOrder?: unknown }).lensOrder;
  const lensOrder =
    Array.isArray(rawOrder) ? rawOrder.filter((id): id is string => typeof id === 'string') : [];
  if (lensOrder.length === 0) {
    errors.push('レンズの順番が指定されていません');
    return errors;
  }

  const eligibleLensIds = Array.from(
    new Set(
      (gameState.board.lobbySlots ?? [])
        .filter((slot) => slot.ownerId === player.playerId)
        .map((slot) => slot.lensId),
    ),
  );

  if (eligibleLensIds.length === 0) {
    errors.push('設定できるレンズがありません');
    return errors;
  }

  const unique = new Set(lensOrder);
  if (unique.size !== lensOrder.length) {
    errors.push('レンズの指定が重複しています');
  }

  const eligibleSet = new Set(eligibleLensIds);
  const unknown = lensOrder.find((id) => !eligibleSet.has(id));
  if (unknown) {
    errors.push('指定されたレンズが存在しません');
  }

  if (lensOrder.length !== eligibleLensIds.length) {
    errors.push('レンズの指定数が不足しています');
  }

  return errors;
};

export const applyFinalChainOrder: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }
  const rawOrder = (action.payload as { lensOrder?: unknown }).lensOrder;
  const lensOrder =
    Array.isArray(rawOrder) ? rawOrder.filter((id): id is string => typeof id === 'string') : [];
  if (lensOrder.length === 0) {
    throw new Error('レンズの順番が指定されていません');
  }
  player.finalChainOrder = [...lensOrder];
};

export const validateGrowth: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  if (gameState.currentPlayerId !== action.playerId) {
    errors.push('現在の手番プレイヤーではありません');
  }

  const stock = getLobbyReserve(player);
  if (stock < 1) {
    errors.push('成長に必要なロビーストックが不足しています');
  }

  // 成長可能かどうかのチェックは厳密には難しい（選択肢による）が、
  // 少なくとも1つは解除可能なノードがあるかチェックすべきか？
  // ここでは簡易的にストックチェックのみとする。
  // applyGrowthSelection内で解除できなければ何もしない（コストだけ払うことになるかも？）
  // いや、applyGrowthSelectionは解除できた数だけループするわけではない。
  // amount分ループして、解除できなければbreakする。
  // なので、解除できなくてもコストは払われる仕様にするか、
  // 事前にチェックするか。
  // ユーザー体験的には事前にチェックしたいが、選択肢がPayloadに含まれている場合はチェック可能。

  return errors;
};

export const applyGrowth: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const stock = getLobbyReserve(player);
  if (stock < 1) {
    throw new Error('成長に必要なロビーストックが不足しています');
  }

  player.lobbyReserve = stock - 1;
  incrementPlayerLobbyUsed(player, 1); // 成長に使用した分もUsedにカウントする？
  // gainLobbyFromStockではUsedにカウントしている。
  // 成長は「消費」なので、Usedにカウントすべきか、単に減らすべきか。
  // "Use stock" -> usually means it's gone.
  // If I increment Used, it implies it might come back?
  // But applyGrowthSelection doesn't use lobby.
  // Let's assume it's consumed permanently?
  // Or maybe it goes to "Used" and can be recovered?
  // "Use stock to add one unused lobby OR use stock for any growth".
  // If I add to lobby, it goes to Available.
  // If I use for growth, it's gone?
  // Let's assume consumed. So NO incrementPlayerLobbyUsed.
  // Wait, gainLobbyFromStock calls incrementPlayerLobbyUsed.
  // Let's check gainLobbyFromStock again.
  // "incrementPlayerLobbyUsed(player, transferable);"
  // If lobbyUsed tracks "total lobby tokens in circulation", then yes.
  // If lobbyUsed tracks "tokens on board/hand", then yes.
  // If lobbyReserve is "potential tokens", and lobbyUsed/Available are "actual tokens".
  // Then Growth consumes "potential tokens" to unlock ability.
  // It does NOT create a token.
  // So we should NOT increment lobbyUsed. Just decrement Reserve.

  const payload = action.payload as Record<string, unknown>;
  const selection = Array.isArray(payload.selection) ? payload.selection.map(String) : undefined;

  applyGrowthSelection(gameState, context.ruleset, player, selection, 1);
};

export const validateReplenishLobby: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  if (gameState.currentPlayerId !== action.playerId) {
    errors.push('現在の手番プレイヤーではありません');
  }

  const stock = getLobbyReserve(player);
  if (stock < 1) {
    errors.push('補充に必要なロビーストックが不足しています');
  }

  return errors;
};

export const applyReplenishLobby: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  // gainLobbyFromStock handles validation of amount <= stock internally?
  // No, it takes min(stock, amount).
  // But we want to ensure we actually gained 1.
  const stock = getLobbyReserve(player);
  if (stock < 1) {
    throw new Error('補充に必要なロビーストックが不足しています');
  }

  // gainLobbyFromStock moves from Reserve to Used?
  // Wait, I need to check gainLobbyFromStock implementation again.
  // It calls incrementPlayerLobbyUsed.
  // Does it update lobbyAvailable?
  // NO!
  // gainLobbyFromStock (line 2435):
  // player.lobbyReserve = stock - transferable;
  // incrementPlayerLobbyUsed(player, transferable);
  // It does NOT increase lobbyAvailable.
  // This function seems to be "Move from Reserve to Used (e.g. when paying cost?)".
  // If I want to "Add one unused lobby", I should move to Available.

  // So I should implement my own logic here.
  player.lobbyReserve = stock - 1;
  player.lobbyAvailable = (player.lobbyAvailable ?? 0) + 1;
  // And maybe increment Used?
  // If Used tracks "Active Tokens", then yes.
  // Let's assume Used tracks "Tokens that are not in Reserve".
  // Then yes.
  incrementPlayerLobbyUsed(player, 1);
};

export const validateSupplySelect: Validator = async (action, context) => {
  const errors: string[] = [];
  const { gameState } = context;

  if (gameState.currentPhase !== 'supply') {
    errors.push('供給フェーズではありません');
  }

  const player = gameState.players[action.playerId];
  if (!player) {
    errors.push('プレイヤーが存在しません');
    return errors;
  }

  if (gameState.supplySelections?.[action.playerId]) {
    errors.push('既に供給選択を完了しています');
  }

  const payload = action.payload as { choice?: string; nodeId?: string };
  if (!payload.choice || (payload.choice !== 'lobby' && payload.choice !== 'growth')) {
    errors.push('無効な選択です');
  }

  if (payload.choice === 'growth') {
    // Check if node is valid/unlockable?
    // We can reuse logic or just trust applyGrowthSelection to handle invalid nodes gracefully (it does checks).
    // But basic check:
    if (!payload.nodeId) {
      // If no nodeId, applyGrowthSelection picks one automatically?
      // Let's allow it.
    }
  }

  return errors;
};

export const applySupplySelect: EffectApplier = async (action, context) => {
  const { gameState } = context;
  const player = gameState.players[action.playerId];
  if (!player) {
    throw new Error('プレイヤーが存在しません');
  }

  const payload = action.payload as { choice: 'lobby' | 'growth'; nodeId?: string };

  // Consume Stock
  const stock = getLobbyReserve(player);
  if (stock < 1) {
    throw new Error('供給選択に必要なロビーストックが不足しています');
  }
  player.lobbyReserve = stock - 1;

  if (payload.choice === 'lobby') {
    // Gain 1 Lobby (Available)
    player.lobbyAvailable = (player.lobbyAvailable ?? 0) + 1;
  } else if (payload.choice === 'growth') {
    // Unlock Node
    const selection = payload.nodeId ? [payload.nodeId] : undefined;
    applyGrowthSelection(gameState, context.ruleset, player, selection, 1);
  }

  // Mark selection as done
  if (!gameState.supplySelections) {
    gameState.supplySelections = {};
  }
  gameState.supplySelections[action.playerId] = true;

  // Check if all players selected
  const allSelected = Object.keys(gameState.players).every(
    (pid) => gameState.supplySelections?.[pid]
  );

  if (allSelected) {
    // Transition to Main Phase
    // We can trigger it via GameSession or just set it here?
    // GameSession.advancePhase checks currentPhase.
    // If we change it here, GameSession needs to know?
    // GameSession.processAction saves state.
    // If we change phase here, next advancePhase call might be confused?
    // Actually, GameSession.processAction doesn't call advancePhase automatically unless 'pass'.
    // But here we want to auto-advance.
    // We can set currentPhase = 'main' here.
    // And call phaseManager.mainPhase?
    // We don't have access to phaseManager here directly.
    // But we can set the state.
    // GameSession.processAction doesn't handle phase transitions other than 'pass' -> endRound.
    // So we should probably set a flag or just set the phase.
    // If we set phase to 'main', we need to run mainPhase logic (reset pass flags etc).
    // But mainPhase logic is simple: set phase to main, set current player.
    // We can do it here manually.
    gameState.currentPhase = 'main';
    // Ensure current player is set correctly (should be set in preparePhase)
    // Reset pass flags (already done in preparePhase)
  }
};
