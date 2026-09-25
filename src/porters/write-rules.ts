// What PORTERS' Write accepts (ADR-0098).

/** PORTERS caps a Write request at 200 records; larger inputs are split into batches of 200. */
export const MAX_WRITE_ITEMS = 200;
