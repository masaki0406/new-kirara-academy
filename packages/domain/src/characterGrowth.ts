export interface GrowthNodeDefinition {
  nodeId: string;
  prerequisitesAny?: string[];
  autoUnlock?: boolean;
}

type CharacterGrowthMap = Record<string, Record<string, GrowthNodeDefinition>>;

export const CHARACTER_GROWTH_DEFINITIONS: CharacterGrowthMap = {
  'shirogami-yuu': {
    'shirogami-yuu:s': { nodeId: 'shirogami-yuu:s', autoUnlock: true },
    'shirogami-yuu:1': {
      nodeId: 'shirogami-yuu:1',
      prerequisitesAny: ['shirogami-yuu:s'],
    },
    'shirogami-yuu:2': {
      nodeId: 'shirogami-yuu:2',
      prerequisitesAny: ['shirogami-yuu:s'],
    },
    'shirogami-yuu:3': {
      nodeId: 'shirogami-yuu:3',
      prerequisitesAny: ['shirogami-yuu:2'],
    },
    'shirogami-yuu:4': {
      nodeId: 'shirogami-yuu:4',
      prerequisitesAny: ['shirogami-yuu:1', 'shirogami-yuu:3'],
    },
    'shirogami-yuu:5': {
      nodeId: 'shirogami-yuu:5',
      prerequisitesAny: ['shirogami-yuu:4'],
    },
    'shirogami-yuu:6': {
      nodeId: 'shirogami-yuu:6',
      prerequisitesAny: ['shirogami-yuu:2'],
    },
    'shirogami-yuu:7': {
      nodeId: 'shirogami-yuu:7',
      prerequisitesAny: ['shirogami-yuu:3'],
    },
    'shirogami-yuu:8': {
      nodeId: 'shirogami-yuu:8',
      prerequisitesAny: ['shirogami-yuu:3', 'shirogami-yuu:4'],
    },
    'shirogami-yuu:9': {
      nodeId: 'shirogami-yuu:9',
      prerequisitesAny: ['shirogami-yuu:7', 'shirogami-yuu:8'],
    },
  },
  'akito-daidou': {
    'akito-daidou:s': { nodeId: 'akito-daidou:s', autoUnlock: true },
    'akito-daidou:1': {
      nodeId: 'akito-daidou:1',
      prerequisitesAny: ['akito-daidou:s'],
    },
    'akito-daidou:2': {
      nodeId: 'akito-daidou:2',
      prerequisitesAny: ['akito-daidou:s'],
    },
    'akito-daidou:3': {
      nodeId: 'akito-daidou:3',
      prerequisitesAny: ['akito-daidou:s'],
    },
    'akito-daidou:4': {
      nodeId: 'akito-daidou:4',
      prerequisitesAny: ['akito-daidou:1', 'akito-daidou:3', 'akito-daidou:5'],
    },
    'akito-daidou:5': {
      nodeId: 'akito-daidou:5',
      prerequisitesAny: ['akito-daidou:1', 'akito-daidou:3'],
    },
    'akito-daidou:6': {
      nodeId: 'akito-daidou:6',
      prerequisitesAny: ['akito-daidou:4'],
    },
    'akito-daidou:7': {
      nodeId: 'akito-daidou:7',
      prerequisitesAny: ['akito-daidou:4', 'akito-daidou:5'],
    },
    'akito-daidou:8': {
      nodeId: 'akito-daidou:8',
      prerequisitesAny: ['akito-daidou:6'],
    },
    'akito-daidou:9': {
      nodeId: 'akito-daidou:9',
      prerequisitesAny: ['akito-daidou:8'],
    },
  },
  'kazari-hizumi': {
    'kazari-hizumi:s': { nodeId: 'kazari-hizumi:s', autoUnlock: true },
    'kazari-hizumi:1': {
      nodeId: 'kazari-hizumi:1',
      prerequisitesAny: ['kazari-hizumi:s'],
    },
    'kazari-hizumi:2': {
      nodeId: 'kazari-hizumi:2',
      prerequisitesAny: ['kazari-hizumi:s'],
    },
    'kazari-hizumi:3': {
      nodeId: 'kazari-hizumi:3',
      prerequisitesAny: ['kazari-hizumi:s'],
    },
    'kazari-hizumi:4': {
      nodeId: 'kazari-hizumi:4',
      prerequisitesAny: ['kazari-hizumi:s'],
    },
    'kazari-hizumi:5': {
      nodeId: 'kazari-hizumi:5',
      prerequisitesAny: ['kazari-hizumi:1', 'kazari-hizumi:3'],
    },
    'kazari-hizumi:6': {
      nodeId: 'kazari-hizumi:6',
      prerequisitesAny: ['kazari-hizumi:1', 'kazari-hizumi:3'],
    },
    'kazari-hizumi:7': {
      nodeId: 'kazari-hizumi:7',
      prerequisitesAny: ['kazari-hizumi:4'],
    },
    'kazari-hizumi:8': {
      nodeId: 'kazari-hizumi:8',
      prerequisitesAny: ['kazari-hizumi:6'],
    },
    'kazari-hizumi:9': {
      nodeId: 'kazari-hizumi:9',
      prerequisitesAny: ['kazari-hizumi:8'],
    },
  },
  'midori-rina': {
    'midori-rina:s': { nodeId: 'midori-rina:s', autoUnlock: true },
    'midori-rina:1': {
      nodeId: 'midori-rina:1',
      prerequisitesAny: ['midori-rina:s'],
    },
    'midori-rina:2': {
      nodeId: 'midori-rina:2',
      prerequisitesAny: ['midori-rina:s'],
    },
    'midori-rina:3': {
      nodeId: 'midori-rina:3',
      prerequisitesAny: ['midori-rina:s'],
    },
    'midori-rina:4': {
      nodeId: 'midori-rina:4',
      prerequisitesAny: ['midori-rina:s'],
    },
    'midori-rina:5': {
      nodeId: 'midori-rina:5',
      prerequisitesAny: ['midori-rina:1'],
    },
    'midori-rina:6': {
      nodeId: 'midori-rina:6',
      prerequisitesAny: ['midori-rina:3', 'midori-rina:4', 'midori-rina:5'],
    },
    'midori-rina:7': {
      nodeId: 'midori-rina:7',
      prerequisitesAny: ['midori-rina:6', 'midori-rina:8'],
    },
    'midori-rina:8': {
      nodeId: 'midori-rina:8',
      prerequisitesAny: ['midori-rina:6'],
    },
    'midori-rina:9': {
      nodeId: 'midori-rina:9',
      prerequisitesAny: ['midori-rina:7'],
    },
  },
  'aono-haruyo': {
    'aono-haruyo:s': { nodeId: 'aono-haruyo:s', autoUnlock: true },
    'aono-haruyo:1': {
      nodeId: 'aono-haruyo:1',
      prerequisitesAny: ['aono-haruyo:s'],
    },
    'aono-haruyo:2': {
      nodeId: 'aono-haruyo:2',
      prerequisitesAny: ['aono-haruyo:s'],
    },
    'aono-haruyo:3': {
      nodeId: 'aono-haruyo:3',
      prerequisitesAny: ['aono-haruyo:s'],
    },
    'aono-haruyo:4': {
      nodeId: 'aono-haruyo:4',
      prerequisitesAny: ['aono-haruyo:1', 'aono-haruyo:3'],
    },
    'aono-haruyo:5': {
      nodeId: 'aono-haruyo:5',
      prerequisitesAny: ['aono-haruyo:4'],
    },
    'aono-haruyo:6': {
      nodeId: 'aono-haruyo:6',
      prerequisitesAny: ['aono-haruyo:4'],
    },
    'aono-haruyo:7': {
      nodeId: 'aono-haruyo:7',
      prerequisitesAny: ['aono-haruyo:4'],
    },
    'aono-haruyo:8': {
      nodeId: 'aono-haruyo:8',
      prerequisitesAny: ['aono-haruyo:6', 'aono-haruyo:7'],
    },
    'aono-haruyo:9': {
      nodeId: 'aono-haruyo:9',
      prerequisitesAny: ['aono-haruyo:6', 'aono-haruyo:7'],
    },
    'aono-haruyo:10': {
      nodeId: 'aono-haruyo:10',
      prerequisitesAny: ['aono-haruyo:5'],
    },
  },
  'akane-hiyori': {
    'akane-hiyori:s': { nodeId: 'akane-hiyori:s', autoUnlock: true },
    'akane-hiyori:1': {
      nodeId: 'akane-hiyori:1',
      prerequisitesAny: ['akane-hiyori:s'],
    },
    'akane-hiyori:2': {
      nodeId: 'akane-hiyori:2',
      prerequisitesAny: ['akane-hiyori:s'],
    },
    'akane-hiyori:3': {
      nodeId: 'akane-hiyori:3',
      prerequisitesAny: ['akane-hiyori:s'],
    },
    'akane-hiyori:4': {
      nodeId: 'akane-hiyori:4',
      prerequisitesAny: ['akane-hiyori:1', 'akane-hiyori:3'],
    },
    'akane-hiyori:5': {
      nodeId: 'akane-hiyori:5',
      prerequisitesAny: ['akane-hiyori:1', 'akane-hiyori:3'],
    },
    'akane-hiyori:6': {
      nodeId: 'akane-hiyori:6',
      prerequisitesAny: ['akane-hiyori:4'],
    },
    'akane-hiyori:7': {
      nodeId: 'akane-hiyori:7',
      prerequisitesAny: ['akane-hiyori:4'],
    },
    'akane-hiyori:8': {
      nodeId: 'akane-hiyori:8',
      prerequisitesAny: ['akane-hiyori:6'],
    },
    'akane-hiyori:9': {
      nodeId: 'akane-hiyori:9',
      prerequisitesAny: ['akane-hiyori:5'],
    },
  },
};

