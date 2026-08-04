"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPagePlan,
  paginateDocument,
  recommendTemplate,
  resolveTemplate,
  workDocuments
} = require("../print-center.js");

function fixtureRecipes() {
  const prep = {
    id: "kitchen:prep-1",
    recipe_id: 1,
    name: "ซอสทดสอบ",
    version: "prep-v1",
    kitchenStatus: "print_ready",
    blockers: [],
    workDocuments: {
      prep: {
        stage: "prep",
        scalable: true,
        ingredients: [{ name: "โชยุ", amount: "100", unit: "ml" }],
        steps: ["ผสมให้เข้ากัน"]
      }
    }
  };
  const menu = {
    id: "kitchen:menu-2",
    recipe_id: 2,
    name: "ข้าวหน้าทดสอบ",
    version: "menu-v1",
    kitchenStatus: "draft",
    blockers: [{ code: "missing_method", message: "รอวิธีทำ" }],
    workDocuments: {
      cook: {
        stage: "cook",
        scalable: false,
        ingredients: [{ name: "เนื้อ", amount: "75", unit: "กรัม" }],
        steps: ["ทอดเนื้อ"]
      },
      service: {
        stage: "service",
        scalable: false,
        ingredients: [{ name: "ข้าวหุงสุก", amount: "180", unit: "กรัม" }],
        steps: ["ตักข้าวหุงสุก 180 กรัม", "จัดเนื้อลงบนข้าว"]
      }
    }
  };
  return [menu, prep, structuredClone(prep)];
}

test("automatic template recommends A5 station cards for every work stage", () => {
  assert.equal(recommendTemplate("cook"), "station");
  assert.equal(recommendTemplate("prep"), "station");
  assert.equal(recommendTemplate("service"), "station");
  assert.equal(recommendTemplate("all"), "station");
});

test("an explicit template overrides the automatic recommendation", () => {
  assert.equal(resolveTemplate("auto", "service"), "station");
  assert.equal(resolveTemplate("two-up", "service"), "two-up");
  assert.equal(resolveTemplate("master", "prep"), "master");
});

test("work documents are deduplicated and ordered prep then cook then service", () => {
  const documents = workDocuments(fixtureRecipes(), "all");

  assert.deepEqual(documents.map((document) => document.stage), ["prep", "cook", "service"]);
  assert.deepEqual(documents.map((document) => document.recipeName), ["ซอสทดสอบ", "ข้าวหน้าทดสอบ", "ข้าวหน้าทดสอบ"]);
});

test("stage filtering keeps only documents for the requested workstation", () => {
  const documents = workDocuments(fixtureRecipes(), "service");

  assert.equal(documents.length, 1);
  assert.equal(documents[0].stage, "service");
  assert.equal(documents[0].ingredients[0].amount, "180");
});

test("batch multipliers never scale service documents", () => {
  const prepPlan = buildPagePlan(fixtureRecipes(), { workStage: "prep", template: "station", multiplier: 3 });
  const servicePlan = buildPagePlan(fixtureRecipes(), { workStage: "service", template: "station", multiplier: 3 });

  assert.equal(prepPlan[0].document.multiplier, 3);
  assert.equal(servicePlan[0].document.multiplier, 1);
});

test("two-up layout places exactly two A5 card slots on each A4 sheet", () => {
  const pages = buildPagePlan(fixtureRecipes(), { workStage: "all", template: "two-up", multiplier: 1 });

  assert.equal(pages[0].kind, "two-up");
  assert.equal(pages[0].slots.length, 2);
  assert.equal(pages[1].slots.length, 1);
});

test("long workstation content creates continuation pages instead of clipping", () => {
  const document = {
    key: "long:prep",
    stage: "prep",
    recipeName: "ซอสหลายขั้นตอน",
    scalable: true,
    ingredients: Array.from({ length: 15 }, (_, index) => ({ name: `วัตถุดิบ ${index + 1}`, amount: "1", unit: "กรัม" })),
    steps: Array.from({ length: 12 }, (_, index) => `ขั้นตอนที่ ${index + 1} ทำงานต่อเนื่องจนส่วนผสมเข้ากันดี`)
  };

  const pages = paginateDocument(document);

  assert.ok(pages.length >= 2);
  assert.equal(pages[0].continuation, false);
  assert.equal(pages[1].continuation, true);
  assert.equal(pages.flatMap((page) => page.ingredients).length, 15);
  assert.equal(pages.flatMap((page) => page.steps).length, 12);
});
