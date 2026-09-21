import { writeFileSync } from "node:fs";
import iso from "i18n-iso-countries";
import countries from "world-countries";

const names = new Intl.DisplayNames(["ja"], { type: "region" });
const rows = countries
  .filter((c) => iso.isValid(c.cca2) && c.cca2 !== "XK")
  .sort((a, b) => a.cca2.localeCompare(b.cca2))
  .map((c, i) => ({
    id: `00000000-0000-4000-8100-${String(i + 1).padStart(12, "0")}`,
    name: names.of(c.cca2),
    country: names.of(c.cca2),
    code: c.cca2,
    flag: c.flag,
    coordinates: [c.latlng[1], Math.max(-85, Math.min(85, c.latlng[0]))],
    image: "/place-placeholder.svg",
    description: "この国で出会った景色を、旅の記録に。",
    kind: "country",
  }));
writeFileSync(
  new URL("../apps/web/lib/country-catalog.json", import.meta.url),
  JSON.stringify(rows),
);
