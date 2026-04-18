type DomainType = "good" | "bad" | "neutral";
type OverlayNotificationKind = "positive" | "negative";

interface OverlayNotification {
  kind: OverlayNotificationKind;
  message: string;
}

interface DomainLists {
  good: string[];
  bad: string[];
}

interface OverlaySchedulerCallbacks {
  show: (notification: OverlayNotification) => void;
  hide: () => void;
}

const STORAGE_KEYS = {
  goodDomains: "goodDomains",
  badDomains: "badDomains"
} as const;

const LOCATION_POLL_MS = 1_000;
const OVERLAY_REPEAT_MS = 60_000;
const OVERLAY_DISPLAY_MS = 4_000;
const MONSTER_OVERLAY_ROOT_ID = "monster-overlay-root";
const MONSTER_OVERLAY_EXIT_MS = 260;

const OVERLAY_MESSAGES: Record<OverlayNotificationKind, string> = {
  positive: "Ты такой молодец!",
  negative: "Мне тут не нравится🥺"
};

const MONSTER_OVERLAY_STYLE_TEXT = `
:host {
  all: initial;
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 999999;
  pointer-events: none;
  width: min(320px, calc(100vw - 32px));
  contain: layout style paint;
}

.monster-overlay-viewport,
.monster-overlay-viewport * {
  box-sizing: border-box;
}

.monster-overlay-viewport {
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
  color: #253127;
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  min-height: 1px;
}

.monster-overlay-notification {
  opacity: 0;
  transform: translateY(12px) scale(0.9);
  transition:
    opacity 240ms ease,
    transform 240ms ease;
  filter: drop-shadow(0 14px 32px rgba(58, 77, 42, 0.18));
}

.monster-overlay-notification.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.monster-overlay-notification.is-hiding {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
}

.monster-overlay-card {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.monster-overlay-bubble {
  position: relative;
  max-width: 200px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(245, 255, 248, 0.94));
  box-shadow:
    0 16px 28px rgba(35, 56, 33, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(8px);
}

.monster-overlay-bubble::after {
  content: "";
  position: absolute;
  right: -9px;
  bottom: 20px;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  transform: rotate(45deg);
  background: inherit;
  border-right: inherit;
  border-bottom: inherit;
}

.monster-overlay-notification--positive .monster-overlay-bubble {
  background:
    linear-gradient(180deg, rgba(234, 255, 255, 0.97), rgba(224, 246, 229, 0.95));
}

.monster-overlay-notification--negative .monster-overlay-bubble {
  background:
    linear-gradient(180deg, rgba(255, 244, 249, 0.98), rgba(255, 232, 238, 0.95));
}

.monster-overlay-bubble-text {
  position: relative;
  z-index: 1;
  font-size: 14px;
  line-height: 1.35;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.monster-overlay-sparkles {
  position: absolute;
  top: -6px;
  right: 10px;
  display: flex;
  gap: 6px;
}

.monster-overlay-sparkle {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: linear-gradient(180deg, #fff7ae, #ffdd6c);
  box-shadow: 0 0 12px rgba(255, 221, 108, 0.9);
  animation: monster-overlay-twinkle 1.9s ease-in-out infinite;
}

.monster-overlay-sparkle:nth-child(2) {
  width: 5px;
  height: 5px;
  animation-delay: 240ms;
}

.monster-overlay-sparkle:nth-child(3) {
  width: 6px;
  height: 6px;
  animation-delay: 480ms;
}

.monster-overlay-figure {
  position: relative;
  flex: 0 0 auto;
  width: 116px;
  height: 116px;
}

.monster-overlay-glow {
  position: absolute;
  inset: 20px 16px 10px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(190, 231, 173, 0.52), rgba(190, 231, 173, 0));
}

.monster-overlay-notification--negative .monster-overlay-glow {
  background: radial-gradient(circle, rgba(255, 199, 214, 0.55), rgba(255, 199, 214, 0));
}

.monster-overlay-monster {
  position: relative;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform-origin: 50% 100%;
  animation: monster-overlay-sway 3.15s ease-in-out infinite;
  user-select: none;
  -webkit-user-drag: none;
}

.monster-overlay-monster--positive {
  animation-duration: 3.25s;
  filter: saturate(1.05) brightness(1.03);
}

.monster-overlay-monster--negative {
  animation-duration: 2.8s;
  filter: saturate(0.88) brightness(0.97);
}

@keyframes monster-overlay-sway {
  0% {
    transform: rotate(-2deg) translateY(0);
  }

  50% {
    transform: rotate(2deg) translateY(-1px);
  }

  100% {
    transform: rotate(-2deg) translateY(0);
  }
}

@keyframes monster-overlay-twinkle {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(0.85);
  }

  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .monster-overlay-notification {
    transition-duration: 120ms;
  }

  .monster-overlay-monster,
  .monster-overlay-sparkle {
    animation: none;
  }
}
`;

