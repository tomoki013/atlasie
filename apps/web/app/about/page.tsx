import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "tomokichi-diary — 写真と地図でつづる旅のアーカイブ",
  description: "ログインせずに始められる、あなただけの旅の地図。",
  robots: { index: true, follow: true },
  openGraph: {
    title: "tomokichi-diary",
    description: "旅した場所が、わたしをつくる。",
    type: "website",
  },
};
export default function About() {
  return (
    <main className="public-page about-page">
      <a href="/" className="public-brand">
        △ tomokichi-diary
      </a>
      <div className="eyebrow">MORE PLACES, A KINDER YOU.</div>
      <h1>
        あの景色が、
        <br />
        いまのわたしをつくっている。
      </h1>
      <p>
        写真と、ことばと、地図でつづる。
        <br />
        あなただけの旅のアーカイブ。
      </p>
      <img
        className="about-image"
        src="https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?auto=format&fit=crop&w=1400&q=85"
        alt="青い海と白い街並みのサントリーニ島"
      />
      <a className="primary" href="/">
        わたしの旅を、記録する →
      </a>
      <p>
        まずは、ログインせずに。
        <br />
        あなたの旅の記録は、あなただけのもの。
      </p>
    </main>
  );
}
