import { PlayerId, TurnOrder } from './types';

export class TurnOrderImpl implements TurnOrder {
  private order: PlayerId[] = [];
  private currentIndex = 0;
  private passedPlayers = new Set<PlayerId>();
  private rootingPlayer: PlayerId | null = null;

  setInitialOrder(order: PlayerId[]): void {
    this.order = [...order];
    this.currentIndex = 0;
    this.passedPlayers.clear();
    this.rootingPlayer = null;
  }

  current(): PlayerId {
    return this.order[this.currentIndex];
  }

  nextPlayer(): PlayerId | null {
    if (this.passedPlayers.size >= this.order.length) {
      return null;
    }

    let attempts = 0;
    do {
      this.currentIndex = (this.currentIndex + 1) % this.order.length;
      attempts += 1;
    } while (this.passedPlayers.has(this.order[this.currentIndex]) && attempts <= this.order.length);

    if (attempts > this.order.length) {
      return null;
    }

    return this.order[this.currentIndex];
  }

  markPass(playerId: PlayerId): void {
    this.passedPlayers.add(playerId);
  }

  registerRooting(playerId: PlayerId): void {
    this.rootingPlayer = playerId;
  }

  hasAllPassed(): boolean {
    return this.passedPlayers.size >= this.order.length;
  }

  resolveNextRoundStarter(): PlayerId | null {
    if (this.rootingPlayer) {
      return this.rootingPlayer;
    }

    // Earliest player who passed
    for (const pid of this.order) {
      if (this.passedPlayers.has(pid)) {
        return pid;
      }
    }

    return this.order[0] ?? null;
  }
}