function createEmptyDomainLists(): DomainLists {
  return {
    good: [],
    bad: []
  };
}

function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) {
      return null;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) {
      return null;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function shouldPreserveTrackingForUrl(url: string): boolean {
  return (
    url.startsWith("chrome-extension://") ||
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  );
}

function matchesDomainRule(domain: string, entries: string[]): boolean {
  return entries.some((entry) => {
    const normalized = normalizeDomain(entry);
    return normalized ? domain === normalized || domain.endsWith(`.${normalized}`) : false;
  });
}

function classifyDomain(domain: string | null, lists: DomainLists): DomainType {
  if (!domain) {
    return "neutral";
  }

  if (matchesDomainRule(domain, lists.good)) {
    return "good";
  }

  if (matchesDomainRule(domain, lists.bad)) {
    return "bad";
  }

  return "neutral";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createOverlayMarkup(notification: OverlayNotification, assetUrl: string): string {
  const toneClass =
    notification.kind === "negative" ? "monster-overlay-notification--negative" : "monster-overlay-notification--positive";
  const monsterClass =
    notification.kind === "negative" ? "monster-overlay-monster--negative" : "monster-overlay-monster--positive";
  const sparkles =
    notification.kind === "positive"
      ? '<div class="monster-overlay-sparkles"><span class="monster-overlay-sparkle"></span><span class="monster-overlay-sparkle"></span><span class="monster-overlay-sparkle"></span></div>'
      : "";

  return `
    <article class="monster-overlay-notification ${toneClass}" role="status" aria-live="polite">
      <div class="monster-overlay-card">
        <div class="monster-overlay-bubble">
          ${sparkles}
          <div class="monster-overlay-bubble-text">${escapeHtml(notification.message)}</div>
        </div>
        <div class="monster-overlay-figure">
          <div class="monster-overlay-glow"></div>
          <img
            class="monster-overlay-monster ${monsterClass}"
            src="${escapeHtml(assetUrl)}"
            alt=""
            draggable="false"
          />
        </div>
      </div>
    </article>
  `.trim();
}

class MonsterOverlayRenderer {
  private readonly viewport: HTMLDivElement;
  private currentNotification: HTMLElement | null = null;
  private removeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly documentRef: Document, private readonly assetUrl: string) {
    this.viewport = this.ensureOverlayElements();
  }

  show(notification: OverlayNotification): void {
    if (this.removeTimer !== null) {
      clearTimeout(this.removeTimer);
      this.removeTimer = null;
    }

    if (this.currentNotification) {
      this.currentNotification.remove();
      this.currentNotification = null;
    }

    const template = this.documentRef.createElement("template");
    template.innerHTML = createOverlayMarkup(notification, this.assetUrl);
    const nextNotification = template.content.firstElementChild;
    if (!(nextNotification instanceof HTMLElement)) {
      return;
    }

    this.viewport.append(nextNotification);
    this.currentNotification = nextNotification;

    requestAnimationFrame(() => {
      nextNotification.classList.add("is-visible");
    });
  }

  hide(): void {
    const target = this.currentNotification;
    if (!target) {
      return;
    }

    target.classList.remove("is-visible");
    target.classList.add("is-hiding");
    this.currentNotification = null;

    this.removeTimer = setTimeout(() => {
      target.remove();
      this.removeTimer = null;
    }, MONSTER_OVERLAY_EXIT_MS);
  }

  private ensureOverlayElements(): HTMLDivElement {
    let host = this.documentRef.getElementById(MONSTER_OVERLAY_ROOT_ID) as HTMLDivElement | null;

    if (!host) {
      host = this.documentRef.createElement("div");
      host.id = MONSTER_OVERLAY_ROOT_ID;
      this.documentRef.body.append(host);
    }

    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.right = "20px";
    host.style.bottom = "20px";
    host.style.zIndex = "999999";
    host.style.pointerEvents = "none";
    host.style.width = "min(320px, calc(100vw - 32px))";

    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });

    if (!shadowRoot.querySelector("style")) {
      const style = this.documentRef.createElement("style");
      style.textContent = MONSTER_OVERLAY_STYLE_TEXT;
      shadowRoot.append(style);
    }

    let viewport = shadowRoot.querySelector(".monster-overlay-viewport") as HTMLDivElement | null;
    if (!viewport) {
      viewport = this.documentRef.createElement("div");
      viewport.className = "monster-overlay-viewport";
      shadowRoot.append(viewport);
    }

    return viewport;
  }
}

