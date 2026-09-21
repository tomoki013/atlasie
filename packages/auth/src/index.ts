import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
export async function verifyAccessToken(
  token: string,
  domain: string,
  audience: string,
  keys?: JWTVerifyGetKey,
) {
  if (!domain || !audience) throw new Error("Authentication unavailable");
  const issuer = `https://${domain}/`;
  const { payload } = await jwtVerify(
    token,
    keys ?? createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`)),
    {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "exp", "iat"],
    },
  );
  if (
    !payload.sub ||
    !["google-oauth2", "apple"].includes(payload.sub.split("|")[0])
  )
    throw new Error("Unsupported identity provider");
  return { issuer, subject: payload.sub };
}
