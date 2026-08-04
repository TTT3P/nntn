(() => {
  "use strict";

  const data = window.NNTNCookbookImportData;
  const reviewApi = window.CookbookImportReview;
  if (!data || !reviewApi) return;

  const body = document.querySelector("#import-review-body");
  const empty = document.querySelector("#import-review-empty");
  const detailContent = document.querySelector("#import-detail-content");
  const search = document.querySelector("#import-search");
  const scopeFilter = document.querySelector("#import-scope-filter");
  const kindFilter = document.querySelector("#import-kind-filter");
  const methodFilter = document.querySelector("#import-method-filter");
  let selectedRecipeId = null;

  const kindLabels = { menu: "เมนูขาย", prep: "สูตรเตรียม", sub: "สูตรย่อย" };
  const reviewStateLabels = {
    reviewed_candidate: "มี candidate",
    conflict: "มีจุดขัดแย้ง",
    missing_method: "ขาดวิธีทำ",
    missing_source: "ขาดต้นฉบับ",
    queued: "เข้าคิวต่อ"
  };
  const decisionStatusLabels = {
    confirmed: "ตรงกัน",
    confirmed_from_docx: "ใช้ตาม DOCX",
    confirmed_from_handwriting: "ใช้ตามลายมือ",
    removed_by_handwriting: "ตัดออกตามลายมือ",
    needs_review: "รอตรวจ",
    conflict: "ขัดแย้ง"
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function methodLabel(status) {
    return status === "missing" ? "ไม่มีข้อมูล" : "มีใน V1 · รอตรวจ";
  }

  function unitText(line) {
    const value = line.v1_quantity_value ?? "—";
    return `${value} ${line.v1_unit || "ไม่ระบุหน่วย"}`;
  }

  function renderSummary() {
    const counts = reviewApi.summarizeImport(data);
    document.querySelector("#import-recipe-count").textContent = counts.active_recipes ?? 0;
    document.querySelector("#import-item-count").textContent = counts.recipe_items ?? 0;
    document.querySelector("#import-dependency-count").textContent = counts.prepared_recipe_lines ?? 0;
    document.querySelector("#import-missing-method-count").textContent = counts.recipes_missing_v1_method ?? 0;
  }

  function itemRows(lines) {
    if (lines.length === 0) return '<p class="import-detail-muted">ไม่มีรายการ</p>';
    return `<div class="import-item-list">${lines.map((line) => `
      <div class="import-item-row">
        <div><strong>${escapeHtml(line.item_name)}</strong><small>ข้อมูล V1 · รอตรวจต้นฉบับ</small></div>
        <span class="import-v1-value">${escapeHtml(unitText(line))}</span>
        <span class="import-final-value">ค่าหน้าครัว: —</span>
      </div>`).join("")}</div>`;
  }

  function sectionMappingsHtml(mappings) {
    if (mappings.length === 0) return "";
    return `<section class="import-detail-section source-section-map">
      <div class="import-detail-section-title"><h5>สูตรย่อยที่ซ่อนอยู่ใน DOCX</h5><span>${mappings.reduce((count, document) => count + document.sections.length, 0)} section</span></div>
      ${mappings.map((document) => `
        <article class="source-document-card">
          <strong>${escapeHtml(document.source_document)}</strong>
          <div>${document.sections.map((section) => `
            <div class="source-section-row">
              <span>${escapeHtml(section.section_name)}</span>
              <b>→ ${escapeHtml(section.maps_to_recipe_name || "สูตรใหม่ที่ต้องสร้าง")}</b>
            </div>`).join("")}</div>
        </article>`).join("")}
    </section>`;
  }

  function comparisonHtml(firstSet) {
    if (!firstSet.recipe) return "";
    const decisions = firstSet.recipe.decisions || [];
    return `<section class="import-detail-section source-comparison-section">
      <div class="import-detail-section-title"><h5>เทียบต้นฉบับและค่า candidate</h5><span>${decisions.length} รายการ</span></div>
      <div class="source-comparison-list">${decisions.map((decision) => `
        <article class="source-comparison-card">
          <header><strong>${escapeHtml(decision.item_name)}</strong><span class="decision-status is-${escapeHtml(decision.status)}">${escapeHtml(decisionStatusLabels[decision.status] || decision.status)}</span></header>
          <dl class="source-value-grid">
            <div><dt>V1</dt><dd>${escapeHtml(decision.v1 || "—")}</dd></div>
            <div><dt>DOCX</dt><dd>${escapeHtml(decision.docx || "—")}</dd></div>
            <div><dt>V2</dt><dd>${escapeHtml(decision.v2 || "—")}</dd></div>
            <div><dt>ลายมือ</dt><dd>${escapeHtml(decision.handwriting || "—")}</dd></div>
          </dl>
          <p class="candidate-value"><span>ค่าหน้าครัว</span><strong>${escapeHtml(decision.candidate || "ยังไม่สรุป")}</strong></p>
        </article>`).join("")}</div>
      <div class="method-decision ${firstSet.recipe.method_status.includes("conflict") || firstSet.recipe.method_status.includes("missing") ? "is-warning" : ""}">
        <strong>ขั้นตอนการทำ</strong><span>${escapeHtml(firstSet.recipe.method_note)}</span>
      </div>
    </section>`;
  }

  function unresolvedHtml(firstSet) {
    const issues = firstSet.unresolved.filter((issue) => issue.recipe_name !== "ชุดเมนูแรก");
    if (issues.length === 0) return "";
    return `<section class="import-detail-section">
      <div class="import-detail-section-title"><h5>คำถามที่ยังห้ามเดา</h5><span>${issues.length} จุด</span></div>
      ${issues.map((issue) => `<div class="missing-method-callout"><strong>${escapeHtml(issue.recipe_name)}</strong><span>${escapeHtml(issue.question)}</span></div>`).join("")}
    </section>`;
  }

  function renderDetail(recipeId) {
    const detail = reviewApi.getRecipeReviewDetail(data, recipeId);
    if (!detail.recipe) return;
    selectedRecipeId = Number(recipeId);
    const firstSet = reviewApi.getFirstSetReview(data, recipeId);
    const sectionMappings = reviewApi.getSourceSectionMappings(data, recipeId);
    const stepsMissing = detail.steps?.decision_status === "missing_method";
    const reviewState = firstSet.manifest?.review_state;
    detailContent.className = "import-detail-content";
    detailContent.innerHTML = `
      <header class="import-detail-header">
        <div>
          <p>${escapeHtml(kindLabels[detail.recipe.recipe_kind] || detail.recipe.recipe_kind)}</p>
          <h4>${escapeHtml(detail.recipe.recipe_name)}</h4>
        </div>
        <span class="source-review-badge review-state-${escapeHtml(reviewState || "unreviewed")}">${escapeHtml(reviewStateLabels[reviewState] || "รอตรวจต้นฉบับ")}</span>
      </header>
      ${sectionMappingsHtml(sectionMappings)}
      ${comparisonHtml(firstSet)}
      ${unresolvedHtml(firstSet)}
      <section class="import-detail-section">
        <div class="import-detail-section-title"><h5>วัตถุดิบตรง</h5><span>${detail.directIngredients.length} รายการ</span></div>
        ${itemRows(detail.directIngredients)}
      </section>
      <section class="import-detail-section prepared-section">
        <div class="import-detail-section-title"><h5>สูตรประกอบที่ต้องเตรียม</h5><span>${detail.preparedRecipes.length} รายการ</span></div>
        ${itemRows(detail.preparedRecipes)}
      </section>
      <section class="import-detail-section">
        <div class="import-detail-section-title"><h5>ขั้นตอนการทำ</h5><span>${stepsMissing ? "ไม่มีข้อมูล" : "มีใน V1 · รอตรวจ"}</span></div>
        ${stepsMissing
          ? '<div class="missing-method-callout"><strong>ยังพิมพ์ฉบับใช้งานไม่ได้</strong><span>ต้องเติมขั้นตอนจาก DOCX / V2 / ลายมือก่อน</span></div>'
          : `<div class="import-method-preview">${escapeHtml(detail.steps.v1_steps_text).replace(/\n/g, "<br>")}</div>`}
      </section>`;
    renderQueue();
  }

  function renderQueue() {
    const manifest = data.first_set_review?.manifest || [];
    const manifestById = new Map(manifest.map((row) => [Number(row.recipe_id), row]));
    const firstSetOrder = new Map(manifest.map((row, index) => [Number(row.recipe_id), index]));
    let rows = reviewApi.filterReviewQueue(data.review_queue, {
      query: search.value,
      recipeKind: kindFilter.value,
      methodStatus: methodFilter.value
    });
    if (scopeFilter.value === "first-set") {
      rows = rows
        .filter((row) => manifestById.has(Number(row.recipe_id)))
        .sort((a, b) => firstSetOrder.get(Number(a.recipe_id)) - firstSetOrder.get(Number(b.recipe_id)));
    }

    empty.hidden = rows.length > 0;
    body.innerHTML = rows.map((row) => {
      const reviewState = manifestById.get(Number(row.recipe_id))?.review_state;
      return `
      <tr class="${Number(row.recipe_id) === selectedRecipeId ? "is-selected" : ""}">
        <td><button class="import-recipe-link" type="button" data-recipe-id="${row.recipe_id}">${escapeHtml(row.recipe_name)}</button></td>
        <td>${escapeHtml(kindLabels[row.recipe_kind] || row.recipe_kind)}</td>
        <td>${row.v1_bom_line_count ?? 0}</td>
        <td>${row.v1_dependency_count ?? 0}</td>
        <td><span class="method-status ${row.v1_method_status === "missing" ? "is-missing" : ""}">${methodLabel(row.v1_method_status)}</span></td>
        <td><span class="source-review-badge review-state-${escapeHtml(reviewState || "unreviewed")}">${escapeHtml(reviewStateLabels[reviewState] || "รอตรวจ")}</span></td>
      </tr>`;
    }).join("");

    body.querySelectorAll(".import-recipe-link").forEach((button) => {
      button.addEventListener("click", () => renderDetail(button.dataset.recipeId));
    });
  }

  [search, scopeFilter, kindFilter, methodFilter].forEach((control) => {
    control.addEventListener(control === search ? "input" : "change", renderQueue);
  });

  renderSummary();
  renderQueue();
})();
