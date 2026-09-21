import { copyFileSync, mkdirSync } from "node:fs";

const target = new URL("../apps/web/public/maplibre/", import.meta.url);
mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"])
  copyFileSync(
    new URL(`../node_modules/maplibre-gl/dist/${file}`, import.meta.url),
    new URL(file, target),
  );
