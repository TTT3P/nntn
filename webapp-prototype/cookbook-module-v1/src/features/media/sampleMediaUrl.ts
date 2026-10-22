function isCanonicalSampleMediaPath(value: string): boolean {
  if (/[%?#\\]/u.test(value) || !value.startsWith("/sample-media/")) return false;
  const segments = value.slice("/sample-media/".length).split("/");
  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== ".." &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(segment),
  );
}

export function resolveSampleMediaUrl(
  canonicalPath: string,
  base: string = import.meta.env.BASE_URL,
): string | null {
  if (!isCanonicalSampleMediaPath(canonicalPath)) return null;
  if (
    typeof base !== "string" ||
    !base.startsWith("/") ||
    base.startsWith("//") ||
    !base.endsWith("/") ||
    /[%?#\\]/u.test(base) ||
    [...base].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    }) ||
    (base !== "/" && !base.slice(1, -1).split("/").every((segment) =>
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(segment)
    ))
  ) {
    return null;
  }
  return `${base}${canonicalPath.slice(1)}`;
}
