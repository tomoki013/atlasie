"use client";
import dynamic from "next/dynamic";

const WorldMap = dynamic(() => import("./world-map"), { ssr: false });
export default function PublicMap({ countries }: { countries: string[] }) {
  return (
    <section className="world-card public-world">
      <WorldMap
        places={[]}
        visits={[]}
        selected={null}
        onSelect={() => {}}
        countryCodes={countries}
      />
    </section>
  );
}
