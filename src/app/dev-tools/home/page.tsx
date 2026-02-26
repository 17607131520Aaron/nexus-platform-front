"use client";

import { Typography } from "antd";

const HomePage = () => {
  <>
    <Typography.Title level={5}>RN 日志控制台</Typography.Title>
    <Typography.Paragraph className="dev-tools-description">
      实时接收并展示 RN
      端上报的调试日志，支持按级别（INFO/WARN/ERROR）、模块、关键字过滤，
      方便快速排查线上问题。
    </Typography.Paragraph>
  </>;
};

export default HomePage;
