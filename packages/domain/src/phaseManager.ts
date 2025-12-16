import {
  MutableGameState,
  PhaseManager,
  PlayerId,
  ResourceReward,
  Ruleset,
  TurnOrder,
  ResourceType,
  CraftedLensSideItem,
} from './types';
import { triggerEvent } from './triggerEngine';


const MAX_ACTION_POINTS = 10;
const MAX_CREATIVITY = 5;

interface PhaseManagerDeps {
  turnOrder: TurnOrder;
  ruleset: Ruleset;
  rulesetConfig?: {
    initialActionPoints: number;
    supplyCreativity?: number;
    publicDevelopmentSlots: number;
    stagnationPenalty?: number;
    publicVpSlots?: number;
  };
  initializeDevelopmentDeck?: (gameState: MutableGameState['state']) => Promise<void>;
  initializeVpDeck?: (gameState: MutableGameState['state']) => Promise<void>;
}

export class PhaseManagerImpl implements PhaseManager {
  constructor(private readonly deps: PhaseManagerDeps) { }

  async preparePhase(state: MutableGameState): Promise<void> {
    const gameState = state.state;
    if (this.deps.initializeDevelopmentDeck && !gameState.developmentDeckInitialized) {
      await this.deps.initializeDevelopmentDeck(gameState);
    }
    if (this.deps.initializeVpDeck && !gameState.vpDeckInitialized) {
      await this.deps.initializeVpDeck(gameState);
    }
    ensureDeckState(gameState);
    const order = determineTurnOrder(gameState.currentRound, gameState.players, gameState.turnOrder);
    this.deps.turnOrder.setInitialOrder(order);
    gameState.currentPlayerId = order[0];
    gameState.currentPhase = 'supply';
    gameState.supplySelections = {};
    Object.keys(gameState.players).forEach((playerId) => {
      const player = gameState.players[playerId];
      const supplyAp = this.deps.rulesetConfig?.initialActionPoints ?? 7;
      const supplyCreativity = this.deps.rulesetConfig?.supplyCreativity ?? 1;
      player.actionPoints = Math.min(MAX_ACTION_POINTS, player.actionPoints + supplyAp);
      player.creativity = Math.min(MAX_CREATIVITY, player.creativity + supplyCreativity);

      // Stock Supply: No automatic grant.
      // Players with Stock > 0 must make a selection. Others are skipped.
      const hasStock = (player.lobbyReserve ?? 0) > 0;
      if (gameState.supplySelections) {
        gameState.supplySelections[playerId] = !hasStock; // true if no stock (skipped), false if stock (needs selection)
      }

      player.hasPassed = false;
      delete player.passedAt;
      if (player.isRooting) {
        player.isRooting = false;
      }
    });

    // If all players are skipped (no stock), advance to main phase immediately
    if (Object.values(gameState.supplySelections).every((v) => v)) {
      gameState.currentPhase = 'main';
    }

    // 公開開発カード補充
    replenishDevelopmentRow(
      gameState,
      this.deps.rulesetConfig?.publicDevelopmentSlots ?? 8,
    );
    replenishVpRow(gameState, this.deps.rulesetConfig?.publicVpSlots ?? 2);
    // 共有ボード初期化（各レンズのロビー状態リセット）
    // レンズ上のロビーはラウンドをまたいで維持されるため、occupantIdは削除しない
    gameState.board.lobbySlots.forEach((slot) => {
      // delete slot.occupantId; // FIX: Do not clear occupantId
      slot.isActive = true;
    });
    await state.save();
  }

  async mainPhase(state: MutableGameState): Promise<void> {
    const gameState = state.state;
    gameState.currentPhase = 'main';
    const currentPlayerId = this.deps.turnOrder.current();
    gameState.currentPlayerId = currentPlayerId;
    Object.values(gameState.players).forEach((player) => {
      player.hasPassed = false;
    });
    await state.save();
  }

