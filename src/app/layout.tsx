import "@/app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LINA Store",
  description: "Cross-border e-commerce from China to Southeast Asia",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