export function getGrowthNode(characterId: string, nodeId: string): GrowthNodeDefinition |undefined {
  return CHARACTER_GROWTH_DEFINITIONS[characterId]?.[nodeId];
}

export function isGrowthNodeAutoUnlocked(characterId: string, nodeId: string): boolean {
  return getGrowthNode(characterId, nodeId)?.autoUnlock ?? false;
}

export function canUnlockGrowthNode(
  characterId: string,
  nodeId: string,
  unlockedNodes: Set<string>,
): boolean {
  const definition = getGrowthNode(characterId, nodeId);
  if (!definition) {
    return false;
  }
  if (definition.autoUnlock) {
    return false;
  }
  if (definition.prerequisitesAny && definition.prerequisitesAny.length > 0) {
    const satisfied = definition.prerequisitesAny.some((dep) => unlockedNodes.has(dep));
    if (!satisfied) {
      return false;
    }
  }
  return true;
}

export function buildUnlockedSetWithAuto(
  characterId: string,
  unlockedNodes: Iterable<string>,
): Set<string> {
  const set = new Set(unlockedNodes);
  const definition = CHARACTER_GROWTH_DEFINITIONS[characterId];
  if (definition) {
    Object.values(definition).forEach((node) => {
      if (node.autoUnlock) {
        set.add(node.nodeId);
      }
    });
  }
  return set;
}
