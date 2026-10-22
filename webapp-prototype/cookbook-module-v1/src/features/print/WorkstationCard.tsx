import type {
  IngredientLine,
  MediaAsset,
  RecipeIdentity,
  StepMediaLink,
  Vessel,
  WorkStage,
} from "../../domain/cookbook/types";
import type { MediaIndex, WorkstationPage } from "../../domain/print/printPlanner";
import { resolveSampleMediaUrl } from "../media/sampleMediaUrl";

const STAGE_LABELS: Record<WorkStage, string> = {
  prep: "ผลิตซอสและของเตรียม",
  cook: "ครัวปรุง / BOM",
  service: "จัดเสิร์ฟหน้าร้าน",
};

const ROLE_LABELS: Record<StepMediaLink["role"], string> = {
  before: "ก่อนทำ",
  during: "ระหว่างทำ",
  checkpoint: "จุดตรวจ",
  final: "เสร็จแล้ว",
};

const VESSEL_LABELS: Record<Vessel, string> = {
  plate: "จาน",
  delivery_box: "กล่องเดลิเวอรี",
  cup_1oz: "ถ้วย 1 oz",
};

function sourceFact(line: IngredientLine): string {
  if (line.sourceText !== null) return line.sourceText;
  if (line.sourceValue !== null && line.sourceUnit !== null) {
    return `${String(line.sourceValue)} ${line.sourceUnit}`;
  }
  if (line.sourceValue !== null) return String(line.sourceValue);
  if (line.sourceUnit !== null) return line.sourceUnit;
  return "ยังไม่ระบุ";
}

function mediaForStep(
  media: MediaIndex,
  stepId: string,
): Array<{ asset: MediaAsset; link: StepMediaLink; renderedUrl: string }> {
  return (media.linksByStepId.get(stepId) ?? []).flatMap((link) => {
    const asset = media.assetsById.get(link.mediaId);
    if (asset === undefined) return [];
    const renderedUrl = resolveSampleMediaUrl(asset.url);
    return renderedUrl === null ? [] : [{ asset, link, renderedUrl }];
  });
}

function mediaKey(link: StepMediaLink): string {
  return `${JSON.stringify(link.stepId)}:${JSON.stringify(link.mediaId)}:${String(link.order)}`;
}

