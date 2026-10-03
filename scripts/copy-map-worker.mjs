import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// maplibre-gl is a dependency of apps/web. Resolve it from there instead of
// assuming a hoisted root node_modules (pnpm does not hoist).
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");

const target = new URL("../apps/web/public/maplibre/", import.meta.url);
mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"])
  copyFileSync(join(dist, file), new URL(file, target));
