import {
  ActionType,
  CharacterTriggerEffectPayload,
  GameState,
  PlayerId,
  Ruleset,
  TriggerEvent,
} from './types';

interface TriggerEventParams {
  actorId: PlayerId;
  ownerId?: PlayerId;
  actionType?: ActionType;
}

interface PlayerTrigger {
  playerId: PlayerId;
  payload: CharacterTriggerEffectPayload;
}

export function triggerEvent(
  gameState: GameState,
  ruleset: Ruleset,
  event: TriggerEvent,
  params: TriggerEventParams,
): void {
  const triggers = collectAllTriggers(gameState, ruleset);
  triggers.forEach(({ playerId, payload }) => {
    const player = gameState.players[playerId];
    if (!player) {
      return;
    }

    switch (payload.event) {
      case 'lensActivatedByOther': {
        if (event !== 'lensActivatedByOther') {
          return;
        }
        if (!params.ownerId || params.ownerId !== playerId) {
          return;
        }
        if (params.actorId === playerId) {
          return;
        }
        const amount = Number(payload.amount ?? 0);
        if (amount) {
          player.vp += amount;
        }
        break;
      }
      case 'developmentSlotFreed': {
        if (event !== 'developmentSlotFreed') {
          return;
        }
        const amount = Number(payload.amount ?? 0);
        if (amount) {
          player.vp += amount;
        }
        break;
      }
      case 'actionPerformed': {
        if (event !== 'actionPerformed') {
          return;
        }
        if (params.actorId !== playerId) {
          return;
        }
        if (payload.actionType && payload.actionType !== params.actionType) {
          return;
        }
        const amount = Number(payload.amount ?? 0);
        if (amount) {
          player.vp += amount;
        }
        break;
      }
      default:
        break;
    }
  });
}

function collectAllTriggers(gameState: GameState, ruleset: Ruleset): PlayerTrigger[] {
  const result: PlayerTrigger[] = [];
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
    profile.nodes.forEach((node) => {
      if (!unlocked.has(node.nodeId)) {
        return;
      }
      if (node.effect.type !== 'trigger') {
        return;
      }
      const payload = node.effect.payload as unknown as CharacterTriggerEffectPayload;
      if (!payload?.event) {
        return;
      }
      result.push({ playerId: player.playerId, payload });
    });
  });
  return result;
}