export function WorkstationCard({
  page,
  media,
  previewMode,
  readiness,
  componentLabelFor,
}: {
  page: WorkstationPage;
  media: MediaIndex;
  previewMode: "draft" | "approved";
  readiness: "draft" | "ready";
  componentLabelFor?: (componentRecipeId: RecipeIdentity) => string | null;
}) {
  const stepsById = new Map(page.document.steps.map((step) => [step.stepId, step]));
  const hasMissingMedia = page.blocks.some(
    (block) => mediaForStep(media, block.stepId).length === 0,
  );
  const hasSampleMedia = page.blocks.some((block) =>
    mediaForStep(media, block.stepId).some(({ asset }) => asset.reviewState === "sample"),
  );
  const hasReviewNeededMedia = page.blocks.some((block) =>
    mediaForStep(media, block.stepId).some(({ link }) => link.reviewNeeded),
  );

  return (
    <article
      className="workstation-card"
      aria-label={`${page.document.recipeName} · ${STAGE_LABELS[page.document.stage]} · ส่วน ${page.partNumber} จาก ${page.totalParts}`}
    >
      <header className="workstation-card__header">
        <div>
          <p className="workstation-card__stage">{STAGE_LABELS[page.document.stage]}</p>
          <h3>{page.document.recipeName}</h3>
        </div>
        <div className="workstation-card__status">
          <p>{previewMode === "approved" ? "พร้อมพิมพ์" : "ตรวจทานก่อนพิมพ์"}</p>
          <p>{readiness === "ready" ? "สถานะสูตร: พร้อมใช้" : "สถานะสูตร: ข้อมูลยังไม่ครบ"}</p>
          <p>
            {page.document.stage === "service"
              ? "ตัวคูณ 1 · ต่อหนึ่งเสิร์ฟ"
              : `ตัวคูณ ${String(page.document.multiplier)}`}
          </p>
          {page.totalParts > 1 && <p>ส่วน {page.partNumber} / {page.totalParts}</p>}
        </div>
      </header>

      <div
        className={page.blocks.length === 0
          ? "workstation-card__body workstation-card__body--without-steps"
          : "workstation-card__body"}
      >
        {(page.document.operationalNotes.length > 0 ||
          page.document.yieldText !== null ||
          page.document.methodDecisionNote !== null) && (
          <section
            className="workstation-facts"
            aria-label={`ข้อมูลใช้งานของ ${page.document.recipeName}`}
          >
            {page.document.operationalNotes.length > 0 && (
              <ul>{page.document.operationalNotes.map((note, index) => (
                <li key={`${String(index)}:${note}`}>{note}</li>
              ))}</ul>
            )}
            {page.document.yieldText !== null && (
              <p><strong>ผลผลิต</strong> <span>{page.document.yieldText}</span></p>
            )}
            {page.document.methodDecisionNote !== null && (
              <p><strong>ขอบเขตวิธีทำ</strong> <span>{page.document.methodDecisionNote}</span></p>
            )}
          </section>
        )}
        {page.document.ingredients.length > 0 && (
          <table className="workstation-ingredients">
            <thead>
              <tr><th>วัตถุดิบ</th><th>ปริมาณ</th></tr>
            </thead>
            <tbody>
              {page.document.ingredients.map((line) => {
                const componentLabel = line.componentRecipeId === null
                  ? null
                  : componentLabelFor?.(line.componentRecipeId) ?? null;
                return (
                  <tr key={line.lineKey}>
                    <th scope="row">
                      {line.itemName}
                      {componentLabel !== null && (
                        <span className="workstation-ingredient__component-reference">
                          {componentLabel}
                        </span>
                      )}
                    </th>
                    <td>
                      <span>{sourceFact(line)}</span>
                      {page.document.stage === "service" && line.servingNote !== null && (
                        <span className="workstation-ingredient__serving-note">{line.servingNote}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <ol className="workstation-steps">
          {page.blocks.map((block) => {
            const step = stepsById.get(block.stepId);
            if (step === undefined) return null;
            const linkedMedia = mediaForStep(media, step.stepId);
            return (
              <li
                key={`${JSON.stringify(step.stepId)}:${String(step.order)}`}
                value={step.order}
                className={`workstation-step workstation-step--${block.layout}`}
              >
                <p className="workstation-step__instruction">{step.instruction}</p>
                {linkedMedia.length > 0 && (
                  <ul className="workstation-media" aria-label={`รูปขั้นตอน ${String(step.order)}`}>
                    {linkedMedia.map(({ asset, link, renderedUrl }) => (
                      <li key={mediaKey(link)} className="workstation-media__item">
                        <img src={renderedUrl} alt={asset.altText} />
                        <div className="workstation-media__meta">
                          {asset.reviewState === "sample" && (
                            <strong>ภาพตัวอย่าง · ยังไม่ยืนยัน</strong>
                          )}
                          {link.reviewNeeded && <strong>รูปควรตรวจใหม่</strong>}
                          <span>{ROLE_LABELS[link.role]}</span>
                          {asset.caption.length > 0 && <span>{asset.caption}</span>}
                          {asset.measurementAnnotation !== null && (
                            <span>{asset.measurementAnnotation}</span>
                          )}
                          {link.vessel !== null && <span>{VESSEL_LABELS[link.vessel]}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {(readiness === "draft" || hasMissingMedia || hasSampleMedia || hasReviewNeededMedia) && (
        <footer className="workstation-card__warnings" aria-label="คำเตือนชุดพิมพ์">
          {readiness === "draft" && <p>ข้อมูลยังไม่ครบ — กรุณาตรวจรายการวัตถุดิบและวิธีทำ</p>}
          {readiness === "draft" && page.document.blockers.map((blocker, index) => (
            <p key={`${String(index)}:${blocker}`}>{blocker}</p>
          ))}
          {hasMissingMedia && <p>รูปขั้นตอนไม่ครบ — พิมพ์แบบข้อความได้</p>}
          {hasSampleMedia && <p>มีภาพตัวอย่าง — ใช้อ้างอิงเท่านั้น ยังไม่ยืนยัน</p>}
          {hasReviewNeededMedia && <p>มีรูปที่ควรตรวจใหม่</p>}
        </footer>
      )}
    </article>
  );
}
