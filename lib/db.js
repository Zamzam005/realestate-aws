/**
 * DynamoDB access layer.
 *
 * Table: RealEstate-Listings
 *   PK  listingId (S)
 *   GSI category-createdAt-index:  PK category (S), SK createdAt (S)
 *
 * No credentials are ever written here. The EC2 instance profile
 * (EC2-RealEstate-Role) supplies them automatically.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE = process.env.DDB_TABLE || "RealEstate-Listings";
const GSI = "category-createdAt-index";

const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

const CATEGORIES = new Set(["property", "vehicle"]);

function validate(input) {
  const errors = [];

  if (!input || typeof input !== "object") throw new ValidationError("Send a JSON body.");
  if (!CATEGORIES.has(input.category)) errors.push("category must be 'property' or 'vehicle'");
  if (!input.title || String(input.title).trim().length < 3) errors.push("title is too short");
  if (String(input.title || "").length > 120) errors.push("title is too long (max 120)");

  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) errors.push("price must be a positive number");

  if (!input.city || String(input.city).trim().length < 2) errors.push("city is required");
  if (!input.contactPhone || !/^\+?[0-9\s-]{7,20}$/.test(input.contactPhone)) {
    errors.push("contactPhone must be a valid phone number");
  }
  if (input.images && (!Array.isArray(input.images) || input.images.length > 8)) {
    errors.push("images must be a list of up to 8 S3 keys");
  }

  if (errors.length) throw new ValidationError(errors.join("; "));
  return price;
}

/** Create a listing. Returns the stored item. */
export async function putListing(input) {
  const price = validate(input);

  const item = {
    listingId: randomUUID(),
    category: input.category,
    title: String(input.title).trim(),
    description: String(input.description || "").slice(0, 2000),
    price,
    currency: input.currency === "SOS" ? "SOS" : "USD",
    city: String(input.city).trim(),
    district: input.district ? String(input.district).trim() : undefined,
    // property fields
    bedrooms: input.bedrooms != null ? Number(input.bedrooms) : undefined,
    bathrooms: input.bathrooms != null ? Number(input.bathrooms) : undefined,
    areaSqm: input.areaSqm != null ? Number(input.areaSqm) : undefined,
    // vehicle fields
    make: input.make || undefined,
    model: input.model || undefined,
    year: input.year != null ? Number(input.year) : undefined,
    mileageKm: input.mileageKm != null ? Number(input.mileageKm) : undefined,
    fuel: input.fuel || undefined,
    // shared
    images: Array.isArray(input.images) ? input.images.slice(0, 8) : [],
    contactName: input.contactName ? String(input.contactName).trim() : "Owner",
    contactPhone: String(input.contactPhone).trim(),
    status: "active",
    createdAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

export async function getListing(listingId) {
  const out = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { listingId } })
  );
  return out.Item || null;
}

/**
 * List listings.
 * With a category -> Query on the GSI (fast, newest first).
 * Without one    -> Scan (fine at project scale; a Query is always preferred
 *                   in production, and this is worth saying in the demo).
 */
export async function listListings({ category, city, limit = 24 } = {}) {
  let items;

  if (category && CATEGORIES.has(category)) {
    const out = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: GSI,
        KeyConditionExpression: "#c = :c",
        ExpressionAttributeNames: { "#c": "category" },
        ExpressionAttributeValues: { ":c": category },
        ScanIndexForward: false, // newest first
        Limit: limit,
      })
    );
    items = out.Items || [];
  } else {
    const out = await ddb.send(new ScanCommand({ TableName: TABLE, Limit: 100 }));
    items = (out.Items || []).sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );
  }

  if (city) {
    const needle = String(city).toLowerCase();
    items = items.filter((i) => String(i.city || "").toLowerCase().includes(needle));
  }

  return items.slice(0, limit);
}

/** Counts for the hero panel. Scan is acceptable here at project scale. */
export async function countByCategory() {
  const out = await ddb.send(
    new ScanCommand({ TableName: TABLE, ProjectionExpression: "category, city" })
  );
  const items = out.Items || [];
  const cities = new Set(items.map((i) => i.city).filter(Boolean));
  return {
    total: items.length,
    property: items.filter((i) => i.category === "property").length,
    vehicle: items.filter((i) => i.category === "vehicle").length,
    cities: cities.size,
  };
}
