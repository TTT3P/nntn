const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const cookbookPath = process.env.COOKBOOK_HTML || new URL('../cookbook.html', `file://${__filename}`);
const source = readFileSync(cookbookPath, 'utf8');

function loadFunction(name) {
  const match = source.match(new RegExp(`function ${name}\\([^)]*\\) \\{[^}]*\\}`));
  assert.ok(match, `cookbook.html must define ${name}()`);
  return vm.runInNewContext(`(${match[0]})`);
}

test('มีตัวเลือกพิมพ์ใบส่งครัวเฉพาะสูตรที่ต้องให้ครัวเขียน', () => {
  assert.match(source, /<select[^>]+id="stepFilter"/);
  assert.match(source, /<option value="__kitchen__">[^<]*ต้องให้ครัวเขียน/);
});

test('ถือว่าไม่มีขั้นตอนเมื่อ SOP ไม่มีค่า เป็น null หรือมีแต่ช่องว่าง', () => {
  const isMissingSteps = loadFunction('isMissingSteps');

  assert.equal(isMissingSteps(undefined), true);
  assert.equal(isMissingSteps({ steps_freeform: null }), true);
  assert.equal(isMissingSteps({ steps_freeform: '   \n  ' }), true);
  assert.equal(isMissingSteps({ steps_freeform: '1. ตั้งกระทะ' }), false);
});

test('ตัดงานแบ่งบรรจุและสูตรเนื้อออสออกจากใบส่งครัวโดยยังไม่เขียนขั้นตอนแทน', () => {
  const needsKitchenSteps = loadFunction('needsKitchenSteps');

  assert.equal(needsKitchenSteps('PKG-001', true), false);
  assert.equal(needsKitchenSteps('PKG-016', true), false);
  assert.equal(needsKitchenSteps('PKG-017', true), true);
  assert.equal(needsKitchenSteps('RCP-022-M', true), false);
  assert.equal(needsKitchenSteps('RCP-023-M', true), false);
  assert.equal(needsKitchenSteps('RCP-055-M', true), false);
  assert.equal(needsKitchenSteps('RCP-069-M', true), false);
  assert.equal(needsKitchenSteps('RCP-002', true), true);
  assert.equal(needsKitchenSteps('RCP-002', false), false);
});

test('รวมตัวกรองหมวดกับใบส่งครัวได้โดยไม่ทำให้โหมดทั้งเล่มเปลี่ยน', () => {
  const recipeMatchesFilters = loadFunction('recipeMatchesFilters');

  assert.equal(recipeMatchesFilters('ไข่', false, '__all__', '__all__'), true);
  assert.equal(recipeMatchesFilters('ไข่', true, '__all__', '__kitchen__'), true);
  assert.equal(recipeMatchesFilters('ไข่', false, '__all__', '__kitchen__'), false);
  assert.equal(recipeMatchesFilters('ไข่', true, 'ไข่', '__kitchen__'), true);
  assert.equal(recipeMatchesFilters('ซอส/น้ำจิ้ม', true, 'ไข่', '__kitchen__'), false);
});

test('ใบส่งครัวเว้นพื้นที่อย่างน้อย 90 มม. ให้เขียนขั้นตอนด้วยมือ', () => {
  assert.match(source, /classList\.toggle\('kitchen-input',\s*steps === '__kitchen__'\)/);
  const rule = source.match(/body\.kitchen-input \.col-steps \.steps-body\s*\{[^}]*min-height:\s*(\d+)mm/);
  assert.ok(rule, 'cookbook.html must define a handwritten-steps area for kitchen input');
  assert.ok(Number(rule[1]) >= 90, `handwritten area is only ${rule[1]}mm`);
});

// [removed 2026-08-26] test 'ลดเฉพาะพื้นที่เขียนของสูตร BOM ยาว…' asserted the
// pre-7624c6f kitchen-sheet pagination (kitchenStepHeightMm shrink + fitKitchenPages
// + kitchen-break second page). Commit 7624c6f "เล่มครัว — 2 สูตร/หน้า A4" (TINE)
// superseded that design, removing those functions from cookbook.html. The current
// ≥90mm handwrite-area contract stays covered by the test above.
