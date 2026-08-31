/**
 * RealEstate - cloud-based real estate & vehicle marketplace
 * Group 1 | Bile Initiative Cloud Final Project
 *
 * Runs on the EC2 Application Servers inside Private Subnet A (10.0.3.0/24)
 * and Private Subnet B (10.0.4.0/24). Traffic reaches it only through the ALB.
 *
 * Data  -> Amazon DynamoDB  (via VPC Gateway Endpoint, no internet needed)
 * Files -> Amazon S3        (via VPC Gateway Endpoint, no internet needed)
 */

import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listListings, getListing, putListing, putMessage, countByCategory } from "./lib/db.js";
import { presignUpload, publicUrlFor } from "./lib/storage.js";
import { getInstanceIdentity } from "./lib/metadata.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// --- middleware -----------------------------------------------------------
// CSP and HSTS are disabled here on purpose.
// Helmet's default CSP sends "upgrade-insecure-requests", which tells the
// browser to fetch styles.css and app.js over HTTPS. Behind a plain HTTP ALB
// those requests fail and the page renders as unstyled text. CloudFront
// provides HTTPS and security headers at the edge (Step 16).
app.use(
  helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "5m" }));

// Trust the ALB so req.ip / X-Forwarded-For are correct in the logs
app.set("trust proxy", true);

// Simple request log -> stdout -> CloudWatch Agent -> CloudWatch Logs
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - start,
        ip: req.ip,
      })
    );
  });
  next();
});

// --- version marker -------------------------------------------------------
// Open /api/version in a browser to confirm which build the servers are on.
// If it does not say v2, the instances are still running the old app.zip.
const BUILD = "v2-csp-disabled";
app.get("/api/version", (req, res) => {
  res.json({ version: BUILD, startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString() });
});

// --- health check ---------------------------------------------------------
// The ALB Target Group points at this path. Keep it cheap and never block on
// DynamoDB, or one slow query will make the ALB kill healthy instances.
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// --- instance identity (the live demo badge) ------------------------------
// Proves to the audience that the ALB is really balancing across two AZs.
app.get("/api/meta", async (req, res) => {
  const identity = await getInstanceIdentity();
  res.json(identity);
});

// --- listings -------------------------------------------------------------
app.get("/api/listings", async (req, res) => {
  try {
    const { category, city, limit } = req.query;
    const items = await listListings({
      category,
      city,
      limit: Math.min(Number(limit) || 24, 100),
    });
    res.json({ count: items.length, items });
  } catch (err) {
    console.error("listListings failed", err);
    res.status(500).json({ error: "Could not load listings. Try again." });
  }
});

app.get("/api/listings/:id", async (req, res) => {
  try {
    const item = await getListing(req.params.id);
    if (!item) return res.status(404).json({ error: "Listing not found." });
    res.json(item);
  } catch (err) {
    console.error("getListing failed", err);
    res.status(500).json({ error: "Could not load this listing." });
  }
});

app.post("/api/listings", async (req, res) => {
  try {
    const item = await putListing(req.body);
    res.status(201).json(item);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    console.error("putListing failed", err);
    res.status(500).json({ error: "Could not save the listing." });
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const item = await putMessage(req.body);
    res.status(201).json(item);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    console.error("putMessage failed", err);
    res.status(500).json({ error: "Could not send your message." });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    res.json(await countByCategory());
  } catch (err) {
    console.error("countByCategory failed", err);
    res.status(500).json({ error: "Could not load stats." });
  }
});

// --- image uploads --------------------------------------------------------
// The browser asks the app for a short-lived presigned PUT URL, then uploads
// straight to S3. The EC2 instance never handles the image bytes.
app.post("/api/uploads/presign", async (req, res) => {
  try {
    const { filename, contentType } = req.body || {};
    if (!filename || !contentType) {
      return res.status(400).json({ error: "Send filename and contentType." });
    }
    if (!/^image\/(jpeg|png|webp)$/.test(contentType)) {
      return res.status(400).json({ error: "Only JPEG, PNG or WebP images." });
    }
    const { key, url } = await presignUpload(filename, contentType);
    res.json({ key, uploadUrl: url, fileUrl: publicUrlFor(key) });
  } catch (err) {
    console.error("presignUpload failed", err);
    res.status(500).json({ error: "Could not prepare the upload." });
  }
});

// --- start ----------------------------------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`RealEstate app listening on 0.0.0.0:${PORT}`);
  console.log(`  region: ${process.env.AWS_REGION}`);
  console.log(`  table:  ${process.env.DDB_TABLE}`);
  console.log(`  bucket: ${process.env.S3_BUCKET}`);
});
