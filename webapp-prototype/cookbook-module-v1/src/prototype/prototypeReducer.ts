import type {
  CookbookSnapshot,
  MediaAsset,
  NewStepMediaLink,
  RecipeIdentity,
  StepMediaLink,
} from "../domain/cookbook/types";
import {
  attachMedia,
  markStepMeaningChanged,
  reorderStepMedia,
} from "../domain/media/stepMedia";

export type PrototypeAction =
  | { type: "set-recipe-note"; recipeId: RecipeIdentity; note: string }
  | { type: "add-session-media"; asset: MediaAsset; link: StepMediaLink }
  | { type: "replace-step-media"; stepId: string; links: StepMediaLink[] }
  | { type: "attach-existing-media"; link: NewStepMediaLink }
  | { type: "reorder-step-media"; stepId: string; mediaIds: string[] }
  | { type: "mark-step-meaning-changed"; stepId: string }
  | { type: "replace-snapshot"; snapshot: CookbookSnapshot }
  | { type: "reset-session" };

export interface PrototypeState {
  initialSnapshot: CookbookSnapshot;
  snapshot: CookbookSnapshot;
  dirty: boolean;
  persistence: "session";
}

export class UnknownRecipeIdentityError extends Error {
  readonly recipeId: RecipeIdentity;

  constructor(recipeId: RecipeIdentity) {
    super(`Unknown recipe identity (${typeof recipeId}): ${String(recipeId)}`);
    this.name = "UnknownRecipeIdentityError";
    this.recipeId = recipeId;
  }
}

export class InvalidPrototypeRecipeIdentityError extends Error {
  constructor() {
    super("Recipe identity must be a finite number or a meaningful string");
    this.name = "InvalidPrototypeRecipeIdentityError";
  }
}

export class InvalidRecipeNoteError extends Error {
  constructor() {
    super("Recipe note must be a meaningful string");
    this.name = "InvalidRecipeNoteError";
  }
}

export class UnknownPrototypeActionError extends Error {
  constructor(actionType: unknown) {
    super(`Unknown prototype action: ${String(actionType)}`);
    this.name = "UnknownPrototypeActionError";
  }
}

export class InvalidSessionMediaIdentityError extends Error {
  constructor(field: "mediaId" | "stepId") {
    super(`${field} must be a meaningful string`);
    this.name = "InvalidSessionMediaIdentityError";
  }
}

export class DuplicateMediaAssetError extends Error {
  constructor(mediaId: string) {
    super(`Media asset already exists: ${mediaId}`);
    this.name = "DuplicateMediaAssetError";
  }
}

export class MediaAssetLinkMismatchError extends Error {
  constructor() {
    super("Media asset and step link must use the same mediaId");
    this.name = "MediaAssetLinkMismatchError";
  }
}

export class UnknownWorkStepError extends Error {
  constructor(stepId: string) {
    super(`Unknown work step: ${stepId}`);
    this.name = "UnknownWorkStepError";
  }
}

export class UnknownMediaAssetError extends Error {
  constructor(mediaId: string) {
    super(`Unknown media asset: ${mediaId}`);
    this.name = "UnknownMediaAssetError";
  }
}

export class StepMediaTargetMismatchError extends Error {
  constructor(stepId: string) {
    super(`Every replacement media link must match stepId: ${stepId}`);
    this.name = "StepMediaTargetMismatchError";
  }
}

export class DuplicateStepMediaLinkError extends Error {
  constructor(stepId: string, mediaId: string) {
    super(`Duplicate step/media link: ${stepId} / ${mediaId}`);
    this.name = "DuplicateStepMediaLinkError";
  }
}

export class InvalidSessionMediaLinkError extends Error {
  constructor(index: number) {
    super(`Step media link at index ${index} must be an object with valid identities`);
    this.name = "InvalidSessionMediaLinkError";
  }
}

export class InvalidReplacementSnapshotError extends Error {
  readonly field: string;

  constructor(field: string) {
    super(`Replacement snapshot has an invalid ${field} container or value`);
    this.name = "InvalidReplacementSnapshotError";
    this.field = field;
  }
}

const INVISIBLE_OR_WHITESPACE = /[\s\p{Cf}]/gu;