  async endPhase(state: MutableGameState): Promise<void> {
    const gameState = state.state;
    gameState.currentPhase = 'end';
    // レンズ上のロビーは残したまま未使用状態に戻す
    gameState.board.lobbySlots.forEach((slot) => {
      slot.isActive = true;
    });

    // Trigger Round End Effects
    triggerEvent(gameState, this.deps.ruleset, 'roundEnd', {
      actorId: gameState.currentPlayerId ?? Object.keys(gameState.players)[0] ?? 'system',
    });

    // ラボに配置したロビーを各プレイヤーのボードに戻す
    const placements = Array.isArray(gameState.labPlacements) ? gameState.labPlacements : [];
    placements.forEach(({ playerId, count }) => {
      if (!count || count <= 0) {
        return;
      }
      const player = gameState.players[playerId];
      if (!player) {
        return;
      }
      const currentAvailable =
        typeof player.lobbyAvailable === 'number' && Number.isFinite(player.lobbyAvailable)
          ? Math.max(0, player.lobbyAvailable)
          : 0;
      player.lobbyAvailable = currentAvailable + count;
    });
    gameState.labPlacements = [];

    // 公開列を補充
    replenishDevelopmentRow(
      gameState,
      this.deps.rulesetConfig?.publicDevelopmentSlots ?? 8,
    );
    replenishVpRow(gameState, this.deps.rulesetConfig?.publicVpSlots ?? 2);
    await state.save();
  }

  async finalScoring(state: MutableGameState): Promise<void> {
    const gameState = state.state;
    gameState.currentPhase = 'finalScoring';
    const endgameEffects = collectCharacterEndgameEffects(gameState, this.deps.ruleset);
    applyResourceConversions(gameState, this.deps.ruleset.endgameConversions);
    applyStagnationPenalty(
      gameState,
      this.deps.rulesetConfig?.stagnationPenalty ?? 2,
      endgameEffects,
    );
    applyCharacterBonuses(gameState, endgameEffects);
    await state.save();
  }
}

function determineTurnOrder(
  currentRound: number,
  players: Record<PlayerId, { hasPassed: boolean; passedAt?: number; isRooting?: boolean }>,
  currentOrder: PlayerId[],
): PlayerId[] {
  if (currentRound === 1) {
    return currentOrder.length > 0 ? [...currentOrder] : (Object.keys(players) as PlayerId[]);
  }

  // Use currentOrder as the base for rotation instead of Object.keys
  // This ensures we maintain the relative order from the previous round
  const ids = currentOrder.length > 0 ? [...currentOrder] : (Object.keys(players) as PlayerId[]);

  const rootingPlayer = ids.find((id) => players[id].isRooting);
  if (rootingPlayer) {
    const idx = ids.indexOf(rootingPlayer);
    return [...ids.slice(idx), ...ids.slice(0, idx)];
  }

  // Find the player who passed earliest
  const passedPlayers = ids.filter((id) => players[id].hasPassed);
  if (passedPlayers.length === 0) {
    return ids; // Should not happen if round ended normally
  }

  // Sort by passedAt timestamp. If passedAt is missing, treat as late pass (Infinity)
  // If timestamps are equal (unlikely) or missing, preserve relative order in `ids`
  const firstPassed = passedPlayers.reduce((earliest, current) => {
    const t1 = players[earliest]?.passedAt ?? Infinity;
    const t2 = players[current]?.passedAt ?? Infinity;
    if (t1 < t2) return earliest;
    if (t2 < t1) return current;
    // If timestamps are equal or both missing, prefer the one appearing earlier in the current order
    // (This maintains stability if data is missing)
    return ids.indexOf(earliest) < ids.indexOf(current) ? earliest : current;
  });

  const idx = ids.indexOf(firstPassed);
  return [...ids.slice(idx), ...ids.slice(0, idx)];
}

