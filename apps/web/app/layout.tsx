import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "tomokichi-diary | 旅した場所が、わたしをつくる。",
  description: "写真と、ことばと、地図でつづる、あなただけの旅のアーカイブ。",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
