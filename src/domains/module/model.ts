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
