import { readFileSync } from "node:fs";
import SwaggerParser from "@apidevtools/swagger-parser";
import { expect, it } from "vitest";
import { parse } from "yaml";
import { app } from "../apps/api/src";

it("validates OpenAPI and covers every registered HTTP endpoint", async () => {
  await SwaggerParser.validate("openapi/openapi.yaml");
  const spec = parse(readFileSync("openapi/openapi.yaml", "utf8"));
  const implemented = app.routes
    .filter((r) => r.method !== "ALL")
    .map(
      (r) =>
        `${r.method.toLowerCase()} ${r.path.replace(/:([A-Za-z]+)/g, "{$1}")}`,
    )
    .sort();
  const documented = Object.entries(spec.paths)
    .flatMap(([path, methods]) =>
      Object.keys(methods as object).map((method) => `${method} ${path}`),
    )
    .sort();
  expect(implemented).toEqual(documented);
});
