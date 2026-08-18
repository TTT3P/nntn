import type { RecipeIdentity } from "../../domain/cookbook/types";

export function encodeRecipeIdentity(identity: RecipeIdentity): string {
  if (typeof identity === "number") {
    if (!Number.isSafeInteger(identity)) {
      throw new Error("Recipe numeric identity must be a safe integer");
    }
    return String(identity);
  }

  if (/^(?:RCP|SRCP)-[A-Z0-9-]+$/u.test(identity)) return identity;

  let encoded = "s~";
  for (let index = 0; index < identity.length; index += 1) {
    encoded += identity.charCodeAt(index).toString(16).padStart(4, "0");
  }
  return encoded;
}

export function decodeRecipeIdentity(segment: string): RecipeIdentity | null {
  if (/^(?:0|-[1-9]\d*|[1-9]\d*)$/.test(segment)) {
    const value = Number(segment);
    return Number.isSafeInteger(value) ? value : null;
  }
  if (/^(?:RCP|SRCP)-[A-Z0-9-]+$/u.test(segment)) return segment;
  if (!segment.startsWith("s~")) return null;

  const hex = segment.slice(2);
  if (hex.length % 4 !== 0 || !/^[0-9a-f]*$/.test(hex)) return null;

  let decoded = "";
  for (let index = 0; index < hex.length; index += 4) {
    decoded += String.fromCharCode(
      Number.parseInt(hex.slice(index, index + 4), 16),
    );
  }
  return decoded;
}
