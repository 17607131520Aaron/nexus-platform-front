"use client";

import {
  BugOutlined,
  DatabaseOutlined,
  CloudOutlined,
  ApiOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";

export type DevToolsMenuItem = Required<MenuProps>["items"][number];

export const MENU_ITEMS: NonNullable<MenuProps["items"]> = [
  //首页
  {
    key: "/dev-tools/home",
    icon: <HomeOutlined />,
    label: "首页",
  },
  {
    key: "rn-tools",
    icon: <ApiOutlined />,
    label: "React Native 调试",
    children: [
      {
        key: "/dev-tools/rn-logs",
        icon: <BugOutlined />,
        label: "日志",
      },
      {
        key: "/dev-tools/rn-network",
        icon: <CloudOutlined />,
        label: "网络",
      },
      {
        key: "/dev-tools/local-storage",
        icon: <DatabaseOutlined />,
        label: "本地缓存",
      },
    ],
  },
];
