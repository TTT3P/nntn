import { Link } from "react-router-dom";
import type { CookbookSnapshot, RecipeIdentity } from "../../domain/cookbook/types";
import { evaluateReadiness } from "../../domain/review/readiness";
import { usePrototype } from "../../prototype/PrototypeProvider";
import { useOptionalCookbookDocument } from "../cookbook/CookbookDocumentProvider";
import { deriveRecipeMediaCoverage } from "../recipe/recipeMediaCoverage";

function isDraft(recipeId: RecipeIdentity, snapshot: CookbookSnapshot, draftById: ReadonlyMap<RecipeIdentity, boolean> | null): boolean {
  if (draftById !== null) return draftById.get(recipeId) ?? true;
  const recipe = snapshot.recipes.find((candidate) => candidate.recipeId === recipeId);
  if (recipe === undefined) return true;
  return evaluateReadiness(recipe, deriveRecipeMediaCoverage(recipe, snapshot).coverage).draft;
}

export function CookbookHomePage() {
  const { snapshot: fallbackSnapshot } = usePrototype();
  const cookbook = useOptionalCookbookDocument();
  const snapshot = cookbook?.snapshot ?? fallbackSnapshot;
  const draftById = cookbook?.recipeDraftById ?? null;
  const total = snapshot.recipes.length;
  const sellable = snapshot.recipes.filter(({ kind }) => kind === "sellable_menu").length;
  const prepared = total - sellable;
  const waiting = snapshot.recipes.filter(({ recipeId }) => isDraft(recipeId, snapshot, draftById)).length;
  const ready = total - waiting;

  return (
    <section className="role-center" aria-labelledby="role-center-title">
      <header className="role-center__hero">
        <div><p className="role-center__date">ศูนย์งานสูตรอาหาร NNTN</p><h1 id="role-center-title">ภาพรวม Cookbook</h1><p>เปิดสูตร ทำใบงาน และจัดชุดพิมพ์สำหรับงานครัวจากที่เดียว</p></div>
        <Link className="button-link button-link--primary" to="/recipes?mode=manage">จัดการสูตร</Link>
      </header>

      <section className="role-center__summary" aria-label="ภาพรวมคลังสูตร">
        <p aria-label={`${String(total)} สูตรทั้งหมด`}><strong>{total}</strong><span>สูตรทั้งหมด</span></p>
        <p><strong>{sellable}</strong><span>เมนูขาย</span></p>
        <p><strong>{prepared}</strong><span>สูตรเตรียมและสูตรย่อย</span></p>
        <p><strong>{ready}</strong><span>สูตรพร้อมใช้</span></p>
        <p aria-label={`${String(waiting)} สูตรรอข้อมูล`}><strong>{waiting}</strong><span>สูตรรอข้อมูล</span></p>
      </section>
      <div className="sr-only" aria-live="polite">{total} สูตรทั้งหมด · {waiting} สูตรรอข้อมูล</div>

      <div className="role-center__workspace">
        <section className="role-center__primary" aria-labelledby="daily-work-title">
          <div className="section-heading"><div><h2 id="daily-work-title">งานประจำ</h2><p>เริ่มจากงานที่ต้องใช้ในครัววันนี้</p></div></div>
          <nav className="role-center__actions" aria-label="งานประจำ">
            <Link to="/recipes"><span aria-hidden="true">⌕</span><strong>ค้นหาและเปิดสูตร</strong><small>ดูวัตถุดิบ วิธีทำ และสูตรประกอบ</small><b aria-hidden="true">›</b></Link>
            <Link to="/recipes?mode=work"><span aria-hidden="true">▤</span><strong>เปิดใบงานครัว</strong><small>เลือกสูตรและจุดงานที่ต้องใช้</small><b aria-hidden="true">›</b></Link>
            <Link to="/print"><span aria-hidden="true">▣</span><strong>จัดชุดพิมพ์</strong><small>เตรียม A5, A4 หรือหนังสือสูตร</small><b aria-hidden="true">›</b></Link>
          </nav>
        </section>

        <aside className="role-center__secondary" aria-labelledby="management-title">
          <div className="section-heading"><div><h2 id="management-title">จัดการ Cookbook</h2><p>พื้นที่สำหรับจัดโครงสร้างและมาตรฐาน</p></div></div>
          <nav aria-label="งานจัดการ">
            <Link to="/recipes?kind=prepared_recipe"><strong>สูตรเตรียม</strong><span>ซอส น้ำซุป เนื้อหมัก และของเตรียม</span></Link>
            <Link to="/branches"><strong>สาขาและเมนู</strong><span>จัดเมนูให้แต่ละสาขา</span></Link>
            <Link to="/knowledge"><strong>Measurement Knowledge</strong><span>มาตรฐานหน่วยและภาชนะ</span></Link>
          </nav>
        </aside>
      </div>
    </section>
  );
}
