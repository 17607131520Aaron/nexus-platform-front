"use client";

import { ReactNode, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { MenuProps } from "antd";
import { Layout, Menu, Typography } from "antd";

import { MENU_ITEMS } from "./constants";
import "./page.scss";

const { Header, Sider, Content } = Layout;

type MenuItem = NonNullable<MenuProps["items"]>[number];

const isMenuItem = (item: unknown): item is Exclude<MenuItem, null> =>
  typeof item === "object" && item !== null && "key" in item;

const getItemKey = (item: Exclude<MenuItem, null>): string | undefined => {
  const k = (item as { key?: React.Key }).key;
  return typeof k === "string" ? k : undefined;
};

const getItemChildren = (item: Exclude<MenuItem, null>): MenuItem[] => {
  const children = (item as { children?: unknown }).children;
  return Array.isArray(children) ? (children as MenuItem[]) : [];
};

const DevToolsLayout = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();

  const selectedKey = useMemo(() => {
    const stack: MenuItem[] = [...MENU_ITEMS];
    while (stack.length) {
      const cur = stack.shift();
      if (!isMenuItem(cur)) continue;
      const key = getItemKey(cur);
      if (key && key.startsWith("/dev-tools/")) {
        if (pathname.startsWith(key)) return key;
      }
      const children = getItemChildren(cur);
      if (children.length) stack.push(...children);
    }
    return "home";
  }, [pathname]);

  return (
    <Layout className="dev-tools-page">
      <Sider width={240} theme="light" className="dev-tools-sider">
        <div className="dev-tools-sider-header">
          <span className="dev-tools-sider-logo" />
          <span className="dev-tools-sider-title">工程师调试工具</span>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          className="dev-tools-menu"
          defaultOpenKeys={["rn-tools", "data-tools"]}
          onClick={({ key }) => {
            const k = key as string;
            if (k.startsWith("/dev-tools/")) router.push(k);
          }}
          items={MENU_ITEMS}
        />
      </Sider>

      <Layout className="dev-tools-main">
        <Header className="dev-tools-header">
          <Typography.Title level={4} className="dev-tools-title">
            调试工作台
          </Typography.Title>
        </Header>

        <Content className="dev-tools-content">
          <div className="dev-tools-canvas">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default DevToolsLayout;
