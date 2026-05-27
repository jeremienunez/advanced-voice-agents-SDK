import { join } from "node:path";

export const draftStatePath = join(process.cwd(), ".builder-state", "drafts.json");
export const sessionStatePath = join(process.cwd(), ".builder-state", "session.json");