function ensureDeckState(gameState: MutableGameState['state']): void {
  if (!Array.isArray(gameState.board.publicDevelopmentCards)) {
    gameState.board.publicDevelopmentCards = [];
  }
  if (!Array.isArray(gameState.board.publicVpCards)) {
    gameState.board.publicVpCards = [];
  }
  if (!Array.isArray(gameState.developmentDeck)) {
    gameState.developmentDeck = [];
  }
  if (!Array.isArray(gameState.vpDeck)) {
    gameState.vpDeck = [];
  }
}

function replenishDevelopmentRow(gameState: MutableGameState['state'], requiredSlots: number): void {
  while (gameState.board.publicDevelopmentCards.length < requiredSlots && gameState.developmentDeck.length > 0) {
    const card = gameState.developmentDeck.shift();
    if (!card) {
      break;
    }
    gameState.board.publicDevelopmentCards.push(card);
  }
}

function replenishVpRow(gameState: MutableGameState['state'], requiredSlots: number): void {
  if (!Array.isArray(gameState.board.publicVpCards)) {
    gameState.board.publicVpCards = [];
  }
  if (!Array.isArray(gameState.vpDeck)) {
    gameState.vpDeck = [];
  }

  while (gameState.board.publicVpCards.length < requiredSlots && gameState.vpDeck.length > 0) {
    const card = gameState.vpDeck.shift();
    if (!card) {
      break;
    }
    gameState.board.publicVpCards.push(card);
  }
}

function applyResourceConversions(gameState: MutableGameState['state'], conversion: ResourceReward): void {
  Object.values(gameState.players).forEach((player) => {
    const { resources } = player;
    if (conversion.light) {
      player.vp += resources.light * conversion.light;
    }
    if (conversion.rainbow) {
      player.vp += resources.rainbow * conversion.rainbow;
    }
    if (conversion.stagnation) {
      player.vp += resources.stagnation * conversion.stagnation;
    }
  });
}

interface CharacterEndgameSummary {
  bonusVp: number;
  negativeVp: number; // Track negative VP separately for conversion
  multiplier: number;
  convertPenalty: boolean;
  finalChain?: boolean;
}

function applyStagnationPenalty(
  gameState: MutableGameState['state'],
  penaltyPerToken: number,
  effects: Map<PlayerId, CharacterEndgameSummary>,
): void {
  if (penaltyPerToken <= 0) {
    return;
  }
  Object.values(gameState.players).forEach((player) => {
    const penalty = player.resources.stagnation * penaltyPerToken;
    if (penalty > 0) {
      const summary = effects.get(player.playerId);
      if (summary?.convertPenalty) {
        player.vp += penalty;
      } else {
        player.vp -= penalty;
      }
    }
  });
}

function collectCharacterEndgameEffects(
  gameState: MutableGameState['state'],
  ruleset: Ruleset,
): Map<PlayerId, CharacterEndgameSummary> {
  const result = new Map<PlayerId, CharacterEndgameSummary>();

  Object.values(gameState.players).forEach((player) => {
    const characterId = player.characterId;
    if (!characterId) {
      return;
    }
    const profile = ruleset.characters[characterId];
    if (!profile) {
      return;
    }
    const unlocked = new Set(player.unlockedCharacterNodes ?? []);
    let summary: CharacterEndgameSummary | undefined;

    const ensureSummary = () => {
      if (!summary) {
        summary = { bonusVp: 0, negativeVp: 0, multiplier: 1, convertPenalty: false };
        result.set(player.playerId, summary);
      }
      return summary;
    };

    profile.nodes.forEach((node) => {
      if (!unlocked.has(node.nodeId)) {
        return;
      }
      node.effects.forEach((effect) => {
        if (effect.type !== 'endGame') {
          return;
        }
        console.error('[DEBUG] Found endGame effect:', effect.payload);
        const payloadKind = typeof effect.payload.kind === 'string' ? effect.payload.kind : undefined;
        switch (payloadKind) {
          case 'vpFlat': {
            const amount = Number(effect.payload.amount ?? 0);
            const s = ensureSummary();
            if (amount < 0) {
              s.negativeVp += amount; // Accumulate negative VP
            } else {
              s.bonusVp += amount;
            }
            break;
          }
          case 'conditionalVp': {
            console.error('[DEBUG] Conditional VP:', effect.payload.condition);
            if (effect.payload.condition === 'finalChain') {
              ensureSummary().finalChain = true;
              console.error('[DEBUG] Set finalChain = true');
            } else if (effect.payload.condition === 'noLightNoRainbow') {
              if (player.resources.light === 0 && player.resources.rainbow === 0) {
                const s = ensureSummary();
                s.bonusVp += Number(effect.payload.amount ?? 0);
              }
            }
            break;
          }
          case 'vpMultiplier': {
            const factor = Number(effect.payload.multiplier ?? 1);
            if (!Number.isNaN(factor) && factor > 0) {
              const s = ensureSummary();
              s.multiplier *= factor;
            }
            break;
          }
          case 'vpPerLobby': {
            const amount = Number(effect.payload.amount ?? 0);
            if (amount > 0) {
              // Count lobby slots owned by player
              const lobbyCount = gameState.board.lobbySlots.filter(slot => slot.ownerId === player.playerId).length;
              const s = ensureSummary();
              s.bonusVp += lobbyCount * amount;
            }
            break;
          }
          case 'convertNegativeVp': {
            ensureSummary().convertPenalty = true;
            break;
          }
          default:
            // 今後の拡張用
            break;
        }
      });
    });
  });

  return result;
}

