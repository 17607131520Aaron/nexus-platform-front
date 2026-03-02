import { queryModules } from "../repositories/module.repository";

import type { ModuleEntry } from "../model";

export async function fetchModules(): Promise<ModuleEntry[]> {
  return await queryModules();
}
