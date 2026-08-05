import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { RecipeLibraryPage } from "../features/library/RecipeLibraryPage";
import { RecipeDetailPage } from "../features/recipe/RecipeDetailPage";
import { PrintCenterPage } from "../features/print/PrintCenterPage";
import { SourceReviewPage } from "../features/review/SourceReviewPage";
import { WorkStagePage } from "../features/work/WorkStagePage";

function RoutePlaceholder({ title }: { title: string }) {
  return (
    <section className="route-placeholder" aria-label={title}>
      <h2>{title}</h2>
      <p>หน้าจอชั่วคราวสำหรับเส้นทางที่อนุมัติแล้ว</p>
    </section>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/recipes" replace />} />
      <Route
        path="/recipes"
        element={<RecipeLibraryPage />}
      />
      <Route
        path="/recipes/:recipeId"
        element={<RecipeDetailPage />}
      />
      <Route
        path="/source-review"
        element={<SourceReviewPage />}
      />
      <Route
        path="/work/:recipeId"
        element={<WorkStagePage />}
      />
      <Route
        path="/print"
        element={<PrintCenterPage />}
      />
      <Route
        path="*"
        element={<RoutePlaceholder title="ไม่พบหน้าที่ต้องการ" />}
      />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
