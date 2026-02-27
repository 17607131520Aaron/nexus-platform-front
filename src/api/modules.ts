import type { ModuleEntry } from "@/services/modules";
import { queryModules } from "@/services/modules";

// 对外暴露的获取模块列表的 API 函数
export async function fetchModules(): Promise<ModuleEntry[]> {
  return await queryModules();
}
