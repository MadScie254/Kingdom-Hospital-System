/** ICD-11 helpers. SHA claims use ICD-11. Codes are never guessed from ICD-10: staff pick them from the terminology service or type them, and a pick is remembered on the diagnosis list. */

/** SHA's examples write ICD-11 codes in lower case, for example ca07.0. */
export const normalizeIcd11 = (code: string) => String(code || "").trim().replace(/\s+/g, "").toLowerCase();

/** A loose shape check: 2 to 4 letters or digits, then an optional dot and up to 4 more. It catches typos, it does not prove a code exists. */
export const isIcd11 = (code: string) => /^[0-9a-z]{2,4}(\.[0-9a-z]{1,4})?$/.test(normalizeIcd11(code));

export type Concept = { code: string; name: string };

/** Open Concept Lab style results use id and display_name. Other shapes are read as best as they can be. */
export function toConcept(raw: Record<string, any>): Concept | null {
  const code = String(raw?.id ?? raw?.code ?? raw?.concept_code ?? "").trim();
  const name = String(raw?.display_name ?? raw?.name ?? raw?.display ?? raw?.description ?? "").trim();
  return code ? { code, name: name || code } : null;
}

export const ICD10_SHAPE = /^[A-TV-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/i;
