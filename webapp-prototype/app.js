(() => {
  "use strict";

  const { normalizeVariants, buildVariantRecipes, suggestSku } = window.RecipeVariants;

  const historyEntries = [
    { version: "v1.3", date: "2 ส.ค. 2026", editor: "ครัวกลาง", note: "ปรับสัดส่วนเครื่องเทศ" },
    { version: "v1.2", date: "27 ก.ค. 2026", editor: "ผู้จัดการสาขา", note: "เพิ่มขั้นตอนพักเนื้อ" },
    { version: "v1.1", date: "19 ก.ค. 2026", editor: "ทีมพัฒนาสูตร", note: "แก้หน่วยวัตถุดิบ" },
    { version: "v1.0", date: "12 ก.ค. 2026", editor: "TINE", note: "สร้างสูตรครั้งแรก" }
  ];

  const sampleRecipes = [
    {
      id: "sample-stew",
      name: "เนื้อตุ๋นสมุนไพร",
      category: "เมนูหลัก",
      yield: "10 ชาม",
      version: "v1.3",
      ingredients: [
        { name: "เนื้อน่องลาย", amount: 1800, unit: "กรัม" },
        { name: "น้ำซุปตั้งต้น", amount: 2500, unit: "มิลลิลิตร" },
        { name: "ซีอิ๊วขาว", amount: 90, unit: "มิลลิลิตร" },
        { name: "อบเชย", amount: 8, unit: "กรัม" },
        { name: "โป๊ยกั๊ก", amount: 5, unit: "ดอก" }
      ],
      steps: [
        "ล้างเนื้อ ซับให้แห้ง และหั่นตามขนาดมาตรฐาน",
        "คั่วเครื่องเทศด้วยไฟอ่อนจนมีกลิ่นหอม",
        "เติมน้ำซุปและเครื่องปรุง ต้มให้เดือดแล้วช้อนฟอง",
        "ลดไฟ ตุ๋นจนเนื้อนุ่ม ตรวจรสและน้ำหนักผลผลิต"
      ]
    },
    {
      id: "sample-broth",
      name: "น้ำซุปเนื้อพื้นฐาน",
      category: "น้ำซุปและซอส",
      yield: "8 ลิตร",
      version: "v2.1",
      ingredients: [
        { name: "กระดูกวัว", amount: 3500, unit: "กรัม" },
        { name: "น้ำสะอาด", amount: 10000, unit: "มิลลิลิตร" },
        { name: "หัวไชเท้า", amount: 800, unit: "กรัม" },
        { name: "รากผักชี", amount: 60, unit: "กรัม" }
      ],
      steps: [
        "ลวกกระดูกและล้างคราบเลือดออกให้หมด",
        "เติมน้ำใหม่ ต้มไฟกลางและช้อนฟองสม่ำเสมอ",
        "ใส่ผักและสมุนไพร เคี่ยวต่อจนได้น้ำซุปเข้มข้น",
        "กรอง วัดปริมาตรผลผลิต และลดอุณหภูมิก่อนจัดเก็บ"
      ]
    },
    {
      id: "sample-chili",
      name: "พริกผัดประจำร้าน",
      category: "เครื่องเคียง",
      yield: "25 ถ้วย",
      version: "v1.0",
      ingredients: [
        { name: "พริกแห้งป่น", amount: 240, unit: "กรัม" },
        { name: "น้ำมันพืช", amount: 450, unit: "มิลลิลิตร" },
        { name: "กระเทียม", amount: 120, unit: "กรัม" },
        { name: "เกลือ", amount: 12, unit: "กรัม" }
      ],
      steps: [
        "อุ่นน้ำมันด้วยไฟอ่อนและเจียวกระเทียมจนเหลืองอ่อน",
        "ปิดไฟ พักให้อุณหภูมิลดลงเล็กน้อยก่อนใส่พริก",
        "คนให้ทั่ว ปรุงเกลือ และพักให้เย็นก่อนแบ่งบรรจุ"
      ]
    }
  ];

  const measurementKnowledge = [
    {
      id: "soy-sauce",
      name: "ซีอิ๊วขาว",
      aliases: ["ซีอิ๊ว", "ซอสถั่วเหลือง"],
      state: "ของเหลวพร้อมใช้",
      sourceType: "measured",
      sourceLabel: "ชั่งจริง NNTN",
      confidence: "สูง",
      source: "ตัวอย่าง mock: ชั่ง 5 ครั้งโดยครัวกลาง",
      gramsPerUnit: { "มิลลิลิตร": 1.13, "ลิตร": 1130, "ช้อนโต๊ะ": 16.95, "ช้อนชา": 5.65 }
    },
    {
      id: "garlic",
      name: "กระเทียม",
      aliases: ["กระเทียมกลีบ"],
      state: "กลีบปอกเปลือก ขนาดกลาง",
      sourceType: "measured",
      sourceLabel: "ชั่งจริง NNTN",
      confidence: "สูง",
      source: "ตัวอย่าง mock: ค่าเฉลี่ยจากกระเทียม 20 กลีบ",
      gramsPerUnit: { "ชิ้น": 4.2 }
    },
    {
      id: "vegetable-oil",
      name: "น้ำมันพืช",
      aliases: ["น้ำมัน", "น้ำมันถั่วเหลือง"],
      state: "ของเหลว อุณหภูมิห้อง",
      sourceType: "manufacturer",
      sourceLabel: "ข้อมูลผู้ผลิต",
      confidence: "สูง",
      source: "ตัวอย่าง mock: เอกสารคุณสมบัติผลิตภัณฑ์",
      gramsPerUnit: { "มิลลิลิตร": 0.91, "ลิตร": 910, "ช้อนโต๊ะ": 13.65, "ช้อนชา": 4.55 }
    },
    {
      id: "granulated-sugar",
      name: "น้ำตาลทราย",
      aliases: ["น้ำตาล"],
      state: "เม็ด ตักหลวม ไม่อัดแน่น",
      sourceType: "estimated",
      sourceLabel: "ค่าประมาณอ้างอิง",
      confidence: "ปานกลาง",
      source: "ตัวอย่าง mock: ตารางอ้างอิงทั่วไป ยังไม่ได้ชั่งจริง",
      gramsPerUnit: { "ช้อนโต๊ะ": 12.5, "ช้อนชา": 4.17 }
    },
    {
      id: "ground-pepper",
      name: "พริกไทยป่น",
      aliases: ["พริกไทย"],
      state: "ผง ตักเสมอขอบ",
      sourceType: "estimated",
      sourceLabel: "ค่าประมาณอ้างอิง",
      confidence: "ปานกลาง",
      source: "ตัวอย่าง mock: ตารางอ้างอิงทั่วไป ยังไม่ได้ชั่งจริง",
      gramsPerUnit: { "ช้อนโต๊ะ": 6.9, "ช้อนชา": 2.3 }
    },
    {
      id: "water",
      name: "น้ำสะอาด",
      aliases: ["น้ำเปล่า", "น้ำ"],
      state: "ของเหลว อุณหภูมิห้อง",
      sourceType: "estimated",
      sourceLabel: "ค่าประมาณมาตรฐาน",
      confidence: "สูง",
      source: "ตัวอย่าง mock: ใช้ความหนาแน่นประมาณ 1 กรัม/มิลลิลิตร",
      gramsPerUnit: { "มิลลิลิตร": 1, "ลิตร": 1000, "ช้อนโต๊ะ": 15, "ช้อนชา": 5 }
    }
  ];

  const knowledgeTypeLabels = {
    measured: "ชั่งจริง NNTN",
    manufacturer: "ข้อมูลผู้ผลิต",
    estimated: "ค่าประมาณอ้างอิง",
    standard: "หน่วยน้ำหนักตรง",
    missing: "ยังไม่มีข้อมูล"
  };

  const recipeDependencies = {
    stew: { name: "เนื้อตุ๋นสมุนไพร", code: "RCP-001", version: "v1.3", type: "สูตรหลัก", ready: true },
    broth: { name: "น้ำซุปเนื้อพื้นฐาน", code: "SRCP-004", version: "v2.1", type: "สูตรเตรียม", ready: true },
    rice: { name: "ข้าวสวยมาตรฐาน", code: "SRCP-010", version: "v1.2", type: "สูตรเตรียม", ready: true },
    chili: { name: "พริกผัดประจำร้าน", code: "SRCP-012", version: "v1.0", type: "สูตรเตรียม", ready: false, issue: "รอชั่ง conversion ที่สาขา" },
    noodle: { name: "เส้นลวกมาตรฐาน", code: "SRCP-018", version: "v1.1", type: "สูตรเตรียม", ready: true },
    garnish: { name: "ชุดผักโรย", code: "PREP-006", version: "v1.0", type: "ของเตรียม", ready: true },
    packaging: { name: "ชุดบรรจุ Delivery", code: "PKG-003", version: "v1.4", type: "บรรจุภัณฑ์", ready: false, issue: "รอยืนยัน supplier สาขา" }
  };

  const branchMenuItems = [
    { id: "rice-stew", name: "ข้าวหน้าเนื้อตุ๋น", description: "เมนูขายหลักพร้อมข้าวและเครื่องเคียง", price: 89, dependencies: ["stew", "broth", "rice", "chili", "garnish"] },
    { id: "stew-soup", name: "เกาเหลาเนื้อตุ๋น", description: "เนื้อตุ๋นและน้ำซุป ไม่มีข้าว", price: 99, dependencies: ["stew", "broth", "chili", "garnish"] },
    { id: "stew-noodle", name: "บะหมี่เนื้อตุ๋น", description: "บะหมี่ลวก เนื้อตุ๋น และน้ำซุป", price: 95, dependencies: ["stew", "broth", "noodle", "chili", "garnish"] },
    { id: "rice-delivery", name: "ข้าวหน้าเนื้อตุ๋น Delivery", description: "สูตรและบรรจุภัณฑ์สำหรับขนส่ง", price: 109, dependencies: ["stew", "broth", "rice", "chili", "packaging"] },
    { id: "family-set", name: "ชุดเนื้อตุ๋นครอบครัว", description: "ชุดแบ่งรับประทาน 3–4 คน", price: 329, dependencies: ["stew", "broth", "chili", "packaging"] }
  ];

  const branchMenuSets = {
    full: ["rice-stew", "stew-soup", "stew-noodle", "rice-delivery", "family-set"],
    express: ["rice-stew", "stew-soup", "stew-noodle"],
    delivery: ["rice-stew", "rice-delivery", "family-set", "stew-soup"]
  };

  const branchProfiles = {
    ari: { name: "อารีย์", set: "full", format: "Standalone · 64 ตร.ม.", equipment: "หม้อตุ๋น 4 · เตา 4 หัว", costReady: true },
    bangna: { name: "บางนา", set: "delivery", format: "Cloud kitchen · 36 ตร.ม.", equipment: "หม้อตุ๋น 3 · เตา 2 หัว", costReady: true },
    chiangmai: { name: "เชียงใหม่", set: "express", format: "Shop house · 48 ตร.ม.", equipment: "หม้อตุ๋น 3 · เตา 3 หัว", costReady: false },
    "new-branch": { name: "สาขาใหม่ · พระราม 9", set: "express", format: "Food court · 28 ตร.ม.", equipment: "หม้อตุ๋น 2 · เตา 2 หัว", costReady: false }
  };

  const menuSetLabels = { full: "Full Menu", express: "Express", delivery: "Delivery Only" };

  const templateNames = {
    master: "A4 Master Recipe",
    kitchen: "A5 Kitchen Guide",
    booklet: "Cookbook Booklet",
    routing: "SKU & Routing Sheet"
  };

  const sellableStatusLabels = { draft: "แบบร่าง", active: "เปิดใช้งาน", inactive: "ปิดใช้งาน" };
  const channelLabels = { store: "หน้าร้าน", grab: "Grab", lineman: "LINE MAN" };
  const branchRouteLabels = { assignment: "ตาม Menu Assignment", all: "ทุกสาขา", selected: "เฉพาะสาขาที่เลือก" };

  const form = document.querySelector("#recipe-form");
  const ingredientList = document.querySelector("#ingredient-list");
  const ingredientTemplate = document.querySelector("#ingredient-template");
  const variantList = document.querySelector("#variant-list");
  const variantTemplate = document.querySelector("#variant-template");
  const variantPartTemplate = document.querySelector("#variant-part-template");
  const variantEmpty = document.querySelector("#variant-empty");
  const variantPanel = document.querySelector("#variant-panel");
  const variantStatusSummary = document.querySelector("#variant-status-summary");
  const variantStatusWarning = document.querySelector("#variant-status-warning");
  const costVariantField = document.querySelector("#cost-variant-field");
  const costVariantSelect = document.querySelector("#cost-variant-select");
  const costModeMessage = document.querySelector("#cost-mode-message");
  const historyList = document.querySelector("#history-list");
  const toast = document.querySelector("#toast");
  const costKnowledgeEmpty = document.querySelector("#cost-knowledge-empty");
  const costKnowledgeTable = document.querySelector("#cost-knowledge-table");
  const costKnowledgeBody = document.querySelector("#cost-knowledge-body");
  const knowledgeDetail = document.querySelector("#knowledge-detail");
  const printModal = document.querySelector("#print-modal");
  const printDocument = document.querySelector("#print-document");
  const recipePicker = document.querySelector("#print-recipe-picker");
  const printPreviewLabel = document.querySelector("#print-preview-label");
  const printPageCount = document.querySelector("#print-page-count");
  const printStatusSelect = document.querySelector("#print-status");
  const selectedRecipeIds = new Set(["current", ...sampleRecipes.map((recipe) => recipe.id)]);
  const kitchenPrintRecipes = new Map();
  const menuCatalog = document.querySelector("#menu-catalog");
  const dependencyGroups = document.querySelector("#dependency-groups");
  let selectedBranchMenuIds = new Set(branchMenuSets.express);
  let variantSequence = 0;
  let toastTimer;
  let lastFocusedElement;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function recipeMode() {
    return document.querySelector('input[name="recipe-mode"]:checked')?.value || "single";
  }

  function routeRowsFromContainer(container, enabledSelector, skuSelector) {
    return [...container.querySelectorAll(enabledSelector)].map((checkbox) => ({
      channel: checkbox.dataset.channel,
      enabled: checkbox.checked,
      externalSku: container.querySelector(`${skuSelector}[data-channel="${checkbox.dataset.channel}"]`)?.value || ""
    }));
  }

  function currentSingleSellable() {
    const container = document.querySelector("#single-menu-meta");
    return {
      status: document.querySelector("#single-status").value,
      sku: document.querySelector("#single-sku").value.trim(),
      station: document.querySelector("#single-station").value,
      branchRoute: document.querySelector("#single-branch-route").value,
      routes: routeRowsFromContainer(container, ".single-route-enabled", ".single-route-sku")
    };
  }

  function updateRemoveButtons() {
    const rows = ingredientList.querySelectorAll(".ingredient-row");
    rows.forEach((row) => {
      const button = row.querySelector(".remove-ingredient");
      button.disabled = rows.length === 1;
      button.title = rows.length === 1 ? "ต้องมีส่วนผสมอย่างน้อยหนึ่งรายการ" : "ลบส่วนผสม";
    });
  }

  function addIngredient(values = {}) {
    const fragment = ingredientTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".ingredient-row");

    row.querySelector(".ingredient-name").value = values.name || "";
    row.querySelector(".ingredient-amount").value = values.amount || "";
    row.querySelector(".ingredient-unit").value = values.unit || "กรัม";

    row.querySelector(".remove-ingredient").addEventListener("click", () => {
      row.remove();
      updateRemoveButtons();
      renderCostKnowledge();
      showToast("ลบรายการส่วนผสมแล้ว (ยังไม่มีการบันทึกจริง)");
    });

    ingredientList.appendChild(fragment);
    updateRemoveButtons();
    renderCostKnowledge();
  }

  function updateVariantPartButtons(card) {
    const rows = card.querySelectorAll(".variant-part-row");
    rows.forEach((row) => {
      const button = row.querySelector(".remove-variant-part");
      button.disabled = rows.length === 1;
      button.title = rows.length === 1 ? "ต้องมีช่องสำหรับเนื้ออย่างน้อยหนึ่งรายการ" : "ลบชิ้นส่วน";
    });
  }

  function addVariantPart(card, values = {}) {
    const fragment = variantPartTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".variant-part-row");
    row.querySelector(".variant-part-name").value = values.name || "";
    row.querySelector(".variant-part-amount").value = values.amount || "";
    row.querySelector(".variant-part-unit").value = values.unit || "กรัม";
    row.querySelector(".remove-variant-part").addEventListener("click", () => {
      row.remove();
      updateVariantPartButtons(card);
      renderCostKnowledge();
      showToast("ลบชิ้นส่วนออกจากตัวเลือกแล้ว");
    });
    card.querySelector(".variant-part-list").appendChild(fragment);
    updateVariantPartButtons(card);
  }

  function variantRowsFromForm() {
    return [...variantList.querySelectorAll(".variant-card")].map((card) => ({
      id: card.dataset.variantId,
      name: card.querySelector(".variant-name").value,
      price: card.querySelector(".variant-price").value,
      status: card.querySelector(".variant-status").value,
      code: card.querySelector(".variant-code").value,
      sku: card.querySelector(".variant-sku").value,
      station: card.querySelector(".variant-station").value,
      branchRoute: card.querySelector(".variant-branch-route").value,
      routes: routeRowsFromContainer(card, ".variant-route-enabled", ".variant-route-sku"),
      note: card.querySelector(".variant-note").value,
      parts: [...card.querySelectorAll(".variant-part-row")].map((row) => ({
        name: row.querySelector(".variant-part-name").value,
        amount: row.querySelector(".variant-part-amount").value,
        unit: row.querySelector(".variant-part-unit").value
      }))
    }));
  }

  function updateCurrentRecipeSelection() {
    [...selectedRecipeIds].forEach((id) => {
      if (id === "current" || id.startsWith("current--")) selectedRecipeIds.delete(id);
    });
    buildVariantRecipes(currentRecipe(), variantRowsFromForm(), { mode: recipeMode() })
      .forEach((recipe) => selectedRecipeIds.add(recipe.id));
  }

  function syncVariantConsumers({ resetPrintSelection = false } = {}) {
    const previousSelection = costVariantSelect.value;
    const allVariants = normalizeVariants(variantRowsFromForm());
    const variants = allVariants.filter((variant) => variant.active);
    const options = [new Option("สูตรแม่เท่านั้น", "")];
    variants.forEach((variant) => options.push(new Option(
      `${variant.name}${variant.sku ? ` · ${variant.sku}` : ""}${variant.price ? ` · ฿${variant.price}` : ""}`,
      variant.id
    )));
    costVariantSelect.replaceChildren(...options);
    costVariantField.hidden = recipeMode() !== "variant" || variants.length === 0;
    costVariantSelect.value = variants.some((variant) => variant.id === previousSelection)
      ? previousSelection
      : (variants[0]?.id || "");
    variantEmpty.hidden = variantList.children.length > 0;
    variantStatusSummary.hidden = allVariants.length === 0;
    document.querySelector("#variant-active-count").textContent = allVariants.filter((variant) => variant.status === "active").length;
    document.querySelector("#variant-draft-count").textContent = allVariants.filter((variant) => variant.status === "draft").length;
    document.querySelector("#variant-inactive-count").textContent = allVariants.filter((variant) => variant.status === "inactive").length;
    variantStatusWarning.hidden = recipeMode() !== "variant" || allVariants.length === 0 || variants.length > 0;
    document.querySelector("#recipe-mode-help").textContent = recipeMode() === "variant"
      ? `แต่ละตัวเลือกมี SKU และ Routing ของตัวเอง${variantList.children.length ? ` ข้อมูล ${variantList.children.length} ตัวเลือกยังอยู่ในหน้านี้` : ""}`
      : `ส่วนผสมที่กรอกคือสูตรสมบูรณ์ของเมนูนี้${variantList.children.length ? ` ข้อมูลตัวเลือก ${variantList.children.length} รายการถูกซ่อนไว้และยังไม่ถูกลบ` : ""}`;
    costModeMessage.textContent = recipeMode() === "single"
      ? "กำลังคำนวณส่วนผสมทั้งหมดของเมนูเดี่ยว"
      : variants.length > 0
        ? "กำลังรวมส่วนผสมร่วมกับตัวเลือกที่เปิดใช้งาน"
        : "ยังไม่มีตัวเลือกที่เปิดใช้งาน ตารางนี้จะแสดงเฉพาะส่วนผสมร่วม";
    if (resetPrintSelection) updateCurrentRecipeSelection();
    renderCostKnowledge();
  }

  function addVariant(values = {}, { sync = true } = {}) {
    const fragment = variantTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".variant-card");
    const variantId = values.id || `variant-${++variantSequence}`;
    card.dataset.variantId = variantId;
    card.querySelector(".variant-name").value = values.name || "";
    card.querySelector(".variant-price").value = values.price || "";
    card.querySelector(".variant-status").value = values.status || (values.active === false ? "inactive" : "draft");
    card.querySelector(".variant-code").value = values.code || "";
    card.querySelector(".variant-sku").value = values.sku || "";
    card.querySelector(".variant-station").value = values.station || "กระทะ";
    card.querySelector(".variant-branch-route").value = values.branchRoute || "assignment";
    card.querySelector(".variant-note").value = values.note || "";

    (values.routes || []).forEach((route) => {
      const enabled = card.querySelector(`.variant-route-enabled[data-channel="${route.channel}"]`);
      const sku = card.querySelector(`.variant-route-sku[data-channel="${route.channel}"]`);
      if (enabled) enabled.checked = route.enabled === true;
      if (sku) sku.value = route.externalSku || "";
    });

    card.querySelector(".add-variant-part").addEventListener("click", () => {
      addVariantPart(card);
      card.querySelector(".variant-part-list .variant-part-row:last-child .variant-part-name")?.focus();
      renderCostKnowledge();
    });
    card.querySelector(".remove-variant").addEventListener("click", () => {
      card.remove();
      syncVariantConsumers({ resetPrintSelection: true });
      showToast("ลบตัวเลือกเนื้อแล้ว");
    });
    card.querySelector(".variant-name").addEventListener("input", () => syncVariantConsumers());
    card.querySelector(".variant-price").addEventListener("input", () => syncVariantConsumers());
    card.querySelector(".variant-status").addEventListener("change", () => syncVariantConsumers({ resetPrintSelection: true }));
    card.querySelector(".generate-variant-sku").addEventListener("click", () => {
      const position = [...variantList.children].indexOf(card) + 1;
      const codeInput = card.querySelector(".variant-code");
      if (!codeInput.value.trim()) codeInput.value = `V${String(position).padStart(2, "0")}`;
      card.querySelector(".variant-sku").value = suggestSku(document.querySelector("#recipe-code").value, codeInput.value);
      syncVariantConsumers();
      showToast("สร้าง Internal SKU ตัวอย่างแล้ว");
    });

    variantList.appendChild(fragment);
    const appendedCard = variantList.lastElementChild;
    (values.parts?.length ? values.parts : [{}]).forEach((part) => addVariantPart(appendedCard, part));
    if (sync) syncVariantConsumers({ resetPrintSelection: true });
    return appendedCard;
  }

  function applyRecipeMode({ resetPrintSelection = true } = {}) {
    const variantMode = recipeMode() === "variant";
    variantPanel.hidden = !variantMode;
    document.querySelector("#single-menu-meta").hidden = variantMode;
    document.querySelector("#single-sku-field").hidden = variantMode;
    document.querySelector("#generate-single-sku").hidden = variantMode;
    document.querySelector("#ingredients-title").textContent = variantMode ? "ส่วนผสมร่วม" : "ส่วนผสม";
    document.querySelector("#ingredients-description").textContent = variantMode
      ? "ใส่เฉพาะวัตถุดิบที่ทุกตัวเลือกใช้ร่วมกัน"
      : "ส่วนผสมทั้งหมดของเมนูเดี่ยว";
    document.querySelector("#method-step-number").textContent = variantMode ? "04" : "03";
    document.querySelector("#cost-step-number").textContent = variantMode ? "05" : "04";
    syncVariantConsumers({ resetPrintSelection });
  }

  function renderHistory() {
    const fragment = document.createDocumentFragment();

    historyEntries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "history-item";

      const title = document.createElement("div");
      title.className = "history-title";

      const version = document.createElement("strong");
      version.textContent = entry.version;

      const date = document.createElement("time");
      date.textContent = entry.date;

      const meta = document.createElement("p");
      meta.className = "history-meta";
      meta.textContent = `${entry.editor} · ${entry.note}`;

      title.append(version, date);
      item.append(title, meta);
      fragment.appendChild(item);
    });

    historyList.replaceChildren(fragment);
  }

  function normalizeIngredientName(value) {
    return String(value || "").trim().toLocaleLowerCase("th-TH").replace(/\s+/g, " ");
  }

  function findMeasurementProfile(name) {
    const normalizedName = normalizeIngredientName(name);
    if (!normalizedName) return null;
    return measurementKnowledge.find((profile) =>
      [profile.name, ...profile.aliases].some((candidate) => normalizeIngredientName(candidate) === normalizedName)
    ) || null;
  }

  function ingredientRowsFromForm() {
    return [...ingredientList.querySelectorAll(".ingredient-row")]
      .map((row) => ({
        name: row.querySelector(".ingredient-name").value.trim(),
        amount: row.querySelector(".ingredient-amount").value,
        unit: row.querySelector(".ingredient-unit").value
      }))
      .filter((ingredient) => ingredient.name || ingredient.amount);
  }

  function normalizeIngredientWeight(ingredient) {
    const amount = Number.parseFloat(ingredient.amount);
    const massFactors = { "กรัม": 1, "กิโลกรัม": 1000 };

    if (!Number.isFinite(amount)) {
      return {
        ...ingredient,
        grams: null,
        sourceType: "missing",
        sourceLabel: knowledgeTypeLabels.missing,
        confidence: "—",
        formula: "กรอกปริมาณเพื่อคำนวณ",
        detail: "ยังไม่มีปริมาณสำหรับคำนวณน้ำหนัก"
      };
    }

    if (massFactors[ingredient.unit]) {
      const grams = amount * massFactors[ingredient.unit];
      return {
        ...ingredient,
        grams,
        sourceType: "standard",
        sourceLabel: knowledgeTypeLabels.standard,
        confidence: "แน่นอน",
        formula: `${amount} ${ingredient.unit} × ${massFactors[ingredient.unit]} = ${formatNumber(grams)} กรัม`,
        detail: "หน่วย SOP เป็นน้ำหนักอยู่แล้ว จึงไม่ต้องใช้ density หรือค่าเฉลี่ยของวัตถุดิบ"
      };
    }

    const profile = findMeasurementProfile(ingredient.name);
    const gramsPerUnit = profile?.gramsPerUnit?.[ingredient.unit];
    if (!profile || !Number.isFinite(gramsPerUnit)) {
      return {
        ...ingredient,
        grams: null,
        sourceType: "missing",
        sourceLabel: knowledgeTypeLabels.missing,
        confidence: "ต้องชั่ง",
        formula: "ไม่สามารถคำนวณได้",
        detail: profile
          ? `พบข้อมูล ${profile.name} แต่ยังไม่มี conversion สำหรับหน่วย ${ingredient.unit}`
          : "ยังไม่มี Measurement Knowledge ของวัตถุดิบนี้ ระบบจะไม่เดาน้ำหนักให้"
      };
    }

    const grams = amount * gramsPerUnit;
    return {
      ...ingredient,
      grams,
      sourceType: profile.sourceType,
      sourceLabel: profile.sourceLabel,
      confidence: profile.confidence,
      profile,
      formula: `${amount} ${ingredient.unit} × ${formatNumber(gramsPerUnit)} กรัม/${ingredient.unit} = ${formatNumber(grams)} กรัม`,
      detail: `${profile.state} · ${profile.source}`
    };
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "—";
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function showKnowledgeDetail(result) {
    knowledgeDetail.hidden = false;
    knowledgeDetail.innerHTML = `
      <strong>${escapeHtml(result.name || "วัตถุดิบยังไม่ระบุชื่อ")}</strong><br>
      ${escapeHtml(result.formula)}<br>
      แหล่งข้อมูล: ${escapeHtml(result.detail)} · ความมั่นใจ: ${escapeHtml(result.confidence)}`;
  }

  function costIngredientsFromForm() {
    const ingredients = ingredientRowsFromForm();
    if (recipeMode() === "single") return ingredients;
    if (!costVariantSelect.value) return ingredients;
    const selectedVariant = normalizeVariants(variantRowsFromForm())
      .find((variant) => variant.id === costVariantSelect.value && variant.active);
    return selectedVariant ? [...ingredients, ...selectedVariant.parts] : ingredients;
  }

  function renderCostKnowledge() {
    const ingredients = costIngredientsFromForm();
    const results = ingredients.map(normalizeIngredientWeight);
    costKnowledgeEmpty.hidden = results.length > 0;
    costKnowledgeTable.hidden = results.length === 0;
    knowledgeDetail.hidden = true;

    costKnowledgeBody.innerHTML = results.map((result, index) => `
      <tr>
        <td><strong>${escapeHtml(result.name || "ยังไม่ระบุชื่อ")}</strong><small>${escapeHtml(result.profile?.state || "")}</small></td>
        <td>${escapeHtml(result.amount || "—")} ${escapeHtml(result.unit)}</td>
        <td><strong class="normalized-weight">${result.grams === null ? "รอข้อมูล" : `${formatNumber(result.grams)} กรัม`}</strong><small class="conversion-formula">${escapeHtml(result.formula)}</small></td>
        <td><span class="knowledge-badge is-${escapeHtml(result.sourceType)}">${escapeHtml(result.sourceLabel)}</span><small class="conversion-formula">ความมั่นใจ ${escapeHtml(result.confidence)}</small></td>
        <td><button class="cost-detail-button" type="button" data-result-index="${index}" aria-label="ดูรายละเอียดการแปลง ${escapeHtml(result.name || "วัตถุดิบ")}">i</button></td>
      </tr>`).join("");

    costKnowledgeBody.querySelectorAll(".cost-detail-button").forEach((button) => {
      button.addEventListener("click", () => showKnowledgeDetail(results[Number(button.dataset.resultIndex)]));
    });
  }

  function renderKnowledgeSummary() {
    const counts = measurementKnowledge.reduce((summary, profile) => {
      summary[profile.sourceType] += 1;
      return summary;
    }, { measured: 0, manufacturer: 0, estimated: 0 });

    document.querySelector("#knowledge-measured-count").textContent = counts.measured;
    document.querySelector("#knowledge-manufacturer-count").textContent = counts.manufacturer;
    document.querySelector("#knowledge-estimated-count").textContent = counts.estimated;
  }

  function sameMenuSelection(menuIds) {
    return menuIds.length === selectedBranchMenuIds.size && menuIds.every((id) => selectedBranchMenuIds.has(id));
  }

  function activeMenuSetKey() {
    return Object.entries(branchMenuSets).find(([, menuIds]) => sameMenuSelection(menuIds))?.[0] || "custom";
  }

  function selectedBranchProfile() {
    return branchProfiles[document.querySelector("#branch-select").value];
  }

  function selectedBranchMenus() {
    return branchMenuItems.filter((menuItem) => selectedBranchMenuIds.has(menuItem.id));
  }

  function requiredDependencies() {
    const ids = new Set(selectedBranchMenus().flatMap((menuItem) => menuItem.dependencies));
    return [...ids].map((id) => ({ id, ...recipeDependencies[id] }));
  }

  function updateMenuSetControls() {
    const activeSet = activeMenuSetKey();
    document.querySelectorAll('input[name="menu-set"]').forEach((radio) => {
      radio.checked = radio.value === activeSet;
    });
  }

  function renderMenuCatalog() {
    menuCatalog.innerHTML = branchMenuItems.map((menuItem) => `
      <div class="menu-item-card">
        <input id="menu-${escapeHtml(menuItem.id)}" type="checkbox" value="${escapeHtml(menuItem.id)}" ${selectedBranchMenuIds.has(menuItem.id) ? "checked" : ""}>
        <label for="menu-${escapeHtml(menuItem.id)}">
          <h4>${escapeHtml(menuItem.name)}</h4>
          <p>${escapeHtml(menuItem.description)}</p>
          <div class="menu-card-meta"><span>฿${escapeHtml(menuItem.price)}</span><span>${menuItem.dependencies.length} dependencies</span></div>
          <div class="dependency-chips">${menuItem.dependencies.slice(0, 3).map((id) => `<span class="dependency-chip">${escapeHtml(recipeDependencies[id].name)}</span>`).join("")}${menuItem.dependencies.length > 3 ? `<span class="dependency-chip">+${menuItem.dependencies.length - 3}</span>` : ""}</div>
        </label>
      </div>`).join("");

    menuCatalog.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedBranchMenuIds.add(checkbox.value);
        else selectedBranchMenuIds.delete(checkbox.value);
        updateMenuSetControls();
        renderBranchSummary();
      });
    });
  }

  function renderDependencyGroups(dependencies) {
    if (dependencies.length === 0) {
      dependencyGroups.innerHTML = '<div class="dependency-empty">ยังไม่ได้เลือกเมนู ระบบจึงยังไม่ดึงสูตรใดให้สาขา</div>';
      return;
    }

    const groups = dependencies.reduce((result, dependency) => {
      (result[dependency.type] ||= []).push(dependency);
      return result;
    }, {});

    dependencyGroups.innerHTML = Object.entries(groups).map(([type, items]) => `
      <section class="dependency-group">
        <h4>${escapeHtml(type)}</h4>
        <ul class="dependency-list">${items.map((item) => `
          <li><span>${escapeHtml(item.name)} <small>${escapeHtml(item.code)} · ${escapeHtml(item.version)}</small></span><span class="rollout-status ${item.ready ? "is-ready" : "is-review"}">${item.ready ? "พร้อม" : "ต้องเตรียม"}</span></li>`).join("")}</ul>
      </section>`).join("");
  }

  function renderReadiness(profile, dependencies) {
    const missingDependencies = dependencies.filter((dependency) => !dependency.ready);
    const checks = [
      { label: "เลือก Menu Item อย่างน้อยหนึ่งรายการ", ready: selectedBranchMenuIds.size > 0 },
      { label: "ดึง Master Recipe และสูตรย่อยครบ", ready: dependencies.length > 0 },
      { label: "Measurement Knowledge พร้อมใช้", ready: missingDependencies.length === 0 },
      { label: "ราคาวัตถุดิบและ Supplier ของสาขา", ready: profile.costReady }
    ];
    const readyCount = checks.filter((check) => check.ready).length;
    const readinessPercent = Math.round((readyCount / checks.length) * 100);

    document.querySelector("#readiness-progress-bar").style.width = `${readinessPercent}%`;
    document.querySelector("#readiness-message").textContent = `พร้อม ${readyCount}/${checks.length} รายการ · ${readinessPercent}%`;
    document.querySelector("#readiness-checks").innerHTML = checks.map((check) => `<div class="readiness-check ${check.ready ? "" : "is-pending"}">${escapeHtml(check.label)}</div>`).join("");
    document.querySelector("#missing-readiness-count").textContent = missingDependencies.length + (profile.costReady ? 0 : 1);
  }

  function renderBranchSummary() {
    const profile = selectedBranchProfile();
    const dependencies = requiredDependencies();
    const activeSet = activeMenuSetKey();
    const brandName = document.querySelector("#brand-select").selectedOptions[0].textContent;

    document.querySelector("#branch-profile-title").textContent = profile.name;
    document.querySelector("#branch-profile-subtitle").textContent = `${brandName} · ${menuSetLabels[activeSet] || "Custom"}`;
    document.querySelector("#branch-format-value").textContent = profile.format;
    document.querySelector("#branch-equipment-value").textContent = profile.equipment;
    document.querySelector("#selected-menu-count").textContent = selectedBranchMenuIds.size;
    document.querySelector("#required-recipe-count").textContent = dependencies.length;
    document.querySelector("#new-branch-set-cell").textContent = menuSetLabels[activeSet] || "Custom";
    document.querySelector("#new-branch-menu-count-cell").textContent = selectedBranchMenuIds.size;
    renderDependencyGroups(dependencies);
    renderReadiness(profile, dependencies);
  }

  function applyBranchMenuSet(setKey) {
    selectedBranchMenuIds = new Set(branchMenuSets[setKey] || []);
    renderMenuCatalog();
    updateMenuSetControls();
    renderBranchSummary();
  }

  function switchWorkspace(targetId) {
    document.querySelector("#recipe-workspace").hidden = targetId !== "recipe-workspace";
    document.querySelector("#branch-workspace").hidden = targetId !== "branch-workspace";
    document.querySelector("#import-workspace").hidden = targetId !== "import-workspace";
    document.querySelectorAll(".workspace-tab").forEach((tab) => {
      const active = tab.dataset.workspaceTarget === targetId;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    if (targetId === "branch-workspace") renderBranchSummary();
  }

  function currentRecipe() {
    const ingredients = [...ingredientList.querySelectorAll(".ingredient-row")]
      .map((row) => ({
        name: row.querySelector(".ingredient-name").value.trim(),
        amount: row.querySelector(".ingredient-amount").value,
        unit: row.querySelector(".ingredient-unit").value
      }))
      .filter((ingredient) => ingredient.name || ingredient.amount);

    const steps = document.querySelector("#recipe-method").value
      .split("\n")
      .map((step) => step.replace(/^\s*(?:\d+[.)]|[-•])\s*/, "").trim())
      .filter(Boolean);

    return {
      id: "current",
      name: document.querySelector("#recipe-name").value.trim() || "สูตรใหม่ (ยังไม่ตั้งชื่อ)",
      code: document.querySelector("#recipe-code").value.trim(),
      category: document.querySelector("#recipe-category").value || "ยังไม่ระบุหมวด",
      yield: "1 สูตร",
      version: "ฉบับร่าง",
      sellable: currentSingleSellable(),
      ingredients: ingredients.length ? ingredients : [{ name: "ยังไม่ได้กรอกส่วนผสม", amount: "—", unit: "" }],
      steps: steps.length ? steps : ["ยังไม่ได้กรอกขั้นตอนวิธีทำ"]
    };
  }

  function allRecipes() {
    return [
      ...buildVariantRecipes(currentRecipe(), variantRowsFromForm(), { mode: recipeMode() }),
      ...sampleRecipes,
      ...kitchenPrintRecipes.values()
    ];
  }

  function renderRecipePicker() {
    const fragment = document.createDocumentFragment();

    allRecipes().forEach((recipe, index) => {
      const label = document.createElement("label");
      label.className = "recipe-choice";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = recipe.id;
      checkbox.checked = selectedRecipeIds.has(recipe.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedRecipeIds.add(recipe.id);
        else selectedRecipeIds.delete(recipe.id);
        syncKitchenPrintStatus();
        renderPrintPreview();
      });

      const copy = document.createElement("span");
      const name = document.createElement("strong");
      const meta = document.createElement("small");
      name.textContent = recipe.name;
      meta.textContent = recipe.id.startsWith("kitchen:")
        ? `${recipe.category} · ${recipe.kitchenStatus === "print_ready" ? "พร้อมทดลองพิมพ์" : "ฉบับร่างหน้าครัว"}`
        : recipe.id === "current" || recipe.id.startsWith("current--")
        ? recipe.variant
          ? `SKU ${recipe.variant.sku || "ยังไม่กำหนด"} · ฿${recipe.price || "—"}`
          : `SKU ${recipe.sellable?.sku || "ยังไม่กำหนด"} · เมนูเดี่ยว`
        : `${recipe.category} · ข้อมูลตัวอย่าง`;
      copy.append(name, meta);
      label.append(checkbox, copy);
      fragment.appendChild(label);
    });

    recipePicker.replaceChildren(fragment);
  }

  function selectedRecipes() {
    return allRecipes().filter((recipe) => selectedRecipeIds.has(recipe.id));
  }

  function printSettings() {
    const hasBlockedKitchenRecipe = selectedRecipes().some((recipe) => recipe.id.startsWith("kitchen:") && recipe.kitchenStatus !== "print_ready");
    return {
      template: document.querySelector('input[name="print-template"]:checked').value,
      multiplier: Math.max(0.1, Number.parseFloat(document.querySelector("#print-multiplier").value) || 1),
      status: hasBlockedKitchenRecipe ? "DRAFT — ข้อมูลไม่ครบ" : printStatusSelect.value,
      includeHistory: document.querySelector("#print-include-history").checked
    };
  }

  function syncKitchenPrintStatus() {
    const approvedOption = [...printStatusSelect.options].find((option) => option.value === "อนุมัติแล้ว");
    const hasBlockedKitchenRecipe = selectedRecipes().some((recipe) => recipe.id.startsWith("kitchen:") && recipe.kitchenStatus !== "print_ready");
    if (approvedOption) approvedOption.disabled = hasBlockedKitchenRecipe;
    if (hasBlockedKitchenRecipe && printStatusSelect.value === "อนุมัติแล้ว") printStatusSelect.value = "DRAFT";
  }

  function formatAmount(value, multiplier) {
    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount)) return escapeHtml(value || "—");
    const scaled = amount * multiplier;
    return escapeHtml(Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
  }

  function ingredientTable(recipe, multiplier) {
    const rows = recipe.ingredients.map((ingredient) => `
      <tr>
        <td>${escapeHtml(ingredient.name)}</td>
        <td>${formatAmount(ingredient.amount, multiplier)} ${escapeHtml(ingredient.unit)}</td>
      </tr>`).join("");

    return `
      <table class="print-ingredient-table">
        <thead><tr><th>วัตถุดิบ</th><th>ปริมาณ</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function methodList(recipe) {
    return `<ol class="print-method-list">${recipe.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`;
  }

  function revisionTable() {
    return `
      <section class="print-revision">
        <h2>Revision history</h2>
        <table><tbody>${historyEntries.map((entry) => `
          <tr><td><strong>${escapeHtml(entry.version)}</strong></td><td>${escapeHtml(entry.date)}</td><td>${escapeHtml(entry.editor)}</td><td>${escapeHtml(entry.note)}</td></tr>`).join("")}
        </tbody></table>
      </section>`;
  }

  function watermark(status) {
    return `<div class="print-watermark" aria-hidden="true">${escapeHtml(status)}</div>`;
  }

  function kitchenBlockerSummary(recipe) {
    if (!recipe.id.startsWith("kitchen:") || !recipe.blockers?.length) return "";
    return `<section class="print-blocker-summary"><strong>ข้อมูลที่ต้องตรวจให้ครบก่อนใช้จริง</strong><ul>${recipe.blockers.map((blocker) => `<li>${escapeHtml(blocker.itemName ? `${blocker.itemName}: ${blocker.message}` : blocker.message)}</li>`).join("")}</ul></section>`;
  }

  function sellableMetadata(recipe) {
    return recipe.variant || recipe.sellable || {
      status: "draft",
      sku: "",
      station: "",
      branchRoute: "assignment",
      routes: []
    };
  }

  function sellableMetaStrip(recipe) {
    const meta = sellableMetadata(recipe);
    return `
      <section class="print-sellable-strip">
        <div><span>Internal SKU</span><strong>${escapeHtml(meta.sku || "ยังไม่กำหนด")}</strong></div>
        <div><span>สถานะขาย</span><strong>${escapeHtml(sellableStatusLabels[meta.status] || "แบบร่าง")}</strong></div>
        <div><span>จุดครัว</span><strong>${escapeHtml(meta.station || "ยังไม่กำหนด")}</strong></div>
        <div><span>สาขา</span><strong>${escapeHtml(branchRouteLabels[meta.branchRoute] || "ตาม Menu Assignment")}</strong></div>
      </section>`;
  }

  function masterSheet(recipe, settings, pageNumber, totalPages) {
    return `
      <article class="print-sheet master-sheet" data-recipe-id="${escapeHtml(recipe.id)}">
        ${watermark(settings.status)}
        <header class="print-brand-line"><span class="print-brand">NNTN RECIPE STUDIO</span><span class="print-doc-type">MASTER RECIPE · A4</span></header>
        <section class="print-title-block"><h1>${escapeHtml(recipe.name)}</h1><p>${escapeHtml(recipe.category)} · เอกสารสูตรมาตรฐาน</p></section>
        ${sellableMetaStrip(recipe)}
        <section class="print-meta-strip">
          <div><span>Revision</span><strong>${escapeHtml(recipe.version)}</strong></div>
          <div><span>Batch</span><strong>×${escapeHtml(settings.multiplier)}</strong></div>
          <div><span>Yield</span><strong>${escapeHtml(recipe.yield)}</strong></div>
          <div><span>Status</span><strong>${escapeHtml(settings.status)}</strong></div>
        </section>
        <div class="print-recipe-grid">
          <section class="print-section"><h2>ส่วนผสม</h2>${ingredientTable(recipe, settings.multiplier)}</section>
          <section class="print-section"><h2>ขั้นตอนวิธีทำ</h2>${methodList(recipe)}</section>
        </div>
        <div class="print-notes-row">
          <div class="print-note-box"><strong>จุดควบคุมคุณภาพ</strong>ตรวจรสชาติ อุณหภูมิ และน้ำหนักผลผลิตก่อนส่งต่อ</div>
          <div class="print-note-box"><strong>หมายเหตุ</strong>พื้นที่สำหรับบันทึกเพิ่มเติม</div>
        </div>
        ${kitchenBlockerSummary(recipe)}
        ${settings.includeHistory ? revisionTable() : ""}
        <footer class="print-footer"><span>Mock document · ไม่ใช่เอกสารควบคุมจริง</span><span>${pageNumber} / ${totalPages}</span></footer>
      </article>`;
  }

  function kitchenSheet(recipe, settings, pageNumber, totalPages) {
    return `
      <article class="print-sheet kitchen-sheet" data-recipe-id="${escapeHtml(recipe.id)}">
        ${watermark(settings.status)}
        <header class="kitchen-header"><span class="print-doc-type">NNTN · KITCHEN GUIDE</span><h1>${escapeHtml(recipe.name)}</h1><p>${escapeHtml(recipe.category)} · ${escapeHtml(recipe.version)} · SKU ${escapeHtml(sellableMetadata(recipe).sku || "ยังไม่กำหนด")}</p></header>
        <div class="kitchen-batch"><span>รอบผลิต ×${escapeHtml(settings.multiplier)}</span><span>${escapeHtml(recipe.yield)}</span></div>
        <div class="print-recipe-grid">
          <section class="print-section"><h2>เตรียมวัตถุดิบ</h2>${ingredientTable(recipe, settings.multiplier)}</section>
          <section class="print-section"><h2>ลงมือทำ</h2>${methodList(recipe)}</section>
        </div>
        <div class="kitchen-checkline"><span>ผู้ทำ ____________________</span><span>ตรวจโดย ____________________</span></div>
        ${kitchenBlockerSummary(recipe)}
        <footer class="print-footer"><span>${escapeHtml(settings.status)} · ${settings.includeHistory ? `Revision ${escapeHtml(recipe.version)}` : ""}</span><span>${pageNumber} / ${totalPages}</span></footer>
      </article>`;
  }

  function bookletCover(recipes, settings) {
    return `
      <article class="print-sheet booklet-sheet booklet-cover">
        <span class="booklet-kicker">NNTN · KITCHEN COLLECTION</span>
        <div class="booklet-cover-title"><h1>ตำราสูตรอาหาร</h1><p>${recipes.length} สูตร · ฉบับสำหรับใช้งานภายใน</p></div>
        <div class="booklet-cover-meta">${escapeHtml(settings.status)} · Prototype edition · สิงหาคม 2026</div>
      </article>`;
  }

  function bookletToc(recipes) {
    return `
      <article class="print-sheet booklet-sheet booklet-toc">
        <header class="booklet-page-header"><span>NNTN RECIPE STUDIO</span><span>สารบัญ</span></header>
        <h1>สารบัญ</h1>
        <ol class="toc-list">${recipes.map((recipe, index) => `
          <li><span>${escapeHtml(recipe.name)}</span><span class="toc-dots"></span><strong>${index + 3}</strong></li>`).join("")}
        </ol>
        <footer class="print-footer"><span>Mock cookbook</span><span>2</span></footer>
      </article>`;
  }

  function bookletRecipeSheet(recipe, settings, pageNumber) {
    return `
      <article class="print-sheet booklet-sheet" data-recipe-id="${escapeHtml(recipe.id)}">
        ${watermark(settings.status)}
        <header class="booklet-page-header"><span>NNTN COOKBOOK</span><span>${escapeHtml(recipe.category)}</span></header>
        <section class="booklet-recipe-title"><h1>${escapeHtml(recipe.name)}</h1><p>${escapeHtml(recipe.version)} · ปริมาณ ${escapeHtml(recipe.yield)} · ตัวคูณ ×${escapeHtml(settings.multiplier)}</p></section>
        <div class="print-recipe-grid">
          <section class="print-section"><h2>ส่วนผสม</h2>${ingredientTable(recipe, settings.multiplier)}</section>
          <section class="print-section"><h2>วิธีทำ</h2>${methodList(recipe)}</section>
        </div>
        ${kitchenBlockerSummary(recipe)}
        ${settings.includeHistory ? `<div class="print-revision"><h2>Revision</h2><table><tbody><tr><td>${escapeHtml(recipe.version)}</td><td>ฉบับตัวอย่างสำหรับจัดวางตำรา</td></tr></tbody></table></div>` : ""}
        <footer class="print-footer"><span>${escapeHtml(settings.status)}</span><span>${pageNumber}</span></footer>
      </article>`;
  }

  function routingSheet(recipe, settings, pageNumber, totalPages) {
    const meta = sellableMetadata(recipe);
    const routes = meta.routes || [];
    const routeRows = routes.length
      ? routes.map((route) => `
          <tr>
            <td>${escapeHtml(channelLabels[route.channel] || route.channel)}</td>
            <td>${route.enabled ? "เปิด" : "ปิด"}</td>
            <td>${escapeHtml(route.externalSku || "ยังไม่กำหนด")}</td>
          </tr>`).join("")
      : '<tr><td colspan="3">ยังไม่มี Channel routing</td></tr>';

    return `
      <article class="print-sheet routing-sheet" data-recipe-id="${escapeHtml(recipe.id)}">
        ${watermark(settings.status)}
        <header class="print-brand-line"><span class="print-brand">NNTN RECIPE STUDIO</span><span class="print-doc-type">SKU &amp; ROUTING · A4</span></header>
        <section class="print-title-block"><h1>${escapeHtml(recipe.name)}</h1><p>ข้อมูลตัวอย่างสำหรับเชื่อมเมนูขายกับสาขา ช่องทาง และจุดครัว</p></section>
        ${sellableMetaStrip(recipe)}
        <section class="print-routing-section">
          <h2>ข้อมูลขาย</h2>
          <table class="print-routing-table"><tbody>
            <tr><th>รหัสสูตร</th><td>${escapeHtml(recipe.code || "ยังไม่กำหนด")}</td><th>Variant code</th><td>${escapeHtml(meta.code || "เมนูเดี่ยว")}</td></tr>
            <tr><th>ราคาขาย</th><td>${meta.price ? `฿${escapeHtml(meta.price)}` : "ยังไม่กำหนด"}</td><th>สถานะ</th><td>${escapeHtml(sellableStatusLabels[meta.status] || "แบบร่าง")}</td></tr>
          </tbody></table>
        </section>
        <section class="print-routing-section">
          <h2>Channel mapping</h2>
          <table class="print-routing-table"><thead><tr><th>ช่องทาง</th><th>สถานะ</th><th>External SKU</th></tr></thead><tbody>${routeRows}</tbody></table>
        </section>
        <section class="print-routing-note"><strong>Routing</strong><span>${escapeHtml(branchRouteLabels[meta.branchRoute] || "ตาม Menu Assignment")} · ${escapeHtml(meta.station || "ยังไม่กำหนดจุดครัว")}</span></section>
        <footer class="print-footer"><span>Mock mapping · ไม่ได้เชื่อม POS หรือสาขาจริง</span><span>${pageNumber} / ${totalPages}</span></footer>
      </article>`;
  }

  function renderPrintPreview() {
    const settings = printSettings();
    const recipes = selectedRecipes();
    let pages = [];

    if (recipes.length === 0) {
      printDocument.className = `print-document print-${settings.template}`;
      printDocument.innerHTML = '<div class="print-empty"><strong>ยังไม่ได้เลือกสูตร</strong><br>เลือกอย่างน้อยหนึ่งสูตรเพื่อสร้างตัวอย่างก่อนพิมพ์</div>';
      printPreviewLabel.textContent = `ตัวอย่าง ${templateNames[settings.template]}`;
      printPageCount.textContent = "0 หน้า";
      return;
    }

    if (settings.template === "master") {
      pages = recipes.map((recipe, index) => masterSheet(recipe, settings, index + 1, recipes.length));
    } else if (settings.template === "kitchen") {
      pages = recipes.map((recipe, index) => kitchenSheet(recipe, settings, index + 1, recipes.length));
    } else if (settings.template === "booklet") {
      pages = [
        bookletCover(recipes, settings),
        bookletToc(recipes),
        ...recipes.map((recipe, index) => bookletRecipeSheet(recipe, settings, index + 3))
      ];
    } else {
      pages = recipes.map((recipe, index) => routingSheet(recipe, settings, index + 1, recipes.length));
    }

    printDocument.className = `print-document print-${settings.template}`;
    printDocument.innerHTML = pages.join("");
    printPreviewLabel.textContent = `ตัวอย่าง ${templateNames[settings.template]}`;
    printPageCount.textContent = `${pages.length} หน้า`;
  }

  function openPrintCenter() {
    lastFocusedElement = document.activeElement;
    syncKitchenPrintStatus();
    renderRecipePicker();
    renderPrintPreview();
    printModal.hidden = false;
    document.body.classList.add("modal-open");
    document.querySelector("#close-print-center").focus();
  }

  function closePrintCenter() {
    printModal.hidden = true;
    document.body.classList.remove("modal-open", "printing");
    lastFocusedElement?.focus();
  }

  document.querySelector("#add-ingredient").addEventListener("click", () => {
    addIngredient();
    const newInput = ingredientList.lastElementChild?.querySelector(".ingredient-name");
    newInput?.focus();
  });

  document.querySelector("#add-variant").addEventListener("click", () => {
    const card = addVariant();
    card.querySelector(".variant-name")?.focus();
  });

  document.querySelectorAll('input[name="recipe-mode"]').forEach((control) => {
    control.addEventListener("change", () => applyRecipeMode({ resetPrintSelection: true }));
  });

  document.querySelector("#generate-single-sku").addEventListener("click", () => {
    document.querySelector("#single-sku").value = suggestSku(document.querySelector("#recipe-code").value, "SINGLE");
    showToast("สร้าง Internal SKU ตัวอย่างแล้ว");
  });

  document.querySelector("#load-variant-example").addEventListener("click", () => {
    document.querySelector('input[name="recipe-mode"][value="variant"]').checked = true;
    document.querySelector("#recipe-name").value = "กะเพรา";
    document.querySelector("#recipe-code").value = "KPR";
    document.querySelector("#recipe-category").value = "เมนูหลัก";
    ingredientList.replaceChildren();
    addIngredient({ name: "น้ำมันพืช", amount: "1", unit: "ช้อนโต๊ะ" });
    addIngredient({ name: "กระเทียม", amount: "10", unit: "กรัม" });
    addIngredient({ name: "ซอสกะเพรา", amount: "30", unit: "กรัม" });
    addIngredient({ name: "ใบกะเพรา", amount: "8", unit: "กรัม" });
    document.querySelector("#recipe-method").value = "1. ตั้งกระทะและผัดกระเทียมให้หอม\n2. ใส่เนื้อตาม Variant และผัดจนได้ระดับความสุกที่กำหนด\n3. ใส่ซอสกะเพราและใบกะเพรา ผัดให้เข้ากัน";

    variantList.replaceChildren();
    addVariant({ id: "minced-pork", name: "หมูสับ", price: "65", status: "active", code: "PORK", sku: "KPR-PORK", station: "กระทะ", branchRoute: "assignment", routes: [
      { channel: "store", enabled: true, externalSku: "FS-1041" },
      { channel: "grab", enabled: true, externalSku: "GR-2041" }
    ], parts: [
      { name: "หมูบด", amount: "120", unit: "กรัม" }
    ] }, { sync: false });
    addVariant({ id: "mixed-beef", name: "เนื้อรวม", price: "95", status: "active", code: "BF-MIX", sku: "KPR-BF-MIX", station: "กระทะ", branchRoute: "selected", routes: [
      { channel: "store", enabled: true, externalSku: "FS-1042" },
      { channel: "grab", enabled: true, externalSku: "GR-2042" },
      { channel: "lineman", enabled: false, externalSku: "LM-3042" }
    ], note: "ผัดเนื้อไม่เกิน 45 วินาที", parts: [
      { name: "เนื้อใบพาย", amount: "70", unit: "กรัม" },
      { name: "เนื้อน่องลาย", amount: "50", unit: "กรัม" }
    ] }, { sync: false });
    addVariant({ id: "chicken-thigh", name: "ไก่", price: "65", status: "inactive", code: "CHK", sku: "KPR-CHK", station: "กระทะ", branchRoute: "all", routes: [
      { channel: "store", enabled: false, externalSku: "FS-1043" }
    ], parts: [
      { name: "สะโพกไก่", amount: "120", unit: "กรัม" }
    ] }, { sync: false });
    applyRecipeMode({ resetPrintSelection: true });
    showToast("ใส่สูตรแม่กะเพรา พร้อม 2 ตัวเลือกเปิดและ 1 ตัวเลือกปิดแล้ว");
  });

  document.querySelector("#clear-form").addEventListener("click", () => {
    form.reset();
    ingredientList.replaceChildren();
    variantList.replaceChildren();
    addIngredient();
    addIngredient();
    applyRecipeMode({ resetPrintSelection: true });
    showToast("ล้างแบบฟอร์มแล้ว ไม่มีข้อมูลใดถูกส่งออกจากหน้านี้");
  });

  document.querySelector("#load-cost-example").addEventListener("click", () => {
    ingredientList.replaceChildren();
    addIngredient({ name: "ซีอิ๊วขาว", amount: "3", unit: "ช้อนโต๊ะ" });
    addIngredient({ name: "น้ำมันพืช", amount: "2", unit: "ช้อนโต๊ะ" });
    addIngredient({ name: "น้ำตาลทราย", amount: "1", unit: "ช้อนโต๊ะ" });
    addIngredient({ name: "วัตถุดิบใหม่", amount: "1", unit: "ช้อนโต๊ะ" });
    renderCostKnowledge();
    showToast("ใส่ข้อมูลตัวอย่างสำหรับเปรียบเทียบสถานะ knowledge แล้ว");
  });

  costVariantSelect.addEventListener("change", renderCostKnowledge);

  document.querySelectorAll(".workspace-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchWorkspace(tab.dataset.workspaceTarget));
  });

  document.querySelectorAll('input[name="menu-set"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) applyBranchMenuSet(radio.value);
    });
  });

  document.querySelector("#select-all-menu-items").addEventListener("click", () => applyBranchMenuSet("full"));
  document.querySelector("#clear-menu-items").addEventListener("click", () => {
    selectedBranchMenuIds.clear();
    renderMenuCatalog();
    updateMenuSetControls();
    renderBranchSummary();
  });

  document.querySelector("#branch-select").addEventListener("change", () => {
    applyBranchMenuSet(selectedBranchProfile().set);
  });
  document.querySelector("#brand-select").addEventListener("change", renderBranchSummary);
  document.querySelector("#company-select").addEventListener("change", renderBranchSummary);

  document.querySelector("#publish-branch-menu").addEventListener("click", () => {
    const dependencies = requiredDependencies();
    const pendingCount = dependencies.filter((dependency) => !dependency.ready).length + (selectedBranchProfile().costReady ? 0 : 1);
    if (selectedBranchMenuIds.size === 0) {
      showToast("เลือกอย่างน้อยหนึ่งเมนูก่อนเผยแพร่ให้สาขา");
      return;
    }
    showToast(pendingCount > 0
      ? `บันทึกเป็นแบบร่างแล้ว ยังมี ${pendingCount} รายการต้องเตรียมก่อนเปิดสาขา`
      : "จำลองเผยแพร่ Menu Assignment ให้สาขาแล้ว");
  });

  window.addEventListener("nntn:kitchen-print-request", (event) => {
    const bundle = event.detail?.bundle;
    if (!bundle || !Array.isArray(bundle.recipes)) return;
    kitchenPrintRecipes.clear();
    selectedRecipeIds.clear();
    bundle.recipes.forEach((recipe) => {
      kitchenPrintRecipes.set(recipe.id, recipe);
      selectedRecipeIds.add(recipe.id);
    });
    syncKitchenPrintStatus();
    openPrintCenter();
  });

  document.querySelector("#open-print-center").addEventListener("click", openPrintCenter);
  document.querySelector("#close-print-center").addEventListener("click", closePrintCenter);
  document.querySelector("#refresh-print-preview").addEventListener("click", () => {
    renderRecipePicker();
    renderPrintPreview();
    showToast("อัปเดตตัวอย่างเอกสารแล้ว");
  });

  document.querySelector("#select-all-recipes").addEventListener("click", () => {
    allRecipes().forEach((recipe) => selectedRecipeIds.add(recipe.id));
    syncKitchenPrintStatus();
    renderRecipePicker();
    renderPrintPreview();
  });

  document.querySelector("#clear-recipe-selection").addEventListener("click", () => {
    selectedRecipeIds.clear();
    syncKitchenPrintStatus();
    renderRecipePicker();
    renderPrintPreview();
  });

  document.querySelectorAll('input[name="print-template"], #print-status, #print-include-history')
    .forEach((control) => control.addEventListener("change", renderPrintPreview));
  document.querySelector("#print-multiplier").addEventListener("input", renderPrintPreview);

  document.querySelector("#print-document-button").addEventListener("click", () => {
    if (selectedRecipes().length === 0) {
      showToast("เลือกสูตรอย่างน้อยหนึ่งรายการก่อนพิมพ์");
      return;
    }
    renderPrintPreview();
    document.body.classList.add("printing");
    window.print();
    window.setTimeout(() => document.body.classList.remove("printing"), 1000);
  });

  printModal.addEventListener("click", (event) => {
    if (event.target === printModal) closePrintCenter();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !printModal.hidden) closePrintCenter();
  });

  window.addEventListener("afterprint", () => document.body.classList.remove("printing"));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (recipeMode() === "variant" && normalizeVariants(variantRowsFromForm()).every((variant) => !variant.active)) {
      showToast("ยังบันทึกเป็นแบบร่างได้ แต่ต้องเปิดอย่างน้อยหนึ่งตัวเลือกก่อนส่งไปขายหรือพิมพ์");
      return;
    }
    showToast("จำลองการบันทึกสำเร็จ ข้อมูลยังอยู่เฉพาะในหน้าเบราว์เซอร์นี้");
  });

  form.addEventListener("input", renderCostKnowledge);
  form.addEventListener("change", renderCostKnowledge);

  addIngredient({ name: "", amount: "", unit: "กรัม" });
  addIngredient({ name: "", amount: "", unit: "กรัม" });
  applyRecipeMode({ resetPrintSelection: true });
  renderHistory();
  renderKnowledgeSummary();
  renderCostKnowledge();
  renderMenuCatalog();
  updateMenuSetControls();
  renderBranchSummary();
})();
