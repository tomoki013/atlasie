import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
} from "jose";
import { beforeAll, expect, it } from "vitest";
import { verifyAccessToken } from "./index";

let privateKey: CryptoKey;
let keys: JWTVerifyGetKey;
beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: "test", alg: "RS256" }],
  });
});
async function token(
  sub: string,
  issuer = "https://test.auth0.com/",
  aud = "archive",
  expires = "2m",
) {
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer(issuer)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(privateKey);
}
it("accepts Google and Apple as separate exact identities", async () => {
  const google = await verifyAccessToken(
    await token("google-oauth2|same"),
    "test.auth0.com",
    "archive",
    keys,
  );
  const apple = await verifyAccessToken(
    await token("apple|same"),
    "test.auth0.com",
    "archive",
    keys,
  );
  expect(google.subject).not.toBe(apple.subject);
});
it("rejects wrong issuer, audience, expiry and additional login providers", async () => {
  for (const jwt of [
    await token("google-oauth2|x", "https://evil.test/"),
    await token("google-oauth2|x", undefined, "other"),
    await token("google-oauth2|x", undefined, undefined, "-1m"),
    await token("auth0|password"),
  ])
    await expect(
      verifyAccessToken(jwt, "test.auth0.com", "archive", keys),
    ).rejects.toThrow();
});
