import type {
  IngredientLine,
  MediaAsset,
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
  return "ไม่ระบุในต้นฉบับ";
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
}: {
  page: WorkstationPage;
  media: MediaIndex;
  previewMode: "draft" | "approved";
  readiness: "draft" | "ready";
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
          <p>{previewMode === "approved" ? "ตัวอย่างพร้อมพิมพ์แบบอนุมัติ" : "ตัวอย่างฉบับร่าง"}</p>
          <p>{readiness === "ready" ? "สถานะสูตร: พร้อมตามเกณฑ์พิมพ์" : "สถานะสูตร: ฉบับร่าง"}</p>
          <p>
            {page.document.stage === "service"
              ? "ตัวคูณ 1 · ต่อหนึ่งเสิร์ฟ"
              : `ตัวคูณ ${String(page.document.multiplier)}`}
          </p>
          {page.totalParts > 1 && <p>ส่วน {page.partNumber} / {page.totalParts}</p>}
        </div>
      </header>

      <div className="workstation-card__body">
        {page.document.ingredients.length > 0 && (
          <table className="workstation-ingredients">
            <thead>
              <tr><th>วัตถุดิบ</th><th>ปริมาณตามต้นฉบับ</th></tr>
            </thead>
            <tbody>
              {page.document.ingredients.map((line) => (
                <tr key={line.lineKey}>
                  <th scope="row">{line.itemName}</th>
                  <td>{sourceFact(line)}</td>
                </tr>
              ))}
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
                            <strong>DEMO · ภาพตัวอย่าง ยังไม่ยืนยัน</strong>
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
          {readiness === "draft" && <p>ฉบับร่าง — ข้อมูลวิธีทำ แหล่งข้อมูล หรือรายการขวางยังต้องตรวจ</p>}
          {hasMissingMedia && <p>รูปขั้นตอนไม่ครบ — พิมพ์แบบข้อความได้</p>}
          {hasSampleMedia && <p>มีภาพ DEMO — ใช้อ้างอิงเท่านั้น ยังไม่ยืนยัน</p>}
          {hasReviewNeededMedia && <p>มีรูปที่ควรตรวจใหม่</p>}
        </footer>
      )}
    </article>
  );
}
