"use client";

import { ToastContainer } from "react-toastify";

import { useTheme } from "@/components/theme/theme-provider";

/**
 * ToastContainer bám theo theme của app (light/dark) thay vì cố định.
 * Dark mode → toast nền đen + progress màu theo loại (đúng ảnh mẫu);
 * light mode → toast nền trắng.
 */
export function ThemedToastContainer() {
  const { resolvedTheme } = useTheme();
  return (
    <ToastContainer
      position="bottom-right"
      autoClose={4000}
      closeButton
      pauseOnHover
      draggable
      theme={resolvedTheme}
    />
  );
}
