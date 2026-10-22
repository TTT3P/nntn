import { useRef, useState, type ChangeEvent } from "react";
import type {
  CookbookSnapshot,
  MediaAsset,
  MediaRole,
  StepMediaLink,
  Vessel,
} from "../../domain/cookbook/types";
import {
  attachMedia,
  DuplicateMediaAssetIdError,
  reorderStepMedia,
  StepMediaOrderOverflowError,
  UnknownMediaAssetError,
} from "../../domain/media/stepMedia";
import { usePrototype } from "../../prototype/PrototypeProvider";
import {
  createPrototypeState,
  prototypeReducer,
  type PrototypeAction,
} from "../../prototype/prototypeReducer";
import { resolveSampleMediaUrl } from "./sampleMediaUrl";

const ROLE_OPTIONS: Array<{ value: MediaRole; label: string }> = [
  { value: "before", label: "ก่อนทำ" },
  { value: "during", label: "ระหว่างทำ" },
  { value: "checkpoint", label: "จุดตรวจ" },
  { value: "final", label: "เสร็จแล้ว" },
];

const VESSEL_OPTIONS: Array<{ value: Vessel; label: string }> = [
  { value: "plate", label: "จาน" },
  { value: "delivery_box", label: "กล่องเดลิเวอรี" },
  { value: "cup_1oz", label: "ถ้วย 1 oz" },
];

let sessionMediaSequence = 0;

