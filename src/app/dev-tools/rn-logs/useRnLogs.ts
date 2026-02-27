import { useState } from "react";

const useRnLogs = () => {
  const isConnecting = false;
  const isConnected = false;
  const filteredLogs: unknown[] = [];
  const [port, setPort] = useState<number>(3000);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");

  const handleConnectClick = (): void => undefined;

  const handleClose = (): void => undefined;
  const handleClearLogs = (): void => undefined;

  return {
    isConnecting,
    isConnected,
    port,
    setPort,
    handleConnectClick,
    handleClose,
    handleClearLogs,
    levelFilter,
    setLevelFilter,
    searchText,
    setSearchText,
    filteredLogs,
  };
};

export default useRnLogs;
