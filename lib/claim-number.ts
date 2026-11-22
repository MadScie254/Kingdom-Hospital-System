/** SQL for the next SHA claim reference, such as SHA20260315. The year is the Nairobi calendar year at the moment the claim is made. */
export const SHA_CLAIM_NO_SQL = `'SHA' || to_char(now() at time zone 'Africa/Nairobi', 'YYYY') || lpad(nextval('sha_claim_seq')::text, 4, '0')`;

/** The same reference built in code, for tests and previews. */
export const shaClaimNo = (year: number, seq: number) => `SHA${year}${String(seq).padStart(4, "0")}`;
