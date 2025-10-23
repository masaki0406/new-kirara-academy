export type GamePhase = 'setup' | 'main' | 'end' | 'finalScoring';
export type LifecycleStage = 'lobby' | 'characterSelect' | 'inGame';

export type PlayerId = string;
export type LensId = string;
export type LabId = string;
export type DevelopmentCardId = string;
export type TaskId = string;

export interface GameSession {
  roomId: string;
  currentRound: number;
  currentPhase: GamePhase;
  start(): Promise<void>;
  advancePhase(): Promise<void>;
  endRoundIfNeeded(): Promise<boolean>;
  processAction(action: PlayerAction, ruleset: Ruleset, timestamp: number): Promise<ActionResult>;
}

export interface MutableGameState {
  state: GameState;
  save(): Promise<void>;
}

export interface PhaseManager {
  preparePhase(state: MutableGameState): Promise<void>;
  mainPhase(state: MutableGameState): Promise<void>;
  endPhase(state: MutableGameState): Promise<void>;
  finalScoring(state: MutableGameState): Promise<void>;
}

export interface TurnOrder {
  setInitialOrder(order: PlayerId[]): void;
  current(): PlayerId;
  nextPlayer(): PlayerId | null;
  markPass(playerId: PlayerId): void;
  registerRooting(playerId: PlayerId): void;
  hasAllPassed(): boolean;
}

export type ActionType =
  | 'labActivate'
  | 'lensActivate'
  | 'move'
  | 'refresh'
  | 'collect'
  | 'will'
  | 'task'
  | 'rooting'
  | 'pass';

export interface PlayerAction {
  playerId: PlayerId;
  actionType: ActionType;
  payload: Record<string, unknown>;
}

export interface ActionContext {
  gameState: GameState;
  ruleset: Ruleset;
  timestamp: number;
  turnOrder?: TurnOrder;
}

export interface ActionResult {
  success: boolean;
  errors?: string[];
  updates?: Partial<GameState>;
}

export interface ActionResolver {
  resolve(action: PlayerAction, context: ActionContext): Promise<ActionResult>;
}

export interface ResourceWallet {
  light: number;
  rainbow: number;
  stagnation: number;
  maxCapacity: ResourceCapacity;
  unlimited?: Partial<Record<ResourceType, boolean>>;
}

export type ResourceType = 'light' | 'rainbow' | 'stagnation';

export interface ResourceCapacity {
  light: number;
  rainbow: number;
  stagnation: number;
}

export interface PlayerState {
  playerId: PlayerId;
  displayName: string;
  characterId?: string;
  isHost?: boolean;
  isReady?: boolean;
  actionPoints: number;
  creativity: number;
  vp: number;
  resources: ResourceWallet;
  hand: DevelopmentCardId[];
  ownedLenses: LensId[];
  tasksCompleted: TaskId[];
  hasPassed: boolean;
  isRooting?: boolean;
  unlockedCharacterNodes?: string[];
  lobbyStock?: number;
}

export interface LobbySlot {
  lensId: LensId;
  ownerId: PlayerId;
  occupantId?: PlayerId;
  isActive: boolean;
}

export interface LensState {
  lensId: LensId;
  ownerId: PlayerId;
  cost: ResourceCost;
  rewards: RewardDefinition[];
  slots: number;
  tags: string[];
  status: 'available' | 'exhausted';
}

export interface BoardState {
  lenses: Record<LensId, LensState>;
  lobbySlots: LobbySlot[];
  publicDevelopmentCards: DevelopmentCardId[];
}

export interface ResourceCost {
  light?: number;
  rainbow?: number;
  stagnation?: number;
  creativity?: number;
  actionPoints?: number;
}

export interface RewardDefinition {
  type: 'vp' | 'resource' | 'growth' | 'trigger';
  value: number | ResourceReward | TriggerReward | GrowthReward;
}

export interface ResourceReward {
  light?: number;
  rainbow?: number;
  stagnation?: number;
  actionPoints?: number;
  creativity?: number;
}

