"use server";

export type ModuleKind = "site" | "cms" | "tool";

export interface ModuleEntry {
  key: string;
  name: string;
  description: string;
  kind: ModuleKind;
  tags?: string[];
  href: string;
  openInNewTab?: boolean;
}

// 先用本地 Mock 数据，后续可以替换成真实接口返回
const MOCK_MODULES: ModuleEntry[] = [
  {
    key: "crm",
    name: "企业内容管理系统",
    description: "左侧菜单导航，右侧内容区，用于企业级内容/配置管理。",
    kind: "cms",
    tags: ["企业", "后台", "Layout"],
    href: "crm",
  },
  {
    key: "ops",
    name: "运维控制台",
    description: "常用运维功能聚合：环境、发布、监控与告警。",
    kind: "tool",
    tags: ["工具", "内部"],
    href: "ops",
  },
  {
    key: "workspace",
    name: "工作台",
    description: "团队日常工作入口：消息、任务、常用链接与快捷操作。",
    kind: "tool",
    tags: ["工具", "协作"],
    href: "workspace",
  },
  {
    key: "dev-tools",
    name: "工程师调试工具",
    description:
      "聚合接口调试、Mock、日志查看等常用工程工具，方便本地和测试环境排查问题。",
    kind: "tool",
    tags: ["调试", "工程", "工具"],
    href: "dev-tools",
  },
  {
    key: "portal",
    name: "门户站点",
    description: "面向用户的站点入口（示例：外部站点/独立域名）。",
    kind: "site",
    tags: ["站点", "外部"],
    href: "https://nextjs.org/docs/app/getting-started/installation",
    openInNewTab: true,
  },
];

export async function queryModules(): Promise<ModuleEntry[]> {
  // 模拟异步请求，真实项目可在这里调用后端 HTTP 接口
  return MOCK_MODULES;
}

