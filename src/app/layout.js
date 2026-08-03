// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata = {
  title: "硬件物料库",
  description: "我让你好好分类你👂🐉吗",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d1117',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="zh-CN"
      // className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