class MonsterOverlayScheduler {
  private siteKey: string | null = null;
  private siteType: DomainType = "neutral";
  private repeatTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private activeKind: OverlayNotificationKind | null = null;

  constructor(private readonly callbacks: OverlaySchedulerCallbacks) {}

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
      this.scheduleNext("negative", OVERLAY_REPEAT_MS);
      return;
    }

    this.scheduleNext("positive", OVERLAY_REPEAT_MS);
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
      this.scheduleNext(kind, OVERLAY_REPEAT_MS);
    }, Math.max(0, delayMs));
  }

  private emit(kind: OverlayNotificationKind): void {
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
    }, OVERLAY_DISPLAY_MS);
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

function waitForBody(): Promise<HTMLBodyElement> {
  if (document.body) {
    return Promise.resolve(document.body as HTMLBodyElement);
  }

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        resolve(document.body as HTMLBodyElement);
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

async function getDomainLists(): Promise<DomainLists> {
  const storage = (await chrome.storage.local.get([
    STORAGE_KEYS.goodDomains,
    STORAGE_KEYS.badDomains
  ])) as Record<string, unknown>;

  return {
    good: (storage[STORAGE_KEYS.goodDomains] as string[] | undefined) ?? createEmptyDomainLists().good,
    bad: (storage[STORAGE_KEYS.badDomains] as string[] | undefined) ?? createEmptyDomainLists().bad
  };
}

async function resolveOverlayContext(): Promise<{ siteKey: string | null; siteType: DomainType }> {
  if (document.hidden || !document.hasFocus()) {
    return { siteKey: null, siteType: "neutral" };
  }

  const currentUrl = window.location.href;
  if (shouldPreserveTrackingForUrl(currentUrl)) {
    return { siteKey: null, siteType: "neutral" };
  }

  const siteKey = extractDomain(currentUrl);
  if (!siteKey) {
    return { siteKey: null, siteType: "neutral" };
  }

  const domainLists = await getDomainLists();
  return {
    siteKey,
    siteType: classifyDomain(siteKey, domainLists)
  };
}

async function bootstrapOverlay(): Promise<void> {
  await waitForBody();

  const renderer = new MonsterOverlayRenderer(document, chrome.runtime.getURL("assets/monster-overlay.png"));
  const scheduler = new MonsterOverlayScheduler({
    show: (notification) => renderer.show(notification),
    hide: () => renderer.hide()
  });

  let lastHref = window.location.href;
  let refreshToken = 0;

  async function syncOverlayState(): Promise<void> {
    const token = ++refreshToken;
    const nextContext = await resolveOverlayContext();
    if (token !== refreshToken) {
      return;
    }

    scheduler.updateContext(nextContext.siteKey, nextContext.siteType);
  }

  const locationPoll = window.setInterval(() => {
    const nextHref = window.location.href;
    if (nextHref === lastHref) {
      return;
    }

    lastHref = nextHref;
    void syncOverlayState();
  }, LOCATION_POLL_MS);

  const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName !== "local") {
      return;
    }

    if (changes[STORAGE_KEYS.goodDomains] || changes[STORAGE_KEYS.badDomains]) {
      void syncOverlayState();
    }
  };

  window.addEventListener("focus", () => {
    void syncOverlayState();
  });

  window.addEventListener("blur", () => {
    void syncOverlayState();
  });

  window.addEventListener("hashchange", () => {
    lastHref = window.location.href;
    void syncOverlayState();
  });

  window.addEventListener("popstate", () => {
    lastHref = window.location.href;
    void syncOverlayState();
  });

  document.addEventListener("visibilitychange", () => {
    void syncOverlayState();
  });

  chrome.storage.onChanged.addListener(handleStorageChange);

  window.addEventListener(
    "pagehide",
    () => {
      window.clearInterval(locationPoll);
      chrome.storage.onChanged.removeListener(handleStorageChange);
      scheduler.dispose();
    },
    { once: true }
  );

  await syncOverlayState();
}

void bootstrapOverlay();
