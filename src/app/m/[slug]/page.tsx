"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Layout, Menu, Space, Typography, Button, Breadcrumb, Card, Divider } from "antd";

type MenuKey = "overview" | "content" | "settings";

const MENU_ITEMS = [
  { key: "overview", label: "概览" },
  { key: "content", label: "内容区（示例）" },
  { key: "settings", label: "设置（示例）" },
] as const;

export default function ModuleShellPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "module";

  return (
    <Layout style={{ height: "100vh" }}>
      <Layout.Sider
        width={260}
        theme="dark"
        style={{
          padding: 12,
          overflow: "auto",
        }}
      >
        <Space orientation="vertical" size={10} style={{ width: "100%" }}>
          <Space orientation="vertical" size={2} style={{ width: "100%" }}>
            <Typography.Text style={{ color: "rgba(255,255,255,.75)" }}>
              模块
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: 0, color: "#fff" }}>
              {slug}
            </Typography.Title>
          </Space>

          <Menu
            mode="inline"
            theme="dark"
            defaultSelectedKeys={["overview" satisfies MenuKey]}
            items={MENU_ITEMS.map((i) => ({ key: i.key, label: i.label }))}
            style={{ borderRadius: 8 }}
          />

          <Divider style={{ margin: "6px 0", borderColor: "rgba(255,255,255,.12)" }} />

          <Space orientation="vertical" size={8} style={{ width: "100%" }}>
            <Link href="/" style={{ color: "rgba(255,255,255,.85)" }}>
              ← 返回模块入口
            </Link>
            <Button block type="primary">
              主要操作（占位）
            </Button>
            <Button block>次要操作（占位）</Button>
          </Space>
        </Space>
      </Layout.Sider>

      <Layout>
        <Layout.Header style={{ background: "#fff", padding: "0 16px" }}>
          <Breadcrumb
            items={[
              { title: <Link href="/">模块入口</Link> },
              { title: slug },
            ]}
          />
        </Layout.Header>

        <Layout.Content style={{ padding: 16, overflow: "auto", background: "#f5f7fb" }}>
          <Space orientation="vertical" size={12} style={{ width: "100%" }}>
            <Card>
              <Typography.Title level={3} style={{ marginTop: 0 }}>
                {slug} 模块
              </Typography.Title>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                这是一个通用的模块承载页骨架：左侧菜单栏，右侧内容区域。后续你可以把真实的
                路由、页面和权限控制接进来（比如按 slug 加载不同模块配置）。
              </Typography.Paragraph>
            </Card>

            <Card title="内容区（示例）">
              <Typography.Paragraph>
                这里可以渲染模块的具体页面，比如 CMS 的列表页、编辑页、配置页等。
              </Typography.Paragraph>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                如果你希望“点击左侧菜单切换右侧内容”，我们可以把菜单状态做成路由
              </Typography.Paragraph>
            </Card>
          </Space>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