class UnsafeMediaUrlError extends Error {
  constructor(mediaId: string) {
    super(`Media URL is not an approved local or session object URL: ${mediaId}`);
    this.name = "UnsafeMediaUrlError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
}

function nextSessionMediaId(snapshot: CookbookSnapshot): string {
  const existing = new Set(snapshot.media.map((asset) => asset.mediaId));
  let candidate: string;
  do {
    sessionMediaSequence += 1;
    candidate = `session-media-${sessionMediaSequence}`;
  } while (existing.has(candidate));
  return candidate;
}

function targetLinks(snapshot: CookbookSnapshot, stepId: string): StepMediaLink[] {
  const links = snapshot.stepMedia
    .filter((link) => link.stepId === stepId)
    .sort((left, right) => left.order - right.order);
  reorderStepMedia(snapshot, stepId, links.map((link) => link.mediaId));
  return links;
}

function labelForStep(snapshot: CookbookSnapshot, stepId: string): string {
  const step = snapshot.recipes
    .flatMap((recipe) => Object.values(recipe.workDocuments))
    .flatMap((document) => document?.steps ?? [])
    .find((candidate) => candidate.stepId === stepId);
  if (step === undefined || typeof step.instruction !== "string") {
    const error = new Error(`Invalid editor step instruction: ${stepId}`);
    error.name = "InvalidStepMediaEditorFieldError";
    throw error;
  }
  return step.instruction;
}

function validateLibraryAssets(snapshot: CookbookSnapshot, stepId: string): void {
  const mediaIds = new Set<string>();
  for (const asset of snapshot.media) {
    if (mediaIds.has(asset.mediaId)) {
      throw new DuplicateMediaAssetIdError(asset.mediaId);
    }
    mediaIds.add(asset.mediaId);
    attachMedia(
      { ...snapshot, media: [asset], stepMedia: [] },
      { stepId, mediaId: asset.mediaId, role: "during", vessel: null },
    );
  }
}

function validateReducerMetadataContract(
  snapshot: CookbookSnapshot,
  stepId: string,
  links: StepMediaLink[],
): void {
  prototypeReducer(createPrototypeState(snapshot), {
    type: "replace-step-media",
    stepId,
    links,
  });
}

function validateRenderableUrls(
  snapshot: CookbookSnapshot,
  isSessionObjectUrl: (url: string) => boolean,
): Map<string, string> {
  const renderedUrls = new Map<string, string>();
  for (const asset of snapshot.media) {
    const localUrl = resolveSampleMediaUrl(asset.url);
    const isOwnedObjectUrl =
      asset.url.startsWith("blob:") && isSessionObjectUrl(asset.url);
    if (localUrl === null && !isOwnedObjectUrl) {
      throw new UnsafeMediaUrlError(asset.mediaId);
    }
    renderedUrls.set(asset.mediaId, localUrl ?? asset.url);
  }
  return renderedUrls;
}

function assetFor(snapshot: CookbookSnapshot, mediaId: string): MediaAsset {
  const asset = snapshot.media.find((candidate) => candidate.mediaId === mediaId);
  if (asset === undefined) throw new UnknownMediaAssetError(mediaId);
  return asset;
}

function replaceAsset(snapshot: CookbookSnapshot, asset: MediaAsset): CookbookSnapshot {
  return {
    ...snapshot,
    media: snapshot.media.map((candidate) =>
      candidate.mediaId === asset.mediaId ? asset : candidate,
    ),
  };
}

function replaceTargetLink(
  links: StepMediaLink[],
  mediaId: string,
  change: Partial<Pick<StepMediaLink, "role" | "vessel">>,
): StepMediaLink[] {
  return links.map((link) =>
    link.mediaId === mediaId ? { ...link, ...change } : link,
  );
}

export function StepMediaEditor({
  stepId,
}: {
  stepId: string;
}) {
  const {
    snapshot,
    dispatch,
    createSessionObjectUrl,
    releaseSessionObjectUrl,
    isSessionObjectUrl,
  } = usePrototype();
  const [search, setSearch] = useState("");
  const [operationError, setOperationError] = useState<string | null>(null);
  const createdMediaId = useRef<string | null>(null);

  let links: StepMediaLink[];
  let linkedAssets: MediaAsset[];
  let renderedUrls: Map<string, string>;
  let stepLabel: string;
  try {
    validateLibraryAssets(snapshot, stepId);
    validateReducerMetadataContract(snapshot, stepId, []);
    links = targetLinks(snapshot, stepId);
    validateReducerMetadataContract(snapshot, stepId, links);
    renderedUrls = validateRenderableUrls(snapshot, isSessionObjectUrl);
    stepLabel = labelForStep(snapshot, stepId);
    linkedAssets = links.map((link) => assetFor(snapshot, link.mediaId));
  } catch (error) {
    return (
      <section role="alert" aria-labelledby={`step-media-error-${stepId}`}>
        <h5 id={`step-media-error-${stepId}`}>แก้ไขรูปขั้นตอนไม่ได้</h5>
        <p>{errorMessage(error)}</p>
      </section>
    );
  }

  const linkedIds = new Set(links.map((link) => link.mediaId));
  const query = search.trim().toLocaleLowerCase("th");
  const reusableAssets = snapshot.media
    .filter((asset) => !linkedIds.has(asset.mediaId))
    .filter((asset) => {
      if (query.length === 0) return true;
      return [asset.caption, asset.altText, asset.mediaId].some((value) =>
        value.toLocaleLowerCase("th").includes(query),
      );
    })
    .sort((left, right) => left.caption.localeCompare(right.caption, "th"));

  function reportOperationError(error: unknown) {
    setOperationError(errorMessage(error));
  }

  function dispatchOrThrow(action: PrototypeAction): void {
    const result = dispatch(action);
    if (!result.ok) throw result.error;
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file === undefined) return;

    let url: string;
    try {
      url = createSessionObjectUrl(file);
    } catch (error) {
      reportOperationError(error);
      return;
    }

    let previousMediaId = createdMediaId.current;
    if (
      previousMediaId !== null &&
      !snapshot.media.some(
        (asset) =>
          asset.mediaId === previousMediaId &&
          asset.localSessionOnly &&
          isSessionObjectUrl(asset.url),
      )
    ) {
      createdMediaId.current = null;
      previousMediaId = null;
    }
    try {
      if (previousMediaId === null) {
        const mediaId = nextSessionMediaId(snapshot);
        const maximumOrder = links.reduce(
          (maximum, link) => Math.max(maximum, link.order),
          0,
        );
        if (maximumOrder === Number.MAX_SAFE_INTEGER) {
          throw new StepMediaOrderOverflowError(stepId, maximumOrder);
        }
        dispatchOrThrow({
          type: "add-session-media",
          asset: {
            mediaId,
            url,
            caption: file.name,
            altText: `ตัวอย่าง ${file.name}`,
            source: null,
            capturedAt: null,
            author: null,
            reviewState: "unreviewed",
            localSessionOnly: true,
            crop: null,
            focalPoint: null,
            measurementAnnotation: null,
          },
          link: {
            stepId,
            mediaId,
            order: maximumOrder + 1,
            role: "during",
            vessel: null,
            reviewNeeded: false,
          },
        });
        createdMediaId.current = mediaId;
      } else {
        const currentAsset = assetFor(snapshot, previousMediaId);
        dispatchOrThrow({
          type: "replace-snapshot",
          snapshot: replaceAsset(snapshot, {
            ...currentAsset,
            url,
            caption: file.name,
            altText: `ตัวอย่าง ${file.name}`,
            localSessionOnly: true,
          }),
        });
      }
      setOperationError(null);
    } catch (error) {
      releaseSessionObjectUrl(url);
      reportOperationError(error);
    }
  }

