"use client";

import { Typography } from "antd";

const RnNetworkPage = () => {
  return (
    <>
      <Typography.Title level={5}>RN 网络请求监控</Typography.Title>
      <Typography.Paragraph className="dev-tools-description">
        展示 RN 端最近的网络请求列表、请求详情（方法、URL、状态码、耗时、请求 /
        响应 Body 等），支持按关键字、状态码、时间区间筛选。
      </Typography.Paragraph>
    </>
  );
};

export default RnNetworkPage;
