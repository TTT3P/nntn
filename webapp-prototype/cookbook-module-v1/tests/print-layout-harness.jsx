import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { FixtureCookbookRepository } from "../src/data/FixtureCookbookRepository";
import { PrototypeContext } from "../src/prototype/PrototypeProvider";
import { PrintCenterPage } from "../src/features/print/PrintCenterPage";
import {
  makeIngredientLine,
  makeMediaAsset,
  makeRecipe,
  makeSnapshot,
  makeStepMediaLink,
  makeWorkStep,
} from "../src/test/builders";
import "../src/index.css";
import "../src/app/styles.css";

function serviceRecipe({
  recipeId = 165,
  recipeVersionId = `browser-${String(recipeId)}`,
  name = "ข้าวหน้าเนื้อตุ๋น",
  ingredients = [makeIngredientLine({ lineKey: "rice", sourceText: "180 กรัม" })],
  steps = [makeWorkStep({
    stepId: `${recipeVersionId}:service:1`,
    stage: "service",
    instruction: "จัดเสิร์ฟตามต้นฉบับ",
  })],
} = {}) {
  return makeRecipe({
    recipeId,
    recipeVersionId,
    name,
    kind: "sellable_menu",
    lines: ingredients,
    methodText: "จัดเสิร์ฟตามขั้นตอน",
    workDocuments: {
      service: {
        stage: "service",
        scalable: false,
        ingredientLineKeys: ingredients.map((line) => line.lineKey),
        steps,
      },
    },
  });
}

function ingredientRows(count) {
  return Array.from({ length: count }, (_, index) => makeIngredientLine({
    lineKey: `ingredient-${index + 1}`,
    itemName: `วัตถุดิบ ${index + 1}`,
    sourceText: `${index + 1} กรัม`,
  }));
}

function mediaScenario({ name = "สูตรทดสอบสามรูป", ingredientCount = 1 } = {}) {
  const recipe = serviceRecipe({
    name,
    ingredients: ingredientRows(ingredientCount),
  });
  const stepId = recipe.workDocuments.service.steps[0].stepId;
  const media = [1, 2, 3].map((order) => makeMediaAsset({
    mediaId: `browser-media-${order}`,
    url: "/sample-media/service-delivery-layout.svg",
    caption: order < 3 ? "X".repeat(121) : "ภาพจัดเสิร์ฟตามมาตรฐาน",
    altText: `ภาพจัดเสิร์ฟลำดับ ${order}`,
    measurementAnnotation: order === 3 ? "180 กรัม" : null,
  }));
  return makeSnapshot({
    recipes: [recipe],
    media,
    stepMedia: media.map((asset, index) => makeStepMediaLink({
      stepId,
      mediaId: asset.mediaId,
      order: index + 1,
    })),
  });
}

function ingredientScenario(itemName, sourceText) {
  return makeSnapshot({
    recipes: [serviceRecipe({
      ingredients: [makeIngredientLine({ lineKey: "regional", itemName, sourceText })],
    })],
  });
}

function ingredientRegionScenario(plusOneCell) {
  const ingredients = Array.from({ length: 15 }, (_, index) => makeIngredientLine({
    lineKey: `regional-${index + 1}`,
    itemName: `${"ก้".repeat(10)}${index === 0 && plusOneCell ? "ก" : ""}`,
    sourceText: "ก้".repeat(10),
  }));
  return makeSnapshot({ recipes: [serviceRecipe({ ingredients })] });
}

function clippedEmojiIngredientRegionScenario() {
  const ingredients = Array.from({ length: 15 }, (_, index) => makeIngredientLine({
    lineKey: `clipped-wide-${index + 1}`,
    itemName: "😀".repeat(10),
    sourceText: "😀".repeat(10),
  }));
  return makeSnapshot({ recipes: [serviceRecipe({ ingredients })] });
}

