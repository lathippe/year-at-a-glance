import type { Person } from "./types";
import { reference } from "./reference";

/**
 * Every chart this build can render. The public showcase ships one synthetic
 * reference epoch and no real birth data of anybody.
 */
export const PEOPLE: Record<string, Person> = { reference };
