export const STANDARD_INGREDIENT_UNITS = [
  "กรัม",
  "กิโลกรัม",
  "มิลลิลิตร",
  "ลิตร",
  "ช้อนชา",
  "ช้อนโต๊ะ",
  "ถ้วย",
  "ทัพพี",
  "ฟอง",
  "ชิ้น",
  "กลีบ",
  "หัว",
  "ลูก",
  "ใบ",
  "กำ",
  "กระป๋อง",
  "ขวด",
  "ซอง",
  "ถุง",
  "หม้อ",
  "จาน",
  "ชุด",
] as const;

export const CUSTOM_INGREDIENT_UNIT = "__custom__";

export function normalizeSelectedUnit(selection: string, customUnit: string): string {
  return selection === CUSTOM_INGREDIENT_UNIT ? customUnit : selection;
}
