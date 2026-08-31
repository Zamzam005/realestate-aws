/**
 * S3 storage layer.
 *
 * The bucket stays private (Block Public Access ON). Images are read through
 * CloudFront using an Origin Access Control, and written by the browser using
 * a presigned PUT URL that expires in 5 minutes.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import path from "node:path";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.S3_BUCKET;
const CDN_DOMAIN = process.env.CDN_DOMAIN; // e.g. d111111abcdef8.cloudfront.net

const s3 = new S3Client({ region: REGION });

/** Returns { key, url } where url is a 5-minute presigned PUT URL. */
export async function presignUpload(filename, contentType) {
  const ext = (path.extname(filename) || ".jpg").toLowerCase();
  const key = `listings/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    }),
    { expiresIn: 300 }
  );

  return { key, url };
}

/** Public read URL for an object, served through CloudFront. */
export function publicUrlFor(key) {
  if (!key) return null;
  if (CDN_DOMAIN) return `https://${CDN_DOMAIN}/${key}`;
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}
