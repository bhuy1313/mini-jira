import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { NavigationLoadingToast } from "@/components/navigation-loading-toast";
import { ThemedToastContainer } from "@/components/themed-toast-container";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mini Jira",
  description: "A focused kanban workspace for small teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} h-full antialiased`}
      style={{
        fontFamily: plusJakartaSans.style.fontFamily,
      }}
    >
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <ThemeProvider>
          {children}
          <ThemedToastContainer />
        </ThemeProvider>
        <NavigationLoadingToast />
      </body>
    </html>
  );
}