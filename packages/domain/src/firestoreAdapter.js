const DEFAULT_COLLECTION = 'rooms';
const DEFAULT_LOG_COLLECTION = 'logs';
export class FirestoreAdapterImpl {
    constructor(firestore, options) {
        this.firestore = firestore;
        this.options = options;
        if (typeof options.createInitialState !== 'function') {
            throw new Error('FirestoreAdapter requires `createInitialState` option.');
        }
        this.collectionPath = options.collectionPath ?? DEFAULT_COLLECTION;
        this.logsCollectionName = options.logsCollectionName ?? DEFAULT_LOG_COLLECTION;
        this.timestampProvider = options.timestampProvider ?? (() => Date.now());
    }
    async loadGameState(roomId) {
        const docRef = this.roomDoc(roomId);
        const snapshot = await docRef.get();
        let state;
        if (snapshot.exists) {
            state = snapshot.data();
        }
        else {
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
    async appendLog(roomId, entry) {
        const logs = this.logsCollection(roomId);
        await logs.add({
            entry,
            createdAt: this.timestampProvider(),
        });
    }
    roomDoc(roomId) {
        return this.firestore.doc(`${this.collectionPath}/${roomId}`);
    }
    logsCollection(roomId) {
        return this.roomDoc(roomId).collection(this.logsCollectionName);
    }
}