function isMeaningfulString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.replace(INVISIBLE_OR_WHITESPACE, "").length > 0
  );
}

function isRecipeIdentity(value: unknown): value is RecipeIdentity {
  return (
    (typeof value === "number" && Number.isFinite(value)) ||
    isMeaningfulString(value)
  );
}

function validateMediaIdentity(
  value: unknown,
  field: "mediaId" | "stepId",
): asserts value is string {
  if (!isMeaningfulString(value)) {
    throw new InvalidSessionMediaIdentityError(field);
  }
}

function validateStepMediaLinks(value: unknown): asserts value is StepMediaLink[] {
  if (!Array.isArray(value)) throw new InvalidSessionMediaLinkError(-1);
  value.forEach((link, index) => {
    if (typeof link !== "object" || link === null || Array.isArray(link)) {
      throw new InvalidSessionMediaLinkError(index);
    }
    const candidate = link as Record<string, unknown>;
    validateMediaIdentity(candidate.stepId, "stepId");
    validateMediaIdentity(candidate.mediaId, "mediaId");
  });
}

function validateReplacementSnapshot(
  value: unknown,
): asserts value is CookbookSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidReplacementSnapshotError("snapshot");
  }
  const snapshot = value as Record<string, unknown>;
  for (const field of ["recipes", "media", "stepMedia"] as const) {
    if (!Array.isArray(snapshot[field])) {
      throw new InvalidReplacementSnapshotError(field);
    }
  }
  const recipes = snapshot.recipes as unknown[];
  const mediaAssets = snapshot.media as unknown[];
  for (const [index, recipe] of recipes.entries()) {
    if (
      typeof recipe !== "object" ||
      recipe === null ||
      Array.isArray(recipe) ||
      typeof (recipe as Record<string, unknown>).workDocuments !== "object" ||
      (recipe as Record<string, unknown>).workDocuments === null ||
      Array.isArray((recipe as Record<string, unknown>).workDocuments)
    ) {
      throw new InvalidReplacementSnapshotError(`recipes[${index}]`);
    }
  }
  for (const [index, media] of mediaAssets.entries()) {
    if (typeof media !== "object" || media === null || Array.isArray(media)) {
      throw new InvalidReplacementSnapshotError(`media[${index}]`);
    }
    const asset = media as Record<string, unknown>;
    if (
      !isMeaningfulString(asset.mediaId) ||
      !isMeaningfulString(asset.url) ||
      typeof asset.localSessionOnly !== "boolean"
    ) {
      throw new InvalidReplacementSnapshotError(`media[${index}]`);
    }
  }
  try {
    validateStepMediaLinks(snapshot.stepMedia);
  } catch {
    throw new InvalidReplacementSnapshotError("stepMedia");
  }
}

function snapshotHasStep(snapshot: CookbookSnapshot, stepId: string): boolean {
  return snapshot.recipes.some((recipe) =>
    Object.values(recipe.workDocuments).some((document) =>
      document?.steps.some((step) => step.stepId === stepId),
    ),
  );
}

function findDuplicateLink(
  links: StepMediaLink[],
): StepMediaLink | undefined {
  return links.find((link, index) =>
    links
      .slice(0, index)
      .some(
        (earlier) =>
          earlier.stepId === link.stepId && earlier.mediaId === link.mediaId,
      ),
  );
}

function cloneSnapshot(snapshot: CookbookSnapshot): CookbookSnapshot {
  return structuredClone(snapshot);
}

export function createPrototypeState(
  snapshot: CookbookSnapshot,
): PrototypeState {
  return {
    initialSnapshot: cloneSnapshot(snapshot),
    snapshot: cloneSnapshot(snapshot),
    dirty: false,
    persistence: "session",
  };
}

