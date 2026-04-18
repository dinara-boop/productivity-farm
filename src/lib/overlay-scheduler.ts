import type { DomainType } from "./tracker.js";

export type OverlayNotificationKind = "positive" | "negative";

export interface OverlayNotification {
  kind: OverlayNotificationKind;
  message: string;
}

export interface OverlaySchedulerCallbacks {
  show: (notification: OverlayNotification) => void;
  hide: () => void;
}

export interface OverlaySchedulerConfig {
  repeatMs: number;
  displayMs: number;
}

const PRIORITY: Record<OverlayNotificationKind, number> = {
  positive: 1,
  negative: 2
};

export const OVERLAY_REPEAT_MS = 60_000;
export const OVERLAY_DISPLAY_MS = 4_000;

export const OVERLAY_MESSAGES: Record<OverlayNotificationKind, string> = {
  positive: "Ты такой молодец!",
  negative: "Мне тут не нравится🥺"
};

export class MonsterOverlayScheduler {
  private siteKey: string | null = null;
  private siteType: DomainType = "neutral";
  private repeatTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private activeKind: OverlayNotificationKind | null = null;

  constructor(
    private readonly callbacks: OverlaySchedulerCallbacks,
    private readonly config: OverlaySchedulerConfig = {
      repeatMs: OVERLAY_REPEAT_MS,
      displayMs: OVERLAY_DISPLAY_MS
    }
  ) {}

  updateContext(siteKey: string | null, siteType: DomainType): void {
    if (this.siteKey === siteKey && this.siteType === siteType) {
      return;
    }

    this.siteKey = siteKey;
    this.siteType = siteType;
    this.resetPresentation();

    if (!siteKey || siteType === "neutral") {
      return;
    }

    if (siteType === "bad") {
      this.emit("negative");
      this.scheduleNext("negative", this.config.repeatMs);
      return;
    }

    this.scheduleNext("positive", this.config.repeatMs);
  }

  dispose(): void {
    this.siteKey = null;
    this.siteType = "neutral";
    this.resetPresentation();
  }

  private resetPresentation(): void {
    this.clearRepeatTimer();
    this.clearHideTimer();
    this.activeKind = null;
    this.callbacks.hide();
  }

  private scheduleNext(kind: OverlayNotificationKind, delayMs: number): void {
    this.clearRepeatTimer();
    this.repeatTimer = setTimeout(() => {
      this.emit(kind);
      this.scheduleNext(kind, this.config.repeatMs);
    }, Math.max(0, delayMs));
  }

  private emit(kind: OverlayNotificationKind): void {
    if (this.activeKind && PRIORITY[this.activeKind] > PRIORITY[kind]) {
      return;
    }

    this.activeKind = kind;
    this.callbacks.show({
      kind,
      message: OVERLAY_MESSAGES[kind]
    });

    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      if (this.activeKind === kind) {
        this.activeKind = null;
      }
      this.callbacks.hide();
    }, this.config.displayMs);
  }

  private clearRepeatTimer(): void {
    if (this.repeatTimer !== null) {
      clearTimeout(this.repeatTimer);
      this.repeatTimer = null;
    }
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
