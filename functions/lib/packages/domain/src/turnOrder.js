"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurnOrderImpl = void 0;
class TurnOrderImpl {
    constructor() {
        this.order = [];
        this.currentIndex = 0;
        this.passedPlayers = new Set();
        this.rootingPlayer = null;
    }
    setInitialOrder(order) {
        this.order = [...order];
        this.currentIndex = 0;
        this.passedPlayers.clear();
        this.rootingPlayer = null;
    }
    current() {
        return this.order[this.currentIndex];
    }
    nextPlayer() {
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
    markPass(playerId) {
        this.passedPlayers.add(playerId);
    }
    registerRooting(playerId) {
        this.rootingPlayer = playerId;
    }
    hasAllPassed() {
        return this.passedPlayers.size >= this.order.length;
    }
    resolveNextRoundStarter() {
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
exports.TurnOrderImpl = TurnOrderImpl;
