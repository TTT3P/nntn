import { Link, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { useOptionalCookbookDocument } from "../features/cookbook/CookbookDocumentProvider";
import "./product.css";

type Section = "home" | "recipes" | "prepared" | "work" | "print" | "branches" | "knowledge" | "settings";

type NavItem = {
  label: string;
  to: string;
  section: Section;
  icon: "home" | "book" | "prep" | "work" | "print" | "branch" | "measure" | "settings";
};

const PRIMARY_ITEMS: NavItem[] = [
  { label: "ภาพรวม", to: "/home", section: "home", icon: "home" },
  { label: "สูตรอาหาร", to: "/recipes", section: "recipes", icon: "book" },
  { label: "สูตรเตรียม", to: "/recipes?kind=prepared_recipe", section: "prepared", icon: "prep" },
  { label: "ใบงานครัว", to: "/recipes?mode=work", section: "work", icon: "work" },
  { label: "ศูนย์พิมพ์", to: "/print", section: "print", icon: "print" },
];

const MANAGEMENT_ITEMS: NavItem[] = [
  { label: "สาขาและเมนู", to: "/branches", section: "branches", icon: "branch" },
  { label: "Measurement Knowledge", to: "/knowledge", section: "knowledge", icon: "measure" },
  { label: "ตั้งค่า", to: "/settings", section: "settings", icon: "settings" },
];

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const paths: Record<NavItem["icon"], ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></>,
    prep: <><path d="M5 5h14M7 5l1 15h8l1-15" /><path d="M9 9h6M10 13h4" /></>,
    work: <><path d="M8 4h8l1 3h3v13H4V7h3z" /><path d="M8 12h8M8 16h5" /></>,
    print: <><path d="M7 9V3h10v6M7 18H4V9h16v9h-3" /><path d="M7 14h10v7H7z" /></>,
    branch: <><path d="M12 4v6M6 20v-4h12v4M6 16v-4h12v4" /><circle cx="12" cy="4" r="2" /><circle cx="6" cy="20" r="2" /><circle cx="18" cy="20" r="2" /></>,
    measure: <><path d="M4 7h16v10H4z" /><path d="M8 7v4M12 7v2M16 7v4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  };
  return <svg className="product-nav__icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function currentSection(pathname: string, search: string): Section {
  const params = new URLSearchParams(search);
  if (pathname === "/home") return "home";
  if (pathname === "/print") return "print";
  if (pathname === "/branches") return "branches";
  if (pathname === "/knowledge") return "knowledge";
  if (pathname === "/settings") return "settings";
  if (pathname.startsWith("/work/") || params.get("mode") === "work") return "work";
  if (pathname === "/recipes" && params.get("kind") === "prepared_recipe") return "prepared";
  return "recipes";
}

function CookbookExportButton() {
  const cookbook = useOptionalCookbookDocument();
  const [message, setMessage] = useState<string | null>(null);
  if (cookbook === null) return null;
  const documentToExport = cookbook.document;

  function download() {
    try {
      const blob = new Blob([`${JSON.stringify(documentToExport, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "nntn-cookbook.json";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setMessage("ดาวน์โหลดข้อมูลแล้ว");
    } catch {
      setMessage("ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  }

  return <section className="product-tools" aria-label="เครื่องมือข้อมูล"><button type="button" onClick={download}><NavIcon name="book" /><span>ดาวน์โหลดข้อมูล</span></button>{message !== null && <span className="product-nav__message" role="status">{message}</span>}</section>;
}

function NavigationGroup({ label, items, active, close }: { label: string; items: NavItem[]; active: Section; close(): void }) {
  return <section className="product-nav__group" aria-label={label}><p>{label}</p>{items.map((item) => <Link key={item.section} to={item.to} aria-current={active === item.section ? "page" : undefined} onClick={close}><NavIcon name={item.icon} /><span>{item.label}</span></Link>)}</section>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = currentSection(location.pathname, location.search);
  const activeLabel = [...PRIMARY_ITEMS, ...MANAGEMENT_ITEMS].find(({ section }) => section === active)?.label ?? "Cookbook";
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={`product-shell${menuOpen ? " product-shell--menu-open" : ""}`}>
      <header className="product-mobile-header">
        <button type="button" className="product-menu-button" aria-expanded={menuOpen} aria-controls="product-sidebar" aria-label="เปิดเมนู" onClick={() => setMenuOpen((open) => !open)}><span aria-hidden="true">☰</span></button>
        <Link className="product-mobile-brand" to="/home" aria-label="กลับไปภาพรวม Cookbook"><span aria-hidden="true">น</span><strong>{activeLabel}</strong></Link>
      </header>
      <aside className="product-sidebar" id="product-sidebar" aria-label="แถบนำทาง Cookbook">
        <Link className="product-brand" to="/home" aria-label="NNTN Cookbook" onClick={closeMenu}>
          <span className="product-brand__mark" aria-hidden="true">น</span>
          <span><strong>NNTN</strong><small>Cookbook</small></span>
        </Link>
        <nav className="product-nav" aria-label="เมนูหลัก">
          <NavigationGroup label="งานครัว" items={PRIMARY_ITEMS} active={active} close={closeMenu} />
          <NavigationGroup label="จัดการระบบ" items={MANAGEMENT_ITEMS} active={active} close={closeMenu} />
        </nav>
        <CookbookExportButton />
      </aside>
      {menuOpen && <button type="button" className="product-sidebar-backdrop" aria-label="ปิดเมนู" onClick={closeMenu} />}
      <main className="product-main" id="main-content">{children}</main>
    </div>
  );
}