function applyCharacterBonuses(
  gameState: MutableGameState['state'],
  effects: Map<PlayerId, CharacterEndgameSummary>,
): void {
  effects.forEach((summary, playerId) => {
    const player = gameState.players[playerId];
    if (!player) {
      return;
    }

    if (summary.convertPenalty) {
      // If converting, add absolute value of negative VP (effectively flipping sign from - to +)
      // Since negativeVp is negative (e.g. -25), we subtract it to make it positive (+25).
      // Wait, if we normally subtract it (add negative), we get -25.
      // If we convert, we want +25.
      // So we should ADD -negativeVp.
      // But we haven't applied negativeVp yet.
      // So we just add -negativeVp.
      player.vp += Math.abs(summary.negativeVp);
    } else {
      // Apply negative VP normally
      player.vp += summary.negativeVp;
    }

    player.vp += summary.bonusVp;
    if (summary.multiplier !== 1) {
      player.vp = Math.ceil(player.vp * summary.multiplier);
    }
    if (summary.finalChain) {
      applyFinalChain(gameState, playerId);
    }
  });
}

function applyFinalChain(gameState: MutableGameState['state'], playerId: PlayerId): void {
  const player = gameState.players[playerId];
  if (!player) return;

  const slots = gameState.board.lobbySlots || [];
  const playerSlots = slots.filter(slot => slot.ownerId === playerId);

  playerSlots.forEach(slot => {
    const lensId = slot.lensId;
    const lens = gameState.board.lenses[lensId];
    if (!lens) return;

    // Check Costs (Waive AP, but require Resources/Creativity)
    const cost = lens.cost;
    if (cost) {
      if ((player.resources.light ?? 0) < (cost.light ?? 0)) {
        return;
      }
      if ((player.resources.rainbow ?? 0) < (cost.rainbow ?? 0)) {
        return;
      }
      if ((player.resources.stagnation ?? 0) < (cost.stagnation ?? 0)) {
        return;
      }
      if ((player.creativity ?? 0) < (cost.creativity ?? 0)) {
        return;
      }

      // Deduct Costs
      player.resources.light = (player.resources.light ?? 0) - (cost.light ?? 0);
      player.resources.rainbow = (player.resources.rainbow ?? 0) - (cost.rainbow ?? 0);
      player.resources.stagnation = (player.resources.stagnation ?? 0) - (cost.stagnation ?? 0);
      player.creativity = (player.creativity ?? 0) - (cost.creativity ?? 0);
    }

    // Apply Lens Rewards
    lens.rewards.forEach(reward => {
      if (reward.type === 'vp') {
        player.vp += (reward.value as number);
      } else if (reward.type === 'resource') {
        const val = reward.value as ResourceReward;
        if (val.light) player.resources.light = Math.min((player.resources.maxCapacity?.light ?? 10), player.resources.light + val.light);
        if (val.rainbow) player.resources.rainbow = Math.min((player.resources.maxCapacity?.rainbow ?? 10), player.resources.rainbow + val.rainbow);
        if (val.stagnation) player.resources.stagnation = Math.min((player.resources.maxCapacity?.stagnation ?? 10), player.resources.stagnation + val.stagnation);
        if (val.actionPoints) player.actionPoints += val.actionPoints;
        if (val.creativity) player.creativity += val.creativity;
      }
    });

    // Apply Item Rewards
    const itemReward = accumulateItemEffects(
      (lens as unknown as { rightItems?: CraftedLensSideItem[] }).rightItems,
      'reward',
    );

    if (itemReward.vpGain) player.vp += itemReward.vpGain;
    if (itemReward.resources) {
      const res = itemReward.resources;
      if (res.light) player.resources.light = Math.min((player.resources.maxCapacity?.light ?? 10), player.resources.light + res.light);
      if (res.rainbow) player.resources.rainbow = Math.min((player.resources.maxCapacity?.rainbow ?? 10), player.resources.rainbow + res.rainbow);
      if (res.stagnation) player.resources.stagnation = Math.min((player.resources.maxCapacity?.stagnation ?? 10), player.resources.stagnation + res.stagnation);
    }
  });
}