function componentReferenceScenario(count) {
  const ingredients = Array.from({ length: count }, (_, index) => makeIngredientLine({
    lineKey: `component-${index + 1}`,
    itemName: `สูตรประกอบ ${index + 1}`,
    itemKind: "prepared_recipe",
    ingredientId: null,
    componentRecipeId: "RCP-COMPONENT",
    sourceText: `${index + 1} กรัม`,
  }));
  return makeSnapshot({
    recipes: [
      serviceRecipe({ ingredients }),
      makeRecipe({
        recipeId: "RCP-COMPONENT",
        recipeVersionId: "browser-component-v1",
        name: "สูตรประกอบกลาง",
        kind: "prepared_recipe",
      }),
    ],
  });
}

function combinedWideScenario(plusOneUnit) {
  const ingredients = ingredientRows(7);
  const recipe = serviceRecipe({
    name: `${"😀".repeat(53)}ก`,
    ingredients,
  });
  const stepId = recipe.workDocuments.service.steps[0].stepId;
  const media = [
    makeMediaAsset({
      mediaId: "combined-wide-1",
      url: "/sample-media/service-delivery-layout.svg",
      caption: `${"😀".repeat(40)}ก`,
      altText: `${"😀".repeat(26)}กก`,
      measurementAnnotation: plusOneUnit ? `${"😀".repeat(13)}ก` : "😀".repeat(13),
    }),
    makeMediaAsset({
      mediaId: "combined-wide-2",
      url: "/sample-media/service-delivery-layout.svg",
      caption: "😀".repeat(14),
      altText: plusOneUnit ? `${"😀".repeat(13)}กก` : "😀".repeat(14),
    }),
    makeMediaAsset({
      mediaId: "combined-wide-3",
      url: "/sample-media/service-delivery-layout.svg",
      caption: "😀".repeat(14),
      altText: "😀".repeat(14),
    }),
  ];
  return makeSnapshot({
    recipes: [recipe],
    media,
    stepMedia: media.map((asset, index) => makeStepMediaLink({
      stepId,
      mediaId: asset.mediaId,
      order: index + 1,
    })),
  });
}

function customMediaScenario(assets) {
  const recipe = serviceRecipe();
  const stepId = recipe.workDocuments.service.steps[0].stepId;
  const media = assets.map((asset, index) => makeMediaAsset({
    mediaId: `regional-media-${index + 1}`,
    url: "/sample-media/service-delivery-layout.svg",
    ...asset,
  }));
  return makeSnapshot({
    recipes: [recipe],
    media,
    stepMedia: media.map((asset, index) => makeStepMediaLink({
      stepId,
      mediaId: asset.mediaId,
      order: index + 1,
    })),
  });
}

