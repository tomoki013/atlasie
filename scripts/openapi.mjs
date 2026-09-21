import { writeFileSync } from "node:fs";
import { stringify } from "yaml";
import { z } from "zod";
import {
  importInput,
  memoryInput,
  placeInput,
  tripInput,
  uploadInput,
  visitInput,
} from "../packages/validation/src/index.ts";

const json = (schema) => ({ content: { "application/json": { schema } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const error = { description: "Request rejected", ...json(ref("Error")) };
const paths = {};
function route(
  path,
  method,
  operationId,
  response,
  body,
  status = "200",
  parameters = [],
  publicRoute = false,
) {
  paths[path] ??= {};
  paths[path][method] = {
    operationId,
    security: publicRoute ? [] : [{ bearerAuth: [] }],
    ...(parameters.length ? { parameters } : {}),
    ...(body ? { requestBody: { required: true, ...json(body) } } : {}),
    responses: {
      [status]: { description: "Success", ...(response ? json(response) : {}) },
      400: error,
      401: error,
      403: error,
      404: error,
      409: error,
      413: error,
      429: error,
      503: error,
    },
  };
}
const obj = (properties, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const string = { type: "string" },
  int = { type: "integer" },
  boolean = { type: "boolean" },
  id = { type: "string", format: "uuid" };
const param = (name) => ({ name, in: "path", required: true, schema: id });
const page = [
  {
    name: "limit",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
  {
    name: "offset",
    in: "query",
    schema: { type: "integer", minimum: 0, default: 0 },
  },
];
const items = (schema) => obj({ items: { type: "array", items: schema } });
route(
  "/v1/health",
  "get",
  "health",
  obj({ status: { const: "ok" } }),
  null,
  "200",
  [],
  true,
);
route(
  "/v1/auth/save-intent",
  "post",
  "createSaveIntent",
  obj({ grant: string }),
  obj({
    token: { type: "string", minLength: 1, maxLength: 2048 },
    importKey: id,
  }),
  "200",
  [],
  true,
);
route(
  "/v1/public/{slug}",
  "get",
  "publicProfile",
  ref("PublicProfile"),
  null,
  "200",
  [param("slug")],
  true,
);
route(
  "/v1/me",
  "get",
  "getMe",
  obj({ id, displayName: string, deleting: boolean }),
);
route(
  "/v1/me",
  "patch",
  "updateMe",
  obj({ displayName: string }),
  obj({ displayName: { type: "string", minLength: 1, maxLength: 80 } }),
);
route("/v1/me", "delete", "deleteMe", null, null, "204");
route(
  "/v1/places",
  "get",
  "searchPlaces",
  items(ref("PlaceInput")),
  null,
  "200",
  [
    { name: "q", in: "query", schema: { type: "string", maxLength: 100 } },
    { name: "visited", in: "query", schema: { type: "boolean" } },
    { name: "offset", in: "query", schema: { type: "integer", minimum: 0 } },
  ],
);
route(
  "/v1/places",
  "post",
  "createPlace",
  obj({ id }),
  ref("PlaceInput"),
  "201",
);
route("/v1/visits", "get", "listVisits", items(ref("Visit")), null, "200", [
  ...page,
  {
    name: "country",
    in: "query",
    schema: { type: "string", pattern: "^[A-Z]{2}$" },
  },
  {
    name: "year",
    in: "query",
    schema: { type: "string", pattern: "^\\d{4}$" },
  },
]);
route(
  "/v1/visits",
  "post",
  "createVisit",
  obj({ id }),
  ref("VisitInput"),
  "201",
);
route(
  "/v1/visits/{id}",
  "patch",
  "assignVisitTrip",
  obj({ id }),
  obj({ tripId: { anyOf: [id, { type: "null" }] } }),
  "200",
  [param("id")],
);
route("/v1/visits/{id}", "delete", "deleteVisit", null, null, "204", [
  param("id"),
]);
route(
  "/v1/memories/{visitId}",
  "patch",
  "updateMemory",
  obj({ id }),
  ref("MemoryInput"),
  "200",
  [param("visitId")],
);
route(
  "/v1/guest/import",
  "post",
  "importGuest",
  obj({ visitIds: { type: "array", items: id } }),
  ref("ImportInput"),
);
route(
  "/v1/map",
  "get",
  "mapSummary",
  obj({
    countries: {
      type: "array",
      items: obj({
        code: string,
        visits: int,
        places: int,
        photos: int,
        placeId: id,
        photoId: { anyOf: [id, { type: "null" }] },
      }),
    },
  }),
  null,
  "200",
  [
    {
      name: "bbox",
      in: "query",
      schema: { type: "string", example: "-180,-85,180,85" },
    },
  ],
);
route(
  "/v1/stats",
  "get",
  "getStats",
  obj({
    countries: int,
    places: int,
    cities: int,
    years: { type: "array", items: string },
    visits: int,
    photos: int,
    trips: int,
    memories: int,
  }),
);
route("/v1/trips", "get", "listTrips", items(obj({ id, title: string })));
route(
  "/v1/trips",
  "post",
  "createTrip",
  obj({ id, title: string }),
  ref("TripInput"),
  "201",
);
route("/v1/trips/{id}", "delete", "deleteTrip", null, null, "204", [
  param("id"),
]);
route("/v1/share", "get", "getShare", ref("Share"));
route(
  "/v1/share",
  "put",
  "updateShare",
  ref("Share"),
  obj({ enabled: boolean }),
);
route(
  "/v1/photos/upload",
  "post",
  "requestPhotoUpload",
  obj({ id, url: string, expiresIn: int }),
  ref("UploadInput"),
  "201",
);
route(
  "/v1/photos/{id}/complete",
  "post",
  "completePhoto",
  obj({ id, status: { const: "ready" } }),
  null,
  "200",
  [param("id")],
);
route(
  "/v1/photos/{id}/url",
  "get",
  "getPhotoUrl",
  obj({ url: string, expiresIn: int }),
  null,
  "200",
  [param("id")],
);
route("/v1/photos/{id}", "delete", "deletePhoto", null, null, "204", [
  param("id"),
]);
route(
  "/v1/mcp",
  "post",
  "publicMcp",
  { type: "object" },
  { type: "object" },
  "200",
  [],
  true,
);
paths["/v1/mcp"].post.responses["202"] = {
  description: "Notification accepted",
};
route(
  "/v1/mcp",
  "get",
  "mcpSseUnsupported",
  ref("Error"),
  null,
  "405",
  [],
  true,
);
route(
  "/v1/reports",
  "post",
  "reportPublicProfile",
  obj({ status: { const: "accepted" } }),
  obj({
    slug: id,
    reason: { enum: ["privacy", "spam", "other"] },
    token: { type: "string", minLength: 1, maxLength: 2048 },
  }),
  "202",
  [],
  true,
);
const schemas = {
  Error: obj({ error: string }),
  Visit: obj(
    {
      id,
      placeId: id,
      tripId: { anyOf: [id, { type: "null" }] },
      date: { type: "string", format: "date" },
      title: string,
      memo: string,
      photos: {
        type: "array",
        items: obj({ id, status: { enum: ["pending", "ready"] } }),
      },
    },
    ["id", "placeId", "date", "title", "memo", "photos"],
  ),
  Share: obj({ slug: id, enabled: boolean }),
  PublicProfile: obj({
    displayName: string,
    countries: { type: "array", items: string },
    stats: obj({ visits: int, photos: int }),
  }),
};
for (const [name, schema] of Object.entries({
  PlaceInput: placeInput,
  VisitInput: visitInput,
  UploadInput: uploadInput,
  TripInput: tripInput,
  MemoryInput: memoryInput,
  ImportInput: importInput,
})) {
  const { $schema, ...rest } = z.toJSONSchema(schema);
  schemas[name] = rest;
}
const spec = {
  openapi: "3.1.0",
  info: {
    title: "Travel Archive API",
    version: "0.1.0",
    description:
      "Private by default. JWT issuer and audience are verified; every private resource checks ownership. Guest photos upload separately after idempotent metadata import.",
  },
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas,
  },
};
writeFileSync(
  new URL("../openapi/openapi.yaml", import.meta.url),
  stringify(spec, { aliasDuplicateObjects: false }),
);