export function prototypeReducer(
  state: PrototypeState,
  action: PrototypeAction,
): PrototypeState {
  switch (action.type) {
    case "set-recipe-note": {
      if (!isRecipeIdentity(action.recipeId)) {
        throw new InvalidPrototypeRecipeIdentityError();
      }
      if (!isMeaningfulString(action.note)) {
        throw new InvalidRecipeNoteError();
      }
      const recipeIndex = state.snapshot.recipes.findIndex(
        (recipe) => recipe.recipeId === action.recipeId,
      );
      if (recipeIndex === -1) {
        throw new UnknownRecipeIdentityError(action.recipeId);
      }

      return {
        ...state,
        snapshot: {
          ...state.snapshot,
          recipes: state.snapshot.recipes.map((recipe, index) =>
            index === recipeIndex
              ? { ...recipe, operationalNotes: [action.note] }
              : recipe,
          ),
        },
        dirty: true,
      };
    }

    case "add-session-media": {
      validateStepMediaLinks(state.snapshot.stepMedia);
      validateMediaIdentity(action.asset.mediaId, "mediaId");
      validateMediaIdentity(action.link.mediaId, "mediaId");
      validateMediaIdentity(action.link.stepId, "stepId");
      if (action.asset.mediaId !== action.link.mediaId) {
        throw new MediaAssetLinkMismatchError();
      }
      if (
        state.snapshot.media.some(
          (asset) => asset.mediaId === action.asset.mediaId,
        )
      ) {
        throw new DuplicateMediaAssetError(action.asset.mediaId);
      }
      if (!snapshotHasStep(state.snapshot, action.link.stepId)) {
        throw new UnknownWorkStepError(action.link.stepId);
      }
      if (
        state.snapshot.stepMedia.some(
          (link) =>
            link.stepId === action.link.stepId &&
            link.mediaId === action.link.mediaId,
        )
      ) {
        throw new DuplicateStepMediaLinkError(
          action.link.stepId,
          action.link.mediaId,
        );
      }
      return {
        ...state,
        snapshot: {
          ...state.snapshot,
          media: [...state.snapshot.media, structuredClone(action.asset)],
          stepMedia: [
            ...state.snapshot.stepMedia,
            structuredClone(action.link),
          ],
        },
        dirty: true,
      };
    }

    case "replace-step-media": {
      validateStepMediaLinks(state.snapshot.stepMedia);
      validateStepMediaLinks(action.links);
      validateMediaIdentity(action.stepId, "stepId");
      if (!snapshotHasStep(state.snapshot, action.stepId)) {
        throw new UnknownWorkStepError(action.stepId);
      }
      if (action.links.some((link) => link.stepId !== action.stepId)) {
        throw new StepMediaTargetMismatchError(action.stepId);
      }
      const knownMediaIds = new Set(
        state.snapshot.media.map((asset) => asset.mediaId),
      );
      const unknownLink = action.links.find(
        (link) => !knownMediaIds.has(link.mediaId),
      );
      if (unknownLink !== undefined) {
        throw new UnknownMediaAssetError(unknownLink.mediaId);
      }
      const finalLinks = [
        ...state.snapshot.stepMedia.filter(
          (link) => link.stepId !== action.stepId,
        ),
        ...action.links,
      ];
      const duplicateLink = findDuplicateLink(finalLinks);
      if (duplicateLink !== undefined) {
        throw new DuplicateStepMediaLinkError(
          duplicateLink.stepId,
          duplicateLink.mediaId,
        );
      }
      return {
        ...state,
        snapshot: {
          ...state.snapshot,
          stepMedia: structuredClone(finalLinks),
        },
        dirty: true,
      };
    }

    case "attach-existing-media":
      return {
        ...state,
        snapshot: attachMedia(state.snapshot, action.link),
        dirty: true,
      };

    case "reorder-step-media":
      return {
        ...state,
        snapshot: reorderStepMedia(state.snapshot, action.stepId, action.mediaIds),
        dirty: true,
      };

    case "mark-step-meaning-changed":
      return {
        ...state,
        snapshot: markStepMeaningChanged(state.snapshot, action.stepId),
        dirty: true,
      };

    case "replace-snapshot":
      validateReplacementSnapshot(action.snapshot);
      return {
        ...state,
        snapshot: cloneSnapshot(action.snapshot),
        dirty: true,
      };

    case "reset-session":
      return {
        ...state,
        snapshot: cloneSnapshot(state.initialSnapshot),
        dirty: false,
      };

    default:
      throw new UnknownPrototypeActionError(
        (action as { type?: unknown }).type,
      );
  }
}
