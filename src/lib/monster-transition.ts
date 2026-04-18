export type MonsterTransitionKind = "none" | "stage" | "state";
export type MonsterTransitionMode = "full" | "reduced";

export type MonsterTransitionSnapshot = {
  stage: number;
  mood: string;
  imageSrc: string;
  alt: string;
};

export type RenderMonsterTransitionOptions = {
  host: HTMLElement;
  imageClassName: string;
  next: MonsterTransitionSnapshot;
  previous?: MonsterTransitionSnapshot | null;
  reducedMotion?: boolean;
};

const TRANSITION_DURATION_MS = 360;
const cleanupTimers = new WeakMap<HTMLElement, number>();

export function resolveMonsterTransitionKind(
  previous: MonsterTransitionSnapshot | null | undefined,
  next: MonsterTransitionSnapshot
): MonsterTransitionKind {
  if (!previous) {
    return "none";
  }

  if (previous.mood === "dead" || next.mood === "dead") {
    return previous.imageSrc !== next.imageSrc || previous.stage !== next.stage || previous.mood !== next.mood
      ? "state"
      : "none";
  }

  if (previous.stage !== next.stage) {
    return "stage";
  }

  if (previous.imageSrc !== next.imageSrc || previous.mood !== next.mood) {
    return "state";
  }

  return "none";
}

export function resolveMonsterTransitionMode(prefersReducedMotion: boolean): MonsterTransitionMode {
  return prefersReducedMotion ? "reduced" : "full";
}

export function getPrefersReducedMotion(view: Window | null | undefined): boolean {
  try {
    return Boolean(view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}

function clearCleanupTimer(host: HTMLElement): void {
  const timer = cleanupTimers.get(host);
  if (timer !== undefined) {
    clearTimeout(timer);
    cleanupTimers.delete(host);
  }
}

function createImageLayer(
  documentRef: Document,
  imageClassName: string,
  snapshot: MonsterTransitionSnapshot,
  extraClassName?: string
): HTMLImageElement {
  const image = documentRef.createElement("img");
  image.className = extraClassName ? `monster-transition__layer ${imageClassName} ${extraClassName}` : `monster-transition__layer ${imageClassName}`;
  image.src = snapshot.imageSrc;
  image.alt = snapshot.alt;
  image.decoding = "async";
  image.draggable = false;
  return image;
}

export function renderMonsterTransition({
  host,
  imageClassName,
  next,
  previous = null,
  reducedMotion
}: RenderMonsterTransitionOptions): MonsterTransitionKind {
  clearCleanupTimer(host);

  const documentRef = host.ownerDocument;
  const viewport = documentRef.createElement("span");
  viewport.className = "monster-transition__viewport";

  const transitionKind = resolveMonsterTransitionKind(previous, next);
  const transitionMode = resolveMonsterTransitionMode(
    reducedMotion ?? getPrefersReducedMotion(documentRef.defaultView)
  );

  host.classList.add("monster-transition-host");
  host.replaceChildren(viewport);
  host.dataset.transitionKind = transitionKind;
  host.dataset.transitionMode = transitionMode;

  const nextImage = createImageLayer(documentRef, imageClassName, next);
  viewport.append(nextImage);

  if (transitionKind === "none" || transitionMode === "reduced" || !previous) {
    return transitionKind;
  }

  const previousImage = createImageLayer(documentRef, imageClassName, previous);
  const glow = documentRef.createElement("span");

  if (transitionKind === "stage") {
    previousImage.classList.add("monster-transition__layer--stage-exit");
    nextImage.classList.add("monster-transition__layer--stage-enter");
    glow.className = "monster-transition__glow monster-transition__glow--stage";
    viewport.append(previousImage, glow, nextImage);
  } else {
    previousImage.classList.add("monster-transition__layer--state-exit");
    nextImage.classList.add("monster-transition__layer--state-enter");
    viewport.append(previousImage, nextImage);
  }

  const timer = window.setTimeout(() => {
    if (!host.isConnected) {
      cleanupTimers.delete(host);
      return;
    }

    host.replaceChildren(viewport);
    viewport.replaceChildren(nextImage);
    cleanupTimers.delete(host);
  }, TRANSITION_DURATION_MS);

  cleanupTimers.set(host, timer);
  return transitionKind;
}
