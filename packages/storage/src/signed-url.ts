import { AwsClient } from "aws4fetch";
export async function signedR2Url(
  config: {
    accountId: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
  },
  key: string,
  method: "GET" | "PUT",
) {
  if (!config.accountId || !config.accessKey || !config.secretKey)
    throw new Error("Storage unavailable");
  const aws = new AwsClient({
    accessKeyId: config.accessKey,
    secretAccessKey: config.secretKey,
    service: "s3",
    region: "auto",
  });
  const url = new URL(
    `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`,
  );
  url.searchParams.set("X-Amz-Expires", "300");
  const request = await aws.sign(
    new Request(url, {
      method,
      headers: method === "PUT" ? { "Content-Type": "image/jpeg" } : undefined,
    }),
    { aws: { signQuery: true, allHeaders: true } },
  );
  return request.url;
}
