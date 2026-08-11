import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { RecipeLibraryPage } from "../features/library/RecipeLibraryPage";
import { RecipeDetailPage } from "../features/recipe/RecipeDetailPage";
import { RecipeEditor } from "../features/recipe/RecipeEditor";
import { PrintCenterPage } from "../features/print/PrintCenterPage";
import { WorkStagePage } from "../features/work/WorkStagePage";
import { CookbookHomePage } from "../features/home/CookbookHomePage";
import { BranchMenuPage, CookbookSettingsPage, MeasurementKnowledgePage } from "../features/modules/CookbookModulePages";
import { AppShell } from "./AppShell";

function RoutePlaceholder({ title }: { title: string }) {
  return (
    <section className="route-placeholder" aria-label={title}>
      <h2>{title}</h2>
      <p>ตรวจสอบที่อยู่แล้วลองอีกครั้ง</p>
    </section>
  );
}

export function AppRoutes() {
  return (
    <AppShell><Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<CookbookHomePage />} />
      <Route
        path="/recipes"
        element={<RecipeLibraryPage />}
      />
      <Route
        path="/recipes/:recipeId"
        element={<RecipeDetailPage />}
      />
      <Route
        path="/recipes/:recipeId/edit"
        element={<RecipeEditor />}
      />
      <Route
        path="/work/:recipeId"
        element={<WorkStagePage />}
      />
      <Route
        path="/print"
        element={<PrintCenterPage />}
      />
      <Route path="/branches" element={<BranchMenuPage />} />
      <Route path="/knowledge" element={<MeasurementKnowledgePage />} />
      <Route path="/settings" element={<CookbookSettingsPage />} />
      <Route
        path="*"
        element={<RoutePlaceholder title="ไม่พบหน้าที่ต้องการ" />}
      />
    </Routes></AppShell>
  );
}

export function AppRouter() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
