"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  Layout,
  Row,
  Segmented,
  Space,
  Tag,
  Typography,
} from "antd";

type ModuleKind = "site" | "cms" | "tool";

type ModuleEntry = {
  key: string;
  name: string;
  description: string;
  kind: ModuleKind;
  tags?: string[];
  href: string;
  openInNewTab?: boolean;
};

const MODULES: ModuleEntry[] = [
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
    key: "portal",
    name: "门户站点",
    description: "面向用户的站点入口（示例：外部站点/独立域名）。",
    kind: "site",
    tags: ["站点", "外部"],
    href: "https://nextjs.org/docs/app/getting-started/installation",
    openInNewTab: true,
  },
];

const KIND_LABEL: Record<ModuleKind, string> = {
  site: "站点",
  cms: "企业系统",
  tool: "工具",
};

export default function HomePage() {
  const [keyword, setKeyword] = useState("");
  const [kind, setKind] = useState<"all" | ModuleKind>("all");

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return MODULES.filter((m) => {
      if (kind !== "all" && m.kind !== kind) return false;
      if (!kw) return true;
      const hay =
        `${m.name} ${m.description} ${(m.tags ?? []).join(" ")}`.toLowerCase();
      return hay.includes(kw);
    });
  }, [keyword, kind]);

  return (
    <Layout style={{ height: "100%", background: "#0b1220" }}>
      <Layout.Header
        style={{
          background: "transparent",
          padding: "16px 20px",
          height: "auto",
        }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Space orientation="vertical" size={2}>
              <Typography.Title
                level={3}
                style={{ margin: 0, color: "#e6f0ff" }}
              >
                Nexus Platform
              </Typography.Title>
              <Typography.Text style={{ color: "rgba(230,240,255,.72)" }}>
                选择一个模块进入：可以是独立站点，也可以是“左菜单 +
                右内容”的企业系统。
              </Typography.Text>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button ghost>模块管理（占位）</Button>
              <Button type="primary">新增模块（占位）</Button>
            </Space>
          </Col>
        </Row>

        <Divider
          style={{ margin: "16px 0", borderColor: "rgba(255,255,255,.12)" }}
        />

        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索模块名称 / 描述 / 标签"
              allowClear
              size="large"
            />
          </Col>
          <Col>
            <Segmented
              size="large"
              value={kind}
              onChange={(v) => setKind(v as typeof kind)}
              options={[
                { label: "全部", value: "all" },
                { label: "站点", value: "site" },
                { label: "企业系统", value: "cms" },
                { label: "工具", value: "tool" },
              ]}
            />
          </Col>
        </Row>
      </Layout.Header>

      <Layout.Content style={{ padding: "0 20px 20px", overflow: "auto" }}>
        <Row gutter={[16, 16]}>
          {filtered.length === 0 ? (
            <Col span={24}>
              <Card
                bordered={false}
                style={{ background: "rgba(255,255,255,.06)" }}
              >
                <Empty
                  description={
                    <span style={{ color: "rgba(230,240,255,.72)" }}>
                      没有匹配的模块
                    </span>
                  }
                />
              </Card>
            </Col>
          ) : null}

          {filtered.map((m) => (
            <Col key={m.key} xs={24} sm={12} lg={8} xl={6}>
              <Badge.Ribbon
                text={KIND_LABEL[m.kind]}
                color={m.kind === "cms" ? "geekblue" : "cyan"}
              >
                <Card
                  hoverable
                  styles={{
                    body: {
                      minHeight: 150,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    },
                  }}
                  style={{
                    background: "rgba(255,255,255,.06)",
                    borderColor: "rgba(255,255,255,.10)",
                  }}
                >
                  <Space orientation="vertical" size={6} style={{ flex: 1 }}>
                    <Typography.Title
                      level={5}
                      style={{ margin: 0, color: "#e6f0ff" }}
                    >
                      {m.name}
                    </Typography.Title>
                    <Typography.Paragraph
                      style={{ margin: 0, color: "rgba(230,240,255,.72)" }}
                      ellipsis={{ rows: 2 }}
                    >
                      {m.description}
                    </Typography.Paragraph>
                    <Space size={[6, 6]} wrap>
                      {(m.tags ?? []).map((t) => (
                        <Tag
                          key={t}
                          style={{
                            background: "rgba(255,255,255,.08)",
                            borderColor: "rgba(255,255,255,.14)",
                            color: "rgba(230,240,255,.82)",
                          }}
                        >
                          {t}
                        </Tag>
                      ))}
                    </Space>
                  </Space>

                  <Divider
                    style={{
                      margin: "6px 0",
                      borderColor: "rgba(255,255,255,.10)",
                    }}
                  />

                  {m.openInNewTab ? (
                    <a
                      href={m.href}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#8ab4ff", fontWeight: 600 }}
                    >
                      打开模块 →
                    </a>
                  ) : (
                    <Link
                      href={m.href}
                      style={{ color: "#8ab4ff", fontWeight: 600 }}
                    >
                      进入模块 →
                    </Link>
                  )}
                </Card>
              </Badge.Ribbon>
            </Col>
          ))}
        </Row>
      </Layout.Content>
    </Layout>
  );
}