// Helpers copied from actionHandlers.ts
type ResourceKey = 'light' | 'rainbow' | 'stagnation';

function toResourceKey(label: string | null | undefined): ResourceKey | null {
  if (!label) return null;
  const normalized = label.toLowerCase();
  if (normalized.includes('光') || normalized.includes('light')) return 'light';
  if (normalized.includes('虹') || normalized.includes('rainbow')) return 'rainbow';
  if (normalized.includes('淀') || normalized.includes('stagnation') || normalized.includes('yodomi')) return 'stagnation';
  return null;
}

function normalizeItemLabel(value: string | null | undefined): string {
  return (value ?? '').toString().toLowerCase();
}

interface ItemEffectSummary {
  resources: ResourceReward;
  lobbyGain: number;
  lobbyReturn: number;
  growthGain: number;
  growthLoss: number;
  creativityCost: number;
  vpGain: number;
}

function accumulateItemEffects(
  items: CraftedLensSideItem[] | undefined,
  direction: 'cost' | 'reward',
): ItemEffectSummary {
  const summary: ItemEffectSummary = {
    resources: {},
    lobbyGain: 0,
    lobbyReturn: 0,
    growthGain: 0,
    growthLoss: 0,
    creativityCost: 0,
    vpGain: 0,
  };
  if (!Array.isArray(items)) {
    return summary;
  }

  items.forEach((item) => {
    const label = normalizeItemLabel(item.item ?? item.cardId);
    const amount =
      typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 1;

    const resourceKey = toResourceKey(label);
    if (resourceKey) {
      summary.resources[resourceKey] = (summary.resources[resourceKey] ?? 0) + amount;
      return;
    }

    if (label.includes('img') || label.includes('creativity') || label.includes('想') || label.includes('創')) {
      summary.resources.creativity = (summary.resources.creativity ?? 0) + amount;
      return;
    }

    if (label.includes('grow')) {
      if (direction === 'reward') {
        summary.growthGain += amount;
      } else {
        summary.growthLoss += amount;
      }
      return;
    }

    if (label.includes('loby') || label.includes('lobby') || label.includes('ロビー')) {
      if (direction === 'reward') {
        summary.lobbyGain += amount;
      } else {
        summary.lobbyReturn += amount;
      }
      return;
    }

    if (label.includes('vp')) {
      summary.vpGain += amount;
    }
  });

  return summary;
}
