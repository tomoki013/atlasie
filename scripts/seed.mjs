import { writeFileSync } from "node:fs";
import countries from "i18n-iso-countries";
import { countryPlaces, places } from "../apps/web/lib/data.ts";

const sqlLiteral = (s) => `'${s.replaceAll("'", "''")}'`;
const display = new Intl.DisplayNames(["ja"], { type: "region" });
let sql =
  "BEGIN;\nINSERT INTO countries(code,name) VALUES\n" +
  Object.keys(countries.getAlpha2Codes())
    .filter((code) => code !== "XK")
    .map((code) => `(${sqlLiteral(code)},${sqlLiteral(display.of(code))})`)
    .join(",\n") +
  "\nON CONFLICT DO NOTHING;\n";
sql +=
  "INSERT INTO places(id,country_code,name,location,kind) VALUES\n" +
  [...places, ...countryPlaces]
    .map(
      (p) =>
        `(${sqlLiteral(p.id)},${sqlLiteral(p.code)},${sqlLiteral(p.name)},ST_SetSRID(ST_MakePoint(${p.coordinates.join(",")}),4326)::geography,${sqlLiteral(p.kind ?? "place")})`,
    )
    .join(",\n") +
  "\nON CONFLICT DO NOTHING;\nCOMMIT;\n";
writeFileSync(
  new URL("../db/seeds/001_countries_places.sql", import.meta.url),
  sql,
);
