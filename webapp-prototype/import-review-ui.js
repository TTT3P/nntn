(() => {
  "use strict";

  const legacyData = window.NNTNCookbookImportData;
  const sotData = window.NNTNKitchenSotFirstSetV2;
  const reviewApi = window.CookbookImportReview;
  const sotApi = window.KitchenSot;
  if (!legacyData || !reviewApi) return;

  const store = sotData && sotApi ? sotApi.createKitchenSotStore(sotData) : null;
  const body = document.querySelector("#import-review-body");
  const empty = document.querySelector("#import-review-empty");
  const detailContent = document.querySelector("#import-detail-content");
  const search = document.querySelector("#import-search");
  const scopeFilter = document.querySelector("#import-scope-filter");
  const kindFilter = document.querySelector("#import-kind-filter");
  const methodFilter = document.querySelector("#import-method-filter");
  let selectedRecipeId = null;
  let selectedRootId = null;
  let noticeText = "";

  const kindLabels = { menu: "เมนูขาย", prep: "สูตรเตรียม", sub: "สูตรย่อย", sellable_menu: "เมนูขาย", prepared_recipe: "สูตรเตรียม" };
  const reviewStateLabels = {
    reviewed_candidate: "มีฉบับตั้งต้น",
    conflict: "มีจุดขัดแย้ง",
    missing_method: "ขาดวิธีทำ",
    missing_source: "ขาดต้นฉบับ",
    draft_confirmed: "แก้ในหน้าทดลองแล้ว",
    print_ready: "พร้อมทดลองพิมพ์",
    queued: "เข้าคิวต่อ"
  };
  const decisionStatusLabels = {
    confirmed: "ตรงกัน",
    confirmed_from_docx: "ใช้ตาม DOCX",
    confirmed_from_handwriting: "ใช้ตามลายมือ",
    confirmed_by_owner: "เจ้าของยืนยัน",
    removed_by_handwriting: "ตัดออกตามลายมือ",
    manual_review: "แก้ในหน้าทดลอง",
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
    return status === "missing" ? "ไม่มีข้อมูล" : "มีข้อมูลตั้งต้น";
  }

  function renderSummary() {
    const counts = reviewApi.summarizeImport(legacyData);
    document.querySelector("#import-recipe-count").textContent = counts.active_recipes ?? 0;
    document.querySelector("#import-item-count").textContent = counts.recipe_items ?? 0;
    document.querySelector("#import-dependency-count").textContent = counts.prepared_recipe_lines ?? 0;
    document.querySelector("#import-missing-method-count").textContent = counts.recipes_missing_v1_method ?? 0;
  }

  function sourceValueCards(item) {
    const values = item.source_values || {};
    return `<dl class="source-value-grid">
      <div><dt>V1</dt><dd>${escapeHtml(values.v1 || "ไม่มี")}</dd></div>
      <div><dt>DOCX</dt><dd>${escapeHtml(values.docx || "ไม่มี")}</dd></div>
      <div><dt>V2</dt><dd>${escapeHtml(values.v2 || "ไม่มี")}</dd></div>
      <div><dt>ลายมือ</dt><dd>${escapeHtml(values.handwriting || "ไม่มีการแก้")}</dd></div>
    </dl>`;
  }

  function sectionMappingsHtml(recipeId) {
    const mappings = reviewApi.getSourceSectionMappings(legacyData, recipeId);
    if (mappings.length === 0) return "";
    return `<section class="import-detail-section source-section-map">
      <div class="import-detail-section-title"><h5>ส่วนที่พบในไฟล์ DOCX</h5><span>${mappings.reduce((count, document) => count + document.sections.length, 0)} ส่วน</span></div>
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

  function rootForRecipe(recipeId) {
    if (!store) return recipeId;
    const match = (sotData.root_recipe_ids || []).find((rootId) =>
      store.recipeTreeRows(rootId).some((row) => String(row.recipeId) === String(recipeId))
    );
    return match ?? recipeId;
  }

  function treeHtml(rootId, activeRecipeId) {
    const rows = store.recipeTreeRows(rootId);
    return `<section class="kitchen-tree-panel" aria-labelledby="kitchen-tree-title">
      <div class="import-detail-section-title"><h5 id="kitchen-tree-title">เมนูนี้ประกอบด้วยอะไรบ้าง</h5><span>${rows.length} สูตร</span></div>
      <div class="kitchen-recipe-tree" id="kitchen-recipe-tree">${rows.map((row) => `
        <button type="button" class="kitchen-tree-row ${String(row.recipeId) === String(activeRecipeId) ? "is-active" : ""}" data-tree-recipe-id="${escapeHtml(row.recipeId)}" style="--tree-depth:${row.depth}">
          <span><b>${escapeHtml(row.name)}</b><small>${escapeHtml(kindLabels[row.type] || row.type)}</small></span>
          <em>${row.blockerCount ? `${row.blockerCount} จุดต้องตรวจ` : "มีฉบับตั้งต้น"}</em>
        </button>`).join("")}</div>
    </section>`;
  }

  function editorItemsHtml(recipe) {
    const visibleItems = (recipe.items || []).filter((item) => item.decision_status !== "removed_by_handwriting");
    if (visibleItems.length === 0) return '<p class="import-detail-muted">ยังไม่มีรายการส่วนผสม</p>';
    return `<div class="kitchen-candidate-list">${visibleItems.map((item) => `
      <article class="source-comparison-card kitchen-candidate-card">
        <header>
          <div><strong>${escapeHtml(item.item_name)}</strong><small>${item.item_kind === "prepared_recipe" ? "สูตรเตรียมที่ต้องทำแยก" : "วัตถุดิบตรง"}</small></div>
          <span class="decision-status is-${escapeHtml(item.decision_status)}">${escapeHtml(decisionStatusLabels[item.decision_status] || item.decision_status)}</span>
        </header>
        ${sourceValueCards(item)}
        <label class="field kitchen-candidate-field">
          <span>ค่าหน้าครัว</span>
          <input class="kitchen-candidate-input" data-line-key="${escapeHtml(item.line_key)}" value="${escapeHtml(item.candidate_text || "")}" placeholder="ยังไม่สรุป ห้ามเดา" aria-label="ค่าหน้าครัว ${escapeHtml(item.item_name)}">
        </label>
        ${item.cost_basis_text ? `<p class="kitchen-cost-basis"><strong>ฐานต้นทุน:</strong> ${escapeHtml(item.cost_basis_text)}</p>` : ""}
        ${item.serving_note ? `<p class="kitchen-serving-note"><strong>การเสิร์ฟ:</strong> ${escapeHtml(item.serving_note)}</p>` : ""}
        ${item.candidate_text && ["conflict", "needs_review", "manual_review"].includes(item.decision_status) ? `
          <button class="button button-small confirm-kitchen-candidate" type="button" data-confirm-line-key="${escapeHtml(item.line_key)}" data-confirm-item-name="${escapeHtml(item.item_name)}">ยืนยันค่าตามนี้</button>` : ""}
      </article>`).join("")}</div>`;
  }

  function readinessHtml(evaluation) {
    if (evaluation.blockers.length === 0) {
      return `<div class="kitchen-readiness is-ready"><strong>${evaluation.status === "print_ready" ? "พร้อมทดลองพิมพ์" : "ข้อมูลครบสำหรับตรวจรอบสุดท้าย"}</strong><span>ยังเป็นข้อมูลใน Prototype และยังไม่ใช่การอนุมัติใช้งานจริง</span></div>`;
    }
    return `<div class="kitchen-readiness is-blocked"><strong>ยังมี ${evaluation.blockers.length} จุดที่ห้ามเดา</strong><ul>${evaluation.blockers.map((blocker) => `<li>${escapeHtml(blocker.itemName ? `${blocker.itemName}: ${blocker.message}` : blocker.message)}</li>`).join("")}</ul></div>`;
  }

  function wireEditor(recipeId) {
    detailContent.querySelectorAll("[data-tree-recipe-id]").forEach((button) => {
      button.addEventListener("click", () => renderSotDetail(button.dataset.treeRecipeId, selectedRootId));
    });

    document.querySelector("#save-kitchen-draft")?.addEventListener("click", () => {
      saveEditor(recipeId);
      noticeText = "บันทึกในหน้าทดลองแล้ว · รีโหลดแล้วข้อมูลจะกลับเป็นต้นฉบับ";
      renderSotDetail(recipeId, selectedRootId);
    });

    detailContent.querySelectorAll(".confirm-kitchen-candidate").forEach((button) => {
      button.addEventListener("click", () => {
        saveEditor(recipeId);
        store.confirmItemCandidate(recipeId, button.dataset.confirmLineKey, "เจ้าของยืนยันจากหน้าตรวจต้นฉบับ");
        noticeText = `ยืนยัน ${button.dataset.confirmItemName} แล้ว · ยังเป็นข้อมูลชั่วคราวใน Prototype`;
        renderSotDetail(recipeId, selectedRootId);
      });
    });

    document.querySelector("#mark-kitchen-print-ready")?.addEventListener("click", () => {
      saveEditor(recipeId);
      const result = store.markPrintReady(recipeId);
      noticeText = result.blockers.length
        ? `ยังทำเครื่องหมายพร้อมพิมพ์ไม่ได้ เพราะเหลือ ${result.blockers.length} จุด`
        : "ทำเครื่องหมายพร้อมทดลองพิมพ์แล้ว";
      renderSotDetail(recipeId, selectedRootId);
    });

    document.querySelector("#add-kitchen-print-bundle")?.addEventListener("click", () => {
      saveEditor(recipeId);
      const bundle = store.buildPrintBundle([selectedRootId]);
      window.dispatchEvent(new CustomEvent("nntn:kitchen-print-request", { detail: { rootRecipeIds: [selectedRootId], bundle } }));
      noticeText = bundle.allowedFinal
        ? `เพิ่ม ${bundle.recipes.length} สูตรลงชุดพิมพ์แล้ว`
        : `เพิ่มฉบับร่าง ${bundle.recipes.length} สูตรแล้ว และแนบ ${bundle.blockers.length} จุดที่ต้องตรวจ`;
      renderSotDetail(recipeId, selectedRootId);
    });
  }

  function saveEditor(recipeId) {
    detailContent.querySelectorAll(".kitchen-candidate-input").forEach((input) => {
      store.updateItemCandidate(recipeId, input.dataset.lineKey, input.value, "แก้ไขใน Prototype v2");
    });
    const method = document.querySelector("#kitchen-method-candidate");
    store.updateMethodCandidate(recipeId, method?.value || "", "แก้ไขใน Prototype v2");
    store.saveDraft(recipeId);
  }

  function renderSotDetail(recipeId, rootId = rootForRecipe(recipeId)) {
    const recipe = store.getRecipe(recipeId);
    if (!recipe) return renderLegacyDetail(recipeId);
    selectedRecipeId = recipe.recipe_id;
    selectedRootId = rootId;
    const evaluation = store.evaluateRecipe(recipeId);
    detailContent.className = "import-detail-content kitchen-sot-detail";
    detailContent.innerHTML = `
      ${treeHtml(rootId, recipeId)}
      <header class="import-detail-header kitchen-editor-header">
        <div><p>${escapeHtml(kindLabels[recipe.recipe_type] || recipe.recipe_type)}</p><h4>${escapeHtml(recipe.recipe_name)}</h4><small>${escapeHtml(recipe.recipe_version_id)}</small></div>
        <span class="source-review-badge review-state-${escapeHtml(recipe.review_state)}">${escapeHtml(reviewStateLabels[recipe.review_state] || "ฉบับร่าง")}</span>
      </header>
      ${recipe.yield_candidate_text ? `<p class="kitchen-yield-line"><strong>ผลผลิต:</strong> ${escapeHtml(recipe.yield_candidate_text)}</p>` : ""}
      ${noticeText ? `<p class="kitchen-save-notice" role="status">${escapeHtml(noticeText)}</p>` : ""}
      ${sectionMappingsHtml(recipe.recipe_id)}
      <section class="import-detail-section" id="kitchen-draft-editor">
        <div class="import-detail-section-title"><h5>เทียบต้นฉบับและแก้ค่าหน้าครัว</h5><span>${recipe.items.length} รายการ</span></div>
        ${editorItemsHtml(recipe)}
      </section>
      <section class="import-detail-section">
        <div class="import-detail-section-title"><h5>วิธีทำฉบับหน้าครัว</h5><span>${recipe.method_selected_source ? `ที่มา: ${recipe.method_selected_source}` : "ยังไม่มี"}</span></div>
        <p class="import-detail-muted">${escapeHtml(recipe.method_decision_note || "กรอกตามต้นฉบับ ห้ามแต่งขั้นตอนเพิ่ม")}</p>
        <label class="field"><span class="sr-only">วิธีทำฉบับหน้าครัว</span><textarea id="kitchen-method-candidate" rows="9" placeholder="ยังไม่มีวิธีทำ ห้ามเดา">${escapeHtml(recipe.method_candidate_text || "")}</textarea></label>
      </section>
      <section class="import-detail-section" id="kitchen-readiness">
        <div class="import-detail-section-title"><h5>ความพร้อม</h5><span>${evaluation.blockers.length ? "ฉบับร่าง" : "รอตรวจรอบสุดท้าย"}</span></div>
        ${readinessHtml(evaluation)}
      </section>
      <div class="kitchen-editor-actions">
        <button class="button button-secondary" id="save-kitchen-draft" type="button">บันทึกฉบับร่าง</button>
        <button class="button button-secondary" id="mark-kitchen-print-ready" type="button">ทำเครื่องหมายพร้อมพิมพ์</button>
        <button class="button button-primary" id="add-kitchen-print-bundle" type="button">เพิ่มเมนูและสูตรเตรียมลงชุดพิมพ์</button>
      </div>
      <p class="print-help">ข้อมูลอยู่เฉพาะในหน้านี้ รีโหลดแล้วจะกลับเป็นต้นฉบับ · ไม่มีการแปลงหน่วยหรือส่งข้อมูลออก</p>`;
    wireEditor(recipeId);
    renderQueue();
  }

  function renderLegacyDetail(recipeId) {
    const detail = reviewApi.getRecipeReviewDetail(legacyData, recipeId);
    if (!detail.recipe) return;
    selectedRecipeId = Number(recipeId);
    detailContent.className = "import-detail-content";
    detailContent.innerHTML = `
      <header class="import-detail-header"><div><p>${escapeHtml(kindLabels[detail.recipe.recipe_kind] || detail.recipe.recipe_kind)}</p><h4>${escapeHtml(detail.recipe.recipe_name)}</h4></div><span class="source-review-badge review-state-queued">ยังไม่เข้าชุดแรก</span></header>
      <div class="missing-method-callout"><strong>รอตรวจในรอบถัดไป</strong><span>รอบ Prototype v2 นี้แก้ไขได้เฉพาะชุดแรก 16 สูตร เพื่อไม่ให้ข้อมูลที่ยังไม่ได้เทียบกลายเป็นสูตรหน้าครัวโดยอัตโนมัติ</span></div>`;
    renderQueue();
  }

  function renderDetail(recipeId) {
    noticeText = "";
    if (store?.getRecipe(recipeId)) renderSotDetail(recipeId);
    else renderLegacyDetail(recipeId);
  }

  function renderQueue() {
    const manifest = legacyData.first_set_review?.manifest || [];
    const manifestById = new Map(manifest.map((row) => [Number(row.recipe_id), row]));
    const firstSetOrder = new Map(manifest.map((row, index) => [Number(row.recipe_id), index]));
    const candidateRecipes = (sotData?.recipes || []).filter((recipe) => recipe.legacy_recipe_id == null);
    const candidateIds = new Set(candidateRecipes.map((recipe) => String(recipe.recipe_id)));
    const candidateOrder = new Map(candidateRecipes.map((recipe, index) => [String(recipe.recipe_id), manifest.length + index]));
    const reviewRows = reviewApi.mergeReviewQueueWithCandidates(legacyData.review_queue, candidateRecipes);
    let rows = reviewApi.filterReviewQueue(reviewRows, {
      query: search.value,
      recipeKind: kindFilter.value,
      methodStatus: methodFilter.value
    });

    if (scopeFilter.value === "first-set") {
      rows = rows
        .filter((row) => manifestById.has(Number(row.recipe_id)) || candidateIds.has(String(row.recipe_id)))
        .sort((a, b) => {
          const aOrder = firstSetOrder.get(Number(a.recipe_id)) ?? candidateOrder.get(String(a.recipe_id));
          const bOrder = firstSetOrder.get(Number(b.recipe_id)) ?? candidateOrder.get(String(b.recipe_id));
          return aOrder - bOrder;
        });
    }

    empty.hidden = rows.length > 0;
    body.innerHTML = rows.map((row) => {
      const liveRecipe = store?.getRecipe(row.recipe_id);
      const reviewState = liveRecipe?.review_state || manifestById.get(Number(row.recipe_id))?.review_state;
      const evaluation = liveRecipe ? store.evaluateRecipe(row.recipe_id) : null;
      return `<tr class="${String(row.recipe_id) === String(selectedRecipeId) ? "is-selected" : ""}">
        <td><button class="import-recipe-link" type="button" data-recipe-id="${row.recipe_id}">${escapeHtml(row.recipe_name)}</button></td>
        <td>${escapeHtml(kindLabels[row.recipe_kind] || row.recipe_kind)}</td>
        <td>${row.v1_bom_line_count ?? 0}</td>
        <td>${row.v1_dependency_count ?? 0}</td>
        <td><span class="method-status ${row.v1_method_status === "missing" ? "is-missing" : ""}">${methodLabel(row.v1_method_status)}</span></td>
        <td><span class="source-review-badge review-state-${escapeHtml(reviewState || "queued")}">${escapeHtml(evaluation?.blockers.length ? `${evaluation.blockers.length} จุดต้องตรวจ` : reviewStateLabels[reviewState] || "รอตรวจ")}</span></td>
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
  if (sotData?.root_recipe_ids?.length) renderSotDetail(sotData.root_recipe_ids[0]);
})();
