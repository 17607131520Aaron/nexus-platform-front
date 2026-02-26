"use client";

import { Typography } from "antd";

const LocalStoragePage = () => {
  <>
    <Typography.Title level={5}>本地缓存检查器</Typography.Title>
    <Typography.Paragraph className="dev-tools-description">
      浏览和搜索 RN 端本地存储的数据（如 AsyncStorage
      等），支持查看键值详情、导出指定数据， 后续可扩展清理和编辑能力。
    </Typography.Paragraph>
  </>;
};

export default LocalStoragePage;
