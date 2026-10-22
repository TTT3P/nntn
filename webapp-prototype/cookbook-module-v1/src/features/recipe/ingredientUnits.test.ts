import { describe, expect, test } from "vitest";
import { CUSTOM_INGREDIENT_UNIT, normalizeSelectedUnit, STANDARD_INGREDIENT_UNITS } from "./ingredientUnits";

describe("ingredient units", () => {
  test("offers common kitchen units without duplicates", () => {
    expect(STANDARD_INGREDIENT_UNITS).toEqual(expect.arrayContaining([
      "กรัม", "กิโลกรัม", "มิลลิลิตร", "ลิตร", "ช้อนชา", "ช้อนโต๊ะ", "ถ้วย", "ทัพพี", "ฟอง", "ชิ้น",
    ]));
    expect(new Set(STANDARD_INGREDIENT_UNITS).size).toBe(STANDARD_INGREDIENT_UNITS.length);
  });

  test("keeps a custom kitchen unit verbatim", () => {
    expect(normalizeSelectedUnit(CUSTOM_INGREDIENT_UNIT, "ช้อนโต๊ะพูนๆ")).toBe("ช้อนโต๊ะพูนๆ");
    expect(normalizeSelectedUnit("กรัม", "ไม่ใช้ค่านี้")).toBe("กรัม");
  });
});
