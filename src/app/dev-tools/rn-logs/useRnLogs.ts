import { useState } from "react";
const useRnLogs = () => {
  const isConnecting = false;
  const isConnected = false;
  const filteredLogs:Array<[]> = []
  const [port, setPort] = useState<number>(3000);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>("");

  const handleConnectClick = () => {};

  const handleClose = () => {};
  const handleClearLogs = () => {};

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
