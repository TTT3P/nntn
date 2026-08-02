const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const cookbookPath = process.env.COOKBOOK_HTML || new URL('../cookbook.html', `file://${__filename}`);
const exporterPath = process.env.COOKBOOK_EXPORTER || new URL('../scripts/cookbook-pdf/export-cookbook-data.py', `file://${__filename}`);
const builderPath = process.env.COOKBOOK_BUILDER || new URL('../scripts/cookbook-pdf/build-cookbook-pdf.py', `file://${__filename}`);
const cookbook = readFileSync(cookbookPath, 'utf8');
const exporter = readFileSync(exporterPath, 'utf8');
const builder = readFileSync(builderPath, 'utf8');

test('ตัวดึงข้อมูลหน้าเล่มตัด PKG ที่ query โดยไม่กรอง type=sub', () => {
  const query = cookbook.match(/from\('recipes'\)([\s\S]*?)\n\s*if \(error/)?.[1] || '';
  assert.match(query, /\.not\('rcp_code',\s*'like',\s*'PKG-%'\)/);
  assert.doesNotMatch(query, /(?:eq|neq|not)\('type'/);
});

test('export สำหรับ PDF ตัด PKG ที่ data ก่อนประกอบ BOM และ SOP', () => {
  assert.match(exporter, /CUT_RCP_PREFIX\s*=\s*'PKG-'/);
  assert.match(exporter, /not\s+str\(r\.get\('rcp_code'\)\s+or\s+''\)\.startswith\(CUT_RCP_PREFIX\)/);
});

test('offline build shim รองรับ not() ที่ cookbook query เรียกใช้', () => {
  assert.match(builder, /not:\s*\(\)\s*=>\s*o/);
});

test('ปก สารบัญ และท้ายหน้าใช้รายการ recipes หลังกรอง ไม่ใช้เลข hardcode', () => {
  assert.match(cookbook, /count-badge">\$\{recipes\.length\} สูตร/);
  assert.match(cookbook, /<div class="page-foot">[\s\S]{0,800}recipes\.length/);
  assert.match(cookbook, /\.map\(label => \(\{ label, items: recipes\.filter\(r => r\.category === label\) \}\)\)/);
  assert.doesNotMatch(cookbook, />98 สูตร</);
});

test('สารบัญไม่ทำสูตรหมวดว่างหรือหมวดนอกลิสต์หล่นหาย', () => {
  assert.match(cookbook, /const unlistedTocItems = recipes\.filter\(r => !CAT_ORDER\.includes\(r\.category\)\)/);
  assert.match(cookbook, /ไม่ระบุหมวด/);
  assert.match(cookbook, /tocGroups\.push\(\{ label: 'ไม่ระบุหมวด', items: unlistedTocItems \}\)/);
});

test('กลไกตัดหน้าสูตรยาวยังวัดหลัง render และใช้ break-here', () => {
  assert.match(cookbook, /markOverflowPages\(\);/);
  assert.match(cookbook, /if \(sec\.getBoundingClientRect\(\)\.height <= limitPx\) return;/);
  assert.match(cookbook, /target\.classList\.add\('break-here'\)/);
});
