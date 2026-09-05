import { PEOPLE } from "@/people";
import { reference } from "@/people/reference";

// Read as a literal so Next can inline it into the client bundle. A computed
// lookup into process.env comes back undefined in the browser.
const id = process.env.NEXT_PUBLIC_PERSON ?? "reference";

if (!PEOPLE[id]) {
  // Loud on purpose. A typo in the env var would otherwise silently render
  // someone else's chart under the wrong name.
  console.warn(`NEXT_PUBLIC_PERSON="${id}" is not in src/people. Falling back to the reference epoch.`);
}

export const PERSON = PEOPLE[id] ?? reference;
