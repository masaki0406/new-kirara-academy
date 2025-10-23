import { GameState } from './types';

export interface GameStateSnapshot {
  state: GameState;
  save(): Promise<void>;
}

export interface FirestoreAdapter {
  loadGameState(roomId: string): Promise<GameStateSnapshot>;
  appendLog(roomId: string, entry: unknown): Promise<void>;
}

export interface FirestoreAdapterOptions {
  createInitialState(roomId: string): GameState;
  collectionPath?: string;
  logsCollectionName?: string;
  timestampProvider?: () => unknown;
}

export interface FirestoreLike {
  doc(path: string): DocumentReferenceLike;
}

export interface DocumentReferenceLike {
  get(): Promise<DocumentSnapshotLike>;
  set(data: unknown, options?: { merge?: boolean }): Promise<void>;
  collection(path: string): CollectionReferenceLike;
}

export interface DocumentSnapshotLike {
  exists: boolean;
  data(): unknown;
}

export interface CollectionReferenceLike {
  add(data: unknown): Promise<void>;
}

const DEFAULT_COLLECTION = 'rooms';
const DEFAULT_LOG_COLLECTION = 'logs';

export class FirestoreAdapterImpl implements FirestoreAdapter {
  private readonly collectionPath: string;
  private readonly logsCollectionName: string;
  private readonly timestampProvider: () => unknown;

  constructor(private readonly firestore: FirestoreLike, private readonly options: FirestoreAdapterOptions) {
    if (typeof options.createInitialState !== 'function') {
      throw new Error('FirestoreAdapter requires `createInitialState` option.');
    }

    this.collectionPath = options.collectionPath ?? DEFAULT_COLLECTION;
    this.logsCollectionName = options.logsCollectionName ?? DEFAULT_LOG_COLLECTION;
    this.timestampProvider = options.timestampProvider ?? (() => Date.now());
  }

  async loadGameState(roomId: string): Promise<GameStateSnapshot> {
    const docRef = this.roomDoc(roomId);
    const snapshot = await docRef.get();

    let state: GameState;
    if (snapshot.exists) {
      state = snapshot.data() as GameState;
    } else {
      state = this.options.createInitialState(roomId);
      await docRef.set(state, { merge: false });
    }

    return {
      state,
      save: async () => {
        await docRef.set(state, { merge: false });
      },
    };
  }

  async appendLog(roomId: string, entry: unknown): Promise<void> {
    const logs = this.logsCollection(roomId);
    await logs.add({
      entry,
      createdAt: this.timestampProvider(),
    });
  }

  private roomDoc(roomId: string): DocumentReferenceLike {
    return this.firestore.doc(`${this.collectionPath}/${roomId}`);
  }

  private logsCollection(roomId: string): CollectionReferenceLike {
    return this.roomDoc(roomId).collection(this.logsCollectionName);
  }
}
