"use client";

import { ReactNode, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { MenuProps } from "antd";
import { AppstoreOutlined } from "@ant-design/icons";
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
    return "/dev-tools/home";
  }, [pathname]);

  return (
    <Layout className="dev-tools-page">
      <Sider
        className="dev-tools-sider"
        collapsible
        breakpoint="md"
        collapsed={false}
        collapsedWidth={80}
        trigger={null}
        width={240}
        onBreakpoint={(broken) => {
          console.log(broken, "broken");
        }}
      >
        <Header>
          <div className="dev-tools-sider-header">
            <div className="dev-tools-sider-header-icon">
              <AppstoreOutlined />
            </div>
            <span className="dev-tools-sider-header-title">
              不知道叫啥的某系统
            </span>
          </div>
        </Header>
        <Menu
          mode="inline"
          className="dev-tools-sider-menu"
          theme="light"
          selectedKeys={[selectedKey]}
          items={MENU_ITEMS}
          onClick={({ key }) => {
            const k = key as string;
            console.log('====================================');
            console.log(k,'k');
            console.log('====================================');
            if (k.startsWith("/dev-tools/")) router.push(k)
            console.log(k, "kkkk");
          }}
        />
      </Sider>
      <Layout>
        <Header></Header>
        <Content className="dev-tools-content">
          <div className="dev-tools-canvas">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default DevToolsLayout;