export interface TriggerReward {
  triggerType: string;
  payload?: Record<string, unknown>;
}

export interface DevelopmentCardState {
  cardId: DevelopmentCardId;
  category: string;
  cost?: ResourceCost;
  effects: CardEffect[];
}

export type CardEffectType = 'onCollect' | 'ongoing' | 'onAction';

export interface CardEffect {
  type: CardEffectType;
  payload: Record<string, unknown>;
}

export interface TaskState {
  taskId: TaskId;
  description: string;
  requirement: Record<string, unknown>;
  reward: RewardDefinition[];
  isShared: boolean;
}

export interface AdjustPlayerForTestPayload {
  playerId: PlayerId;
  resources?: Partial<Record<ResourceType, number>>;
  lobbyStock?: number;
  lensCount?: number;
}

export interface GameState {
  roomId: string;
  currentRound: number;
  currentPhase: GamePhase;
  currentPlayerId: PlayerId | null;
  lifecycleStage: LifecycleStage;
  turnOrder: PlayerId[];
  players: Record<PlayerId, PlayerState>;
  board: BoardState;
  developmentDeck: DevelopmentCardId[];
  lensDeck: LensId[];
  tasks: Record<TaskId, TaskState>;
  logs: ActionLogEntry[];
  developmentDeckInitialized?: boolean;
  snapshotId?: string;
}

export interface ActionLogEntry {
  id: string;
  timestamp: number;
  playerId: PlayerId;
  actionType: ActionType;
  payload: Record<string, unknown>;
  result: ActionResult;
}

export interface Ruleset {
  version: string;
  resourceCaps: ResourceCapacity;
  endgameConversions: ResourceReward;
  characters: Record<string, CharacterProfile>;
  labs: Record<LabId, LabDefinition>;
  lenses: Record<LensId, LensDefinition>;
  developmentCards: Record<DevelopmentCardId, DevelopmentCardDefinition>;
  tasks: Record<TaskId, TaskDefinition>;
}

export interface CharacterProfile {
  characterId: string;
  name: string;
  nodes: CharacterNode[];
}

export interface CharacterNode {
  nodeId: string;
  position: string;
  cost?: ResourceCost;
  effect: CharacterEffect;
  prerequisites?: string[];
}

export type CharacterEffectType = 'passive' | 'active' | 'endGame' | 'trigger';

export type TriggerEvent =
  | 'lensActivatedByOther'
  | 'developmentSlotFreed'
  | 'actionPerformed';

export interface CharacterTriggerEffectPayload {
  event: TriggerEvent;
  amount?: number;
  actionType?: ActionType;
}

export type EndGameEffectKind =
  | 'vpFlat'
  | 'vpPerLobby'
  | 'vpMultiplier'
  | 'convertNegativeVp'
  | 'conditionalVp';

export interface EndGameEffectPayload {
  kind: EndGameEffectKind;
  amount?: number;
  multiplier?: number;
  condition?: string;
}

export interface CharacterCost {
  creativity?: number;
  actionPoints?: number;
  resources?: ResourceCost;
}

export interface ActiveEffectPayload {
  cost?: CharacterCost;
  rewards?: RewardDefinition[];
  setCapacityUnlimited?: ResourceType[];
}

export interface GrowthReward {
  unlockNodeId?: string;
  vp?: number;
}

export interface CharacterEffect {
  type: CharacterEffectType;
  payload: Record<string, unknown>;
}

export interface LensDefinition extends LensState {}

export interface DevelopmentCardDefinition extends DevelopmentCardState {}

export interface TaskDefinition extends TaskState {}

export interface LabDefinition {
  labId: LabId;
  name: string;
  rewards: RewardDefinition[];
  description?: string;
}

export interface CatalogDevelopmentCard {
  id: string;
  cardId: string;
  costItem?: string;
  costNumber?: number;
  costPosition?: number;
  costLeftUp?: Record<string, number>;
  costLeftDown?: Record<string, number>;
  extras?: Record<string, unknown>;
}
