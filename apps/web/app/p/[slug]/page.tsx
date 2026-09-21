import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import PublicAgent from "@/components/public-agent";
import PublicMap from "@/components/public-map";
import PublicReport from "@/components/public-report";

type Profile = {
  displayName: string;
  countries: string[];
  stats: { visits: number; photos: number };
};
const getProfile = cache(async (slug: string): Promise<Profile> => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      slug,
    ) ||
    !process.env.NEXT_PUBLIC_API_URL
  )
    notFound();
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/public/${slug}`,
    { cache: "no-store" },
  );
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Profile unavailable");
  return response.json();
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProfile(slug);
  return {
    title: `${p.displayName}の旅の地図 | tomokichi-diary`,
    description: `${p.countries.length}か国を訪れた旅の足あと。`,
    robots: { index: true, follow: true },
    alternates: process.env.NEXT_PUBLIC_SITE_URL
      ? { canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/p/${slug}` }
      : {},
    openGraph: {
      title: `${p.displayName}の旅の地図`,
      description: "旅した場所が、わたしをつくる。",
      type: "profile",
    },
  };
}
export default async function PublicProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getProfile(slug);
  const display = new Intl.DisplayNames(["ja"], { type: "region" });
  return (
    <main className="public-page">
      <PublicAgent summary={p} />
      <a className="public-brand" href="/about">
        △ tomokichi-diary
      </a>
      <div className="eyebrow">A WORLD OF MEMORIES</div>
      <h1>{p.displayName}の旅の地図</h1>
      <p>旅した場所が、わたしをつくる。</p>
      <PublicMap countries={p.countries} />
      <div className="profile-stats">
        <span>
          <strong>{p.countries.length}</strong>訪れた国
        </span>
        <span>
          <strong>{p.stats.visits}</strong>訪問回数
        </span>
        <span>
          <strong>{p.stats.photos}</strong>写真
        </span>
      </div>
      <div className="country-chips">
        {p.countries.map((code) => (
          <span key={code}>{display.of(code)}</span>
        ))}
      </div>
      <PublicReport slug={slug} />
      <a href="/" className="primary">
        あなたの旅を記録する →
      </a>
    </main>
  );
}
