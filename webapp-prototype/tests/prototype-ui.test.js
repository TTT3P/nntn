"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("Print Center v2 exposes work stages and workstation templates", () => {
  const workStageControl = indexHtml.match(/<select id="print-work-stage">([\s\S]*?)<\/select>/)?.[1] || "";
  const templateControl = indexHtml.match(/<fieldset class="control-group template-options">([\s\S]*?)<\/fieldset>/)?.[1] || "";

  for (const value of ["all", "prep", "cook", "service"]) {
    assert.match(workStageControl, new RegExp(`value="${value}"`));
  }
  for (const value of ["auto", "station", "two-up", "master"]) {
    assert.match(templateControl, new RegExp(`value="${value}"`));
  }
  assert.match(templateControl, /A5 แนวนอน/);
  assert.match(templateControl, /2 ใบ A5 บน A4/);
});

test("Print Center planner loads before the application controller", () => {
  const plannerIndex = indexHtml.indexOf('<script src="print-center.js');
  const appIndex = indexHtml.indexOf('<script src="app.js');

  assert.ok(plannerIndex >= 0, "ต้องโหลด print-center.js");
  assert.ok(plannerIndex < appIndex, "print-center.js ต้องโหลดก่อน app.js");
});
