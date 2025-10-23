import {
  RoomService,
  CreateRoomParams,
  JoinRoomParams,
  LeaveRoomParams,
  UpdateTurnOrderParams,
  SelectCharacterParams,
  AdjustPlayerForTestParams,
} from '../../packages/domain/src/roomService';
export type { AdjustPlayerForTestParams } from '../../packages/domain/src/roomService';
import {
  ActionResult,
  GameSession,
  GameState,
  PlayerAction,
  PlayerId,
  Ruleset,
} from '../../packages/domain/src/types';

export interface PerformActionRequest {
  roomId: string;
  action: PlayerAction;
  timestamp?: number;
}

export interface StartGameRequest {
  roomId: string;
  requesterId: PlayerId;
}

export interface BeginCharacterSelectionRequest {
  roomId: string;
  requesterId: PlayerId;
}

export interface HandlersDeps {
  roomService: RoomService;
  createGameSession: (roomId: string) => GameSession;
  ruleset: Ruleset;
  timestampProvider?: () => number;
}

export interface RoomHandlers {
  createRoom(data: CreateRoomParams): Promise<void>;
  joinRoom(data: JoinRoomParams): Promise<void>;
  leaveRoom(data: LeaveRoomParams): Promise<void>;
  randomizeTurnOrder(roomId: string): Promise<PlayerId[] | null>;
  updateTurnOrder(data: UpdateTurnOrderParams): Promise<PlayerId[]>;
  selectCharacter(data: SelectCharacterParams): Promise<void>;
  beginCharacterSelection(request: BeginCharacterSelectionRequest): Promise<void>;
  startGame(request: StartGameRequest): Promise<void>;
  performAction(request: PerformActionRequest): Promise<ActionResult>;
  getRoomState(roomId: string): Promise<GameState>;
  adjustPlayerForTest(request: AdjustPlayerForTestParams): Promise<void>;
}

export function buildRoomHandlers(deps: HandlersDeps): RoomHandlers {
  const timestampProvider = deps.timestampProvider ?? (() => Date.now());

  return {
    async createRoom(data: CreateRoomParams) {
      await deps.roomService.createRoom(data);
      await deps.roomService.randomizeTurnOrder(data.roomId);
    },

    async joinRoom(data: JoinRoomParams) {
      await deps.roomService.joinRoom(data);
    },

    async leaveRoom(data: LeaveRoomParams) {
      await deps.roomService.leaveRoom(data);
    },

    async randomizeTurnOrder(roomId: string) {
      return deps.roomService.randomizeTurnOrder(roomId);
    },

    async updateTurnOrder(data: UpdateTurnOrderParams) {
      return deps.roomService.updateTurnOrder(data);
    },

    async selectCharacter(data: SelectCharacterParams) {
      await deps.roomService.selectCharacter(data);
    },

    async beginCharacterSelection(request: BeginCharacterSelectionRequest) {
      await deps.roomService.beginCharacterSelection(request);
    },

    async startGame(request: StartGameRequest) {
      const state = await deps.roomService.getRoomState(request.roomId);
      const requester = state.players[request.requesterId];
      if (!requester) {
        throw new Error('Player not found.');
      }
      if (!requester.isHost) {
        throw new Error('Only the host can start the game.');
      }
      const players = Object.values(state.players);
      if (players.length === 0) {
        throw new Error('No players in the room.');
      }
      const pending = players.filter((player) => !player.characterId);
      if (pending.length > 0) {
        throw new Error('All players must select a character before starting.');
      }
      await deps.roomService.updateLifecycleStage({ roomId: request.roomId, stage: 'inGame' });
      const session = deps.createGameSession(request.roomId);
      await session.start();
    },

    async performAction(request: PerformActionRequest): Promise<ActionResult> {
      const session = deps.createGameSession(request.roomId);
      return session.processAction(
        request.action,
        deps.ruleset,
        request.timestamp ?? timestampProvider(),
      );
    },

    async getRoomState(roomId: string): Promise<GameState> {
      return deps.roomService.getRoomState(roomId);
    },

    async adjustPlayerForTest(request: AdjustPlayerForTestParams): Promise<void> {
      await deps.roomService.adjustPlayerForTest(request);
    },
  };
}
