import { MOCK_MODULES } from "../sources/module.mock";

import type { ModuleEntry } from "../model";

export async function queryModules(): Promise<ModuleEntry[]> {
  return MOCK_MODULES;
}
