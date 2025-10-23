import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { GameState } from '../../packages/domain/src/types';

const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'bgsample-b0ab4';

const FUNCTION_ORIGIN = process.env.FUNCTIONS_EMULATOR_ORIGIN || 'http://127.0.0.1:5003';
const BASE_URL = `${FUNCTION_ORIGIN}/${PROJECT_ID}/us-central1`;

async function callFunction<T = unknown>(name: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Function ${name} failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

beforeAll(() => {
  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID });
  }
});

afterAll(async () => {
  const app = getApps()[0];
  if (app) {
    await app.delete();
  }
});

describe('Functions + Firestore emulator flow', () => {
  it('creates a room, joins, fetches state, and resolves a pass action', async () => {
    const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8086';
    const firestore = getFirestore();
    firestore.settings({
      host: firestoreHost,
      ssl: false,
    });

    const roomId = `integration-room-${Date.now()}`;
    const hostId = 'host-player';
    const guestId = 'guest-player';

    const createResponse = await callFunction<{ status: string }>('createRoom', {
      roomId,
      hostId,
      hostName: 'Integration Host',
    });

    expect(createResponse.status).toBe('ok');

    const joinResponse = await callFunction<{ status: string }>('joinRoom', {
      roomId,
      playerId: guestId,
      playerName: 'Integration Guest',
    });

    expect(joinResponse.status).toBe('ok');

    const stateResponse = await callFunction<{ status: string; state: GameState }>('getRoomState', {
      roomId,
    });

    expect(stateResponse.status).toBe('ok');
    expect(stateResponse.state.roomId).toBe(roomId);

    const actionResponse = await callFunction<{
      status: string;
      result: { success: boolean; errors?: string[] };
    }>('performAction', {
      roomId,
      action: {
        playerId: hostId,
        actionType: 'pass',
        payload: {},
      },
      timestamp: Date.now(),
    });

    expect(actionResponse.status).toBe('ok');
    expect(actionResponse.result.success).toBe(true);

    const snapshot = await firestore.collection('rooms').doc(roomId).get();
    expect(snapshot.exists).toBe(true);

    const data = snapshot.data();
    expect(data).toBeTruthy();
    expect(data?.players?.[hostId]?.hasPassed).toBe(true);
    expect(Object.keys(data?.players ?? {})).toContain(guestId);
  }, 30_000);
});
