import { applyTick, type DomainType, type TrackingState } from "./tracker.js";
import { applyFocusRewards, syncActiveTaskFromTracker, type GameState, type RewardState } from "./game.js";

export interface LiveStateSnapshot {
  trackerState: TrackingState;
  rewardState: RewardState;
  gameState: GameState;
}

export function advanceLiveState(
  gameState: GameState,
  trackerState: TrackingState,
  rewardState: RewardState,
  domainType: DomainType,
  deltaMs: number
): LiveStateSnapshot {
  const nextTrackerState = applyTick(trackerState, domainType, deltaMs);
  const rewardsResult = applyFocusRewards(
    gameState,
    rewardState,
    domainType === "good" && !nextTrackerState.paused,
    Math.max(0, deltaMs)
  );

  return {
    trackerState: nextTrackerState,
    rewardState: rewardsResult.rewards,
    gameState: syncActiveTaskFromTracker(rewardsResult.game, nextTrackerState)
  };
}