  function updateCaption(asset: MediaAsset, caption: string) {
    try {
      dispatchOrThrow({
        type: "replace-snapshot",
        snapshot: replaceAsset(snapshot, { ...asset, caption }),
      });
      setOperationError(null);
    } catch (error) {
      reportOperationError(error);
    }
  }

  function updateLink(
    mediaId: string,
    change: Partial<Pick<StepMediaLink, "role" | "vessel">>,
  ) {
    try {
      dispatchOrThrow({
        type: "replace-step-media",
        stepId,
        links: replaceTargetLink(links, mediaId, change),
      });
      setOperationError(null);
    } catch (error) {
      reportOperationError(error);
    }
  }

  function attachExisting(asset: MediaAsset) {
    try {
      dispatchOrThrow({
        type: "attach-existing-media",
        link: { stepId, mediaId: asset.mediaId, role: "during", vessel: null },
      });
      setSearch("");
      setOperationError(null);
    } catch (error) {
      reportOperationError(error);
    }
  }

  function move(mediaId: string, offset: -1 | 1) {
    const currentIndex = links.findIndex((link) => link.mediaId === mediaId);
    const nextIndex = currentIndex + offset;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= links.length) return;
    const mediaIds = links.map((link) => link.mediaId);
    [mediaIds[currentIndex], mediaIds[nextIndex]] = [
      mediaIds[nextIndex]!,
      mediaIds[currentIndex]!,
    ];
    try {
      dispatchOrThrow({ type: "reorder-step-media", stepId, mediaIds });
      setOperationError(null);
    } catch (error) {
      reportOperationError(error);
    }
  }

  return (
    <fieldset className="step-media-editor">
      <legend>รูปของขั้นตอน {stepLabel}</legend>
      <label>
        เลือกรูป
        <input type="file" accept="image/*" onChange={handleFileSelection} />
      </label>
      {operationError !== null && <p role="alert">{operationError}</p>}
      {links.length === 0 ? (
        <p>เพิ่มรูปภายหลัง</p>
      ) : (
        <ul aria-label="รูปที่ผูกกับขั้นตอน">
          {links.map((link, index) => {
            const asset = linkedAssets[index]!;
            return (
              <li key={link.mediaId}>
                <img src={renderedUrls.get(asset.mediaId)} alt={asset.altText} />
                {asset.localSessionOnly && (
                  <p>รูปนี้อยู่เฉพาะ session และจะหายเมื่อ reload</p>
                )}
                {asset.reviewState === "sample" && <p>DEMO — ไม่ใช่หลักฐานที่ยืนยันแล้ว</p>}
                {link.reviewNeeded && <p>รูปควรตรวจใหม่</p>}
                <label>
                  คำบรรยายรูป
                  <input
                    value={asset.caption}
                    onChange={(event) => updateCaption(asset, event.target.value)}
                  />
                </label>
                <label>
                  ชนิดรูป
                  <select
                    value={link.role}
                    onChange={(event) => updateLink(link.mediaId, { role: event.target.value as MediaRole })}
                  >
                    {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  ภาชนะ
                  <select
                    value={link.vessel ?? ""}
                    onChange={(event) => updateLink(link.mediaId, { vessel: event.target.value === "" ? null : event.target.value as Vessel })}
                  >
                    <option value="">ไม่ระบุ</option>
                    {VESSEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  aria-label={`เลื่อน${asset.altText} ก่อนหน้า`}
                  disabled={index === 0}
                  onClick={() => move(link.mediaId, -1)}
                >
                  Move Earlier
                </button>
                <button
                  type="button"
                  aria-label={`เลื่อน${asset.altText} ถัดไป`}
                  disabled={index === links.length - 1}
                  onClick={() => move(link.mediaId, 1)}
                >
                  Move Later
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <section aria-label="ใช้รูปที่มีอยู่">
        <label>
          เลือกจากคลังรูป
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        {snapshot.media.length === 0 ? (
          <p>คลังรูปยังว่าง</p>
        ) : reusableAssets.length === 0 ? (
          <p>{query.length > 0 ? "ไม่พบรูปที่ค้นหา" : "ไม่มีรูปอื่นในคลัง"}</p>
        ) : (
          <ul>
            {reusableAssets.map((asset) => (
              <li key={asset.mediaId}>
                <button type="button" onClick={() => attachExisting(asset)}>
                  ใช้รูป {asset.caption}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </fieldset>
  );
}
