import { Link } from "react-router-dom";

type ModulePageProps = {
  id: string;
  title: string;
  description: string;
  sectionTitle: string;
  emptyTitle: string;
  emptyText: string;
  actionLabel: string;
  actionTo: string;
};

function ModulePage({ id, title, description, sectionTitle, emptyTitle, emptyText, actionLabel, actionTo }: ModulePageProps) {
  return <section className="module-page" aria-labelledby={id}>
    <header className="page-heading"><div><h1 id={id}>{title}</h1><p>{description}</p></div></header>
    <section className="module-page__workspace" aria-labelledby={`${id}-section`}>
      <div className="section-heading"><div><h2 id={`${id}-section`}>{sectionTitle}</h2><p>พื้นที่นี้พร้อมสำหรับเชื่อมข้อมูลเมื่อเริ่มใช้งานส่วนนี้</p></div></div>
      <div className="module-empty"><span aria-hidden="true">◇</span><h3>{emptyTitle}</h3><p>{emptyText}</p><Link className="button-link" to={actionTo}>{actionLabel}</Link></div>
    </section>
  </section>;
}

export function BranchMenuPage() {
  return <ModulePage id="branch-menu-title" title="สาขาและเมนู" description="จัดชุดเมนูและสูตรที่แต่ละสาขาต้องใช้" sectionTitle="ชุดเมนูของสาขา" emptyTitle="ยังไม่ได้สร้างชุดเมนูสาขา" emptyText="เริ่มจากตรวจคลังสูตรให้พร้อม แล้วจึงจัดเมนูตามสาขาโดยไม่ทำสำเนาสูตร" actionLabel="เปิดคลังสูตร" actionTo="/recipes" />;
}

export function MeasurementKnowledgePage() {
  return <ModulePage id="measurement-title" title="Measurement Knowledge" description="มาตรฐานหน่วย ภาชนะ และวิธีตวงที่ใช้ร่วมกันในครัว" sectionTitle="มาตรฐานการตวง" emptyTitle="ยังไม่มีรายการมาตรฐาน" emptyText="เมื่อกำหนดมาตรฐานแล้ว สูตรยังคงแสดงข้อความต้นฉบับ และใช้ข้อมูลนี้เป็นความรู้ประกอบเท่านั้น" actionLabel="ดูสูตรอาหาร" actionTo="/recipes" />;
}

export function CookbookSettingsPage() {
  return <ModulePage id="settings-title" title="ตั้งค่า Cookbook" description="ตั้งค่าการแสดงผลและข้อมูลพื้นฐานของ Cookbook" sectionTitle="การตั้งค่าทั่วไป" emptyTitle="ยังไม่มีการตั้งค่าเพิ่มเติม" emptyText="ค่าหลักของสูตร ใบงาน และการพิมพ์ใช้มาตรฐานที่กำหนดไว้แล้ว" actionLabel="กลับไปภาพรวม" actionTo="/home" />;
}
