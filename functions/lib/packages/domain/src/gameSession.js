"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameSessionImpl = void 0;
class GameSessionImpl {
    constructor(roomId, deps) {
        this.roomId = roomId;
        this.deps = deps;
        this.currentRound = 1;
        this.currentPhase = 'setup';
        this.maxRounds = this.deps.maxRounds ?? 4;
    }
    async start() {
        const mutableState = await this.deps.stateLoader();
        this.currentPhase = 'setup';
        await this.deps.phaseManager.preparePhase(mutableState);
    }
    async advancePhase() {
        const mutableState = await this.deps.stateLoader();
        switch (this.currentPhase) {
            case 'setup':
                this.currentPhase = 'main';
                await this.deps.phaseManager.mainPhase(mutableState);
                break;
            case 'main':
                this.currentPhase = 'end';
                await this.deps.phaseManager.endPhase(mutableState);
                break;
            case 'end':
                if (await this.endRoundIfNeeded()) {
                    return;
                }
                this.currentPhase = 'main';
                await this.deps.phaseManager.mainPhase(mutableState);
                break;
            case 'finalScoring':
                // Nothing to do; game is over
                break;
            default:
                break;
        }
    }
    async endRoundIfNeeded() {
        const mutableState = await this.deps.stateLoader();
        if (this.deps.turnOrder.hasAllPassed()) {
            const state = mutableState.state;
            if (this.currentRound >= this.maxRounds) {
                await this.deps.phaseManager.finalScoring(mutableState);
                this.currentPhase = 'finalScoring';
                return true;
            }
            this.currentRound += 1;
            state.currentRound = this.currentRound;
            state.currentPhase = 'end';
            await mutableState.save();
            this.currentPhase = 'end';
            return true;
        }
        return false;
    }
    async processAction(action, ruleset, timestamp) {
        const mutableState = await this.deps.stateLoader();
        const context = {
            gameState: mutableState.state,
            ruleset,
            timestamp,
            turnOrder: this.deps.turnOrder,
        };
        const result = await this.deps.actionResolver.resolve(action, context);
        if (result.success) {
            await mutableState.save();
            await this.writeLog({
                action,
                timestamp,
                result,
            });
        }
        return result;
    }
    async writeLog(entry) {
        if (!this.deps.logWriter) {
            return;
        }
        await this.deps.logWriter(entry);
    }
}
exports.GameSessionImpl = GameSessionImpl;