async function scenarioFor(name) {
  if (name === "normal") {
    return {
      snapshot: await new FixtureCookbookRepository().loadSnapshot(),
      initialRecipeIds: [165],
    };
  }
  if (name === "ingredient-15") {
    return {
      snapshot: makeSnapshot({ recipes: [serviceRecipe({ ingredients: ingredientRows(15) })] }),
      initialRecipeIds: [165],
    };
  }
  if (name === "header-regional-max" || name === "header-regional-plus-one") {
    return {
      snapshot: makeSnapshot({
        recipes: [serviceRecipe({
          name: `${"😀".repeat(53)}ก${name.endsWith("plus-one") ? "ก" : ""}`,
        })],
      }),
      initialRecipeIds: [165],
    };
  }
  if (name === "header-combining-max" || name === "header-combining-plus-one") {
    return {
      snapshot: makeSnapshot({
        recipes: [serviceRecipe({
          name: `${"ก้".repeat(160)}${name.endsWith("plus-one") ? "ก" : ""}`,
        })],
      }),
      initialRecipeIds: [165],
    };
  }
  if (name === "ingredient-item-max" || name === "ingredient-item-plus-one") {
    return {
      snapshot: ingredientScenario(
        `${"😀".repeat(21)}ก${name.endsWith("plus-one") ? "ก" : ""}`,
        "S",
      ),
      initialRecipeIds: [165],
    };
  }
  if (name === "ingredient-source-max" || name === "ingredient-source-plus-one") {
    return {
      snapshot: ingredientScenario(
        "I",
        `${"😀".repeat(16)}${name.endsWith("plus-one") ? "ก" : ""}`,
      ),
      initialRecipeIds: [165],
    };
  }
  if (name === "ingredient-row-max" || name === "ingredient-row-plus-one") {
    return {
      snapshot: ingredientScenario(
        `${"😀".repeat(16)}${name.endsWith("plus-one") ? "ก" : ""}`,
        "😀".repeat(16),
      ),
      initialRecipeIds: [165],
    };
  }
  if (name === "ingredient-region-max" || name === "ingredient-region-plus-one") {
    return {
      snapshot: ingredientRegionScenario(name.endsWith("plus-one")),
      initialRecipeIds: [165],
    };
  }
  if (name === "ingredient-emoji-overflow-rejected") {
    return {
      snapshot: clippedEmojiIngredientRegionScenario(),
      initialRecipeIds: [165],
    };
  }
  if (name === "component-reference-7" || name === "component-reference-overflow-rejected") {
    return {
      snapshot: componentReferenceScenario(name === "component-reference-7" ? 7 : 15),
      initialRecipeIds: [165],
    };
  }
  if (name === "photo-3-long") {
    return { snapshot: mediaScenario(), initialRecipeIds: [165] };
  }
  if (name === "combined-maxima") {
    return {
      snapshot: mediaScenario({ name: "ช".repeat(160), ingredientCount: 6 }),
      initialRecipeIds: [165],
    };
  }
  if (name === "media-caption-max" || name === "media-caption-plus-one") {
    return {
      snapshot: customMediaScenario([{
        caption: `${"😀".repeat(40)}ก${name.endsWith("plus-one") ? "ก" : ""}`,
        altText: "A",
      }]),
      initialRecipeIds: [165],
    };
  }
  if (name === "media-alt-max" || name === "media-alt-plus-one") {
    return {
      snapshot: customMediaScenario([{
        caption: "C",
        altText: `${"😀".repeat(26)}กก${name.endsWith("plus-one") ? "ก" : ""}`,
      }]),
      initialRecipeIds: [165],
    };
  }
  if (name === "media-measurement-max" || name === "media-measurement-plus-one") {
    return {
      snapshot: customMediaScenario([{
        caption: "C",
        altText: "A",
        measurementAnnotation: `${"😀".repeat(16)}${name.endsWith("plus-one") ? "ก" : ""}`,
      }]),
      initialRecipeIds: [165],
    };
  }
  if (name === "media-region-max" || name === "media-region-plus-one") {
    return {
      snapshot: customMediaScenario([1, 2, 3].map((order) => ({
        caption: "😀".repeat(40),
        altText: `${"😀".repeat(5)}ก${order === 1 && name.endsWith("plus-one") ? "ก" : ""}`,
      }))),
      initialRecipeIds: [165],
    };
  }
  if (name === "media-count-plus-one") {
    return {
      snapshot: customMediaScenario([1, 2, 3, 4].map(() => ({
        caption: "ภาพตรวจงาน",
        altText: "ภาพขั้นตอน",
      }))),
      initialRecipeIds: [165],
    };
  }
  if (
    name === "media-keycap-max" ||
    name === "media-keycap-plus-one" ||
    name === "media-keycap-overflow-rejected"
  ) {
    const caption = name === "media-keycap-overflow-rejected"
      ? "1️⃣".repeat(121)
      : `${"1️⃣".repeat(40)}ก${name.endsWith("plus-one") ? "ก" : ""}`;
    return {
      snapshot: customMediaScenario([{ caption, altText: "ภาพ keycap" }]),
      initialRecipeIds: [165],
    };
  }
  const selectorKeycapSequences = {
    "media-keycap-vs15": "1\uFE0E\u20E3",
    "media-keycap-repeated-vs16": "1\uFE0F\uFE0F\u20E3",
    "media-keycap-mixed-selectors": "1\uFE0E\uFE0F\uFE0E\u20E3",
  };
  const selectorKeycapPrefix = Object.keys(selectorKeycapSequences)
    .find((prefix) => name.startsWith(prefix));
  if (selectorKeycapPrefix !== undefined) {
    const sequence = selectorKeycapSequences[selectorKeycapPrefix];
    const caption = name.endsWith("overflow-rejected")
      ? sequence.repeat(121)
      : `${sequence.repeat(40)}ก${name.endsWith("plus-one") ? "ก" : ""}`;
    return {
      snapshot: customMediaScenario([{ caption, altText: "ภาพ keycap selector" }]),
      initialRecipeIds: [165],
    };
  }
  if (name === "ingredient-16-rejected") {
    return {
      snapshot: makeSnapshot({ recipes: [serviceRecipe({ ingredients: ingredientRows(16) })] }),
      initialRecipeIds: [165],
    };
  }
  if (name === "combined-plus-one-rejected") {
    return {
      snapshot: mediaScenario({ name: "ช".repeat(160), ingredientCount: 7 }),
      initialRecipeIds: [165],
    };
  }
  if (name === "step-wide-max" || name === "step-wide-plus-one") {
    return {
      snapshot: makeSnapshot({
        recipes: [serviceRecipe({
          steps: [makeWorkStep({
            stepId: "browser-step-wide",
            stage: "service",
            instruction: `${"😀".repeat(280)}${name.endsWith("plus-one") ? "ก" : ""}`,
          })],
        })],
      }),
      initialRecipeIds: [165],
    };
  }
  if (name === "step-lines-max" || name === "step-lines-plus-one") {
    const lineCount = name.endsWith("plus-one") ? 8 : 7;
    return {
      snapshot: makeSnapshot({
        recipes: [serviceRecipe({
          steps: [makeWorkStep({
            stepId: "browser-step-lines",
            stage: "service",
            instruction: Array.from(
              { length: lineCount },
              (_, index) => `บรรทัด ${index + 1}`,
            ).join("\r\n"),
          })],
        })],
      }),
      initialRecipeIds: [165],
    };
  }
  if (name === "step-tabs-max" || name === "step-tabs-plus-one") {
    return {
      snapshot: makeSnapshot({
        recipes: [serviceRecipe({
          steps: [makeWorkStep({
            stepId: "browser-step-tabs",
            stage: "service",
            instruction: `${"\t".repeat(210)}${name.endsWith("plus-one") ? "ก" : ""}`,
          })],
        })],
      }),
      initialRecipeIds: [165],
    };
  }
  if (name === "combined-wide-max" || name === "combined-wide-plus-one") {
    return {
      snapshot: combinedWideScenario(name.endsWith("plus-one")),
      initialRecipeIds: [165],
    };
  }
  const controls = {
    "control-nul": "\u0000",
    "control-crlf": "\r\n",
    "control-lf": "\n",
    "control-tab": "\t",
    "control-c1": "\u0085",
    "control-line-separator": "\u2028",
    "control-paragraph-separator": "\u2029",
  };
  if (Object.hasOwn(controls, name)) {
    return {
      snapshot: makeSnapshot({
        recipes: [serviceRecipe({ name: `สูตร${controls[name]}ห้าม` })],
      }),
      initialRecipeIds: [165],
    };
  }
  if (name === "two-up") {
    const recipes = [1, 2, 3, 4, 5].map((recipeId) => serviceRecipe({
      recipeId,
      ingredients: ingredientRows(15).map((line) => ({
        ...line,
        lineKey: `${String(recipeId)}:${line.lineKey}`,
      })),
    }));
    return { snapshot: makeSnapshot({ recipes }), initialRecipeIds: [1, 2, 3, 4, 5] };
  }
  throw new Error(`Unknown browser scenario: ${name}`);
}

const scenarioName = new URLSearchParams(window.location.search).get("case") ?? "normal";
const { snapshot, initialRecipeIds } = await scenarioFor(scenarioName);
const context = {
  snapshot,
  dirty: false,
  persistence: "session",
  dispatch: () => ({ ok: true }),
  createSessionObjectUrl: () => "blob:unused",
  releaseSessionObjectUrl: () => undefined,
  isSessionObjectUrl: () => false,
};

createRoot(document.getElementById("root")).render(
  <PrototypeContext.Provider value={context}>
    <MemoryRouter>
      <PrintCenterPage initialRecipeIds={initialRecipeIds} />
    </MemoryRouter>
  </PrototypeContext.Provider>,
);
