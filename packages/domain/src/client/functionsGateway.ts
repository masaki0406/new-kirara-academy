import {
  CreateRoomParams,
  JoinRoomParams,
  LeaveRoomParams,
} from '../roomService';
import {
  ActionResult,
  AdjustPlayerForTestPayload,
  CatalogDevelopmentCard,
  GameState,
  PlayerAction,
  PlayerId,
} from '../types';

export interface FunctionsGatewayOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  defaultHeaders?: Record<string, string>;
}

interface StatusResponse {
  status: 'ok' | 'error';
  [key: string]: unknown;
}

interface PerformActionResponse extends StatusResponse {
  result?: ActionResult;
}

interface RandomizeTurnOrderResponse extends StatusResponse {
  order?: PlayerId[];
}

interface GetRoomStateResponse extends StatusResponse {
  state?: GameState;
}

interface UpdateTurnOrderResponse extends StatusResponse {
  order?: PlayerId[];
}

interface ListDevelopmentCardsResponse extends StatusResponse {
  cards?: CatalogDevelopmentCard[];
}

interface SelectCharacterParamsRequest {
  roomId: string;
  playerId: PlayerId;
  characterId: string;
}

interface StartGameRequest {
  roomId: string;
  requesterId: PlayerId;
}

interface BeginCharacterSelectionRequest {
  roomId: string;
  requesterId: PlayerId;
}

interface AdjustPlayerForTestRequest extends AdjustPlayerForTestPayload {
  roomId: string;
}

export class FunctionsGateway {
  private readonly fetchImpl: typeof fetch;

  private readonly defaultHeaders: Record<string, string>;

  constructor(private readonly options: FunctionsGatewayOptions) {
    const impl = options.fetchImpl ?? globalThis.fetch;
    if (!impl) {
      throw new Error('FunctionsGateway requires a fetch implementation.');
    }
    this.fetchImpl = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      impl.call(globalThis, input, init)) as typeof fetch;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...(options.defaultHeaders ?? {}),
    };
  }

  async createRoom(params: CreateRoomParams): Promise<void> {
    await this.call<StatusResponse>('createRoom', params);
  }

  async joinRoom(params: JoinRoomParams): Promise<void> {
    await this.call<StatusResponse>('joinRoom', params);
  }

  async leaveRoom(params: LeaveRoomParams): Promise<void> {
    await this.call<StatusResponse>('leaveRoom', params);
  }

  async randomizeTurnOrder(roomId: string): Promise<PlayerId[] | null> {
    const response = await this.call<RandomizeTurnOrderResponse>('randomizeTurnOrder', { roomId });
    return (response.order as PlayerId[] | undefined) ?? null;
  }

  async updateTurnOrder(roomId: string, order: PlayerId[]): Promise<PlayerId[]> {
    const response = await this.call<UpdateTurnOrderResponse>('updateTurnOrder', { roomId, order });
    if (!response.order) {
      throw new Error('updateTurnOrder response did not include order.');
    }
    return response.order as PlayerId[];
  }

  async selectCharacter(params: SelectCharacterParamsRequest): Promise<void> {
    await this.call<StatusResponse>('selectCharacter', params);
  }

  async startGame(params: StartGameRequest): Promise<void> {
    await this.call<StatusResponse>('startGame', params);
  }

  async beginCharacterSelection(params: BeginCharacterSelectionRequest): Promise<void> {
    await this.call<StatusResponse>('beginCharacterSelection', params);
  }

  async adjustPlayerForTest(roomId: string, payload: AdjustPlayerForTestPayload): Promise<void> {
    const params: AdjustPlayerForTestRequest = { roomId, ...payload };
    await this.call<StatusResponse>('adjustPlayerForTest', params);
  }

  async performAction(roomId: string, action: PlayerAction, timestamp?: number): Promise<ActionResult> {
    const response = await this.call<PerformActionResponse>('performAction', {
      roomId,
      action,
      timestamp,
    });
    if (!response.result) {
      throw new Error('performAction response did not include result.');
    }
    return response.result;
  }

  async getRoomState(roomId: string): Promise<GameState> {
    const response = await this.call<GetRoomStateResponse>('getRoomState', { roomId });
    if (!response.state) {
      throw new Error('getRoomState response did not include state.');
    }
    return response.state;
  }

  async listDevelopmentCards(): Promise<CatalogDevelopmentCard[]> {
    const response = await this.call<ListDevelopmentCardsResponse>('listDevelopmentCards', {});
    return Array.isArray(response.cards) ? (response.cards as CatalogDevelopmentCard[]) : [];
  }

  private async call<T extends StatusResponse>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`FunctionsGateway request failed: ${response.status} ${message}`);
    }

    const data = (await response.json()) as T;
    if (data.status !== 'ok') {
      const result = (data as unknown as { result?: { errors?: string[] } }).result;
      if (result?.errors && result.errors.length > 0) {
        throw new Error(result.errors.join(', '));
      }
      throw new Error(`FunctionsGateway response returned status "${data.status}".`);
    }

    return data;
  }

  private buildUrl(path: string): string {
    const trimmed = this.options.baseUrl.replace(/\/+$/, '');
    return `${trimmed}/${path}`;
  }
}
