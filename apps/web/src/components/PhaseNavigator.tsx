"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "../context/SessionContext";

const stagePathMap = {
  characterSelect: "/character-select",
  inGame: "/play",
} as const;

type StageKey = keyof typeof stagePathMap;

export function PhaseNavigator(): null {
  const { gameState, isConnected } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isConnected || !gameState) {
      return;
    }
    const stage = gameState.lifecycleStage as StageKey | undefined;
    if (!stage || stage === "lobby") {
      return;
    }
    const target = stagePathMap[stage];
    if (target && pathname !== target) {
      router.push(target);
    }
  }, [isConnected, gameState?.lifecycleStage, pathname, router]);

  return null;
}
