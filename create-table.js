/**
 * Creates the RealEstate-Listings DynamoDB table with its GSI.
 * Run once, from the Bastion Host or from any machine with AWS credentials:
 *
 *   AWS_REGION=us-east-1 DDB_TABLE=RealEstate-Listings npm run create-table
 *
 * On-demand billing (PAY_PER_REQUEST) is used so there is no hourly cost when
 * nobody is using the app - important for staying inside the free tier.
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE = process.env.DDB_TABLE || "RealEstate-Listings";

const ddb = new DynamoDBClient({ region: REGION });

async function main() {
  try {
    await ddb.send(new DescribeTableCommand({ TableName: TABLE }));
    console.log(`Table ${TABLE} already exists. Nothing to do.`);
    return;
  } catch (err) {
    if (err.name !== "ResourceNotFoundException") throw err;
  }

  await ddb.send(
    new CreateTableCommand({
      TableName: TABLE,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "listingId", AttributeType: "S" },
        { AttributeName: "category", AttributeType: "S" },
        { AttributeName: "createdAt", AttributeType: "S" },
      ],
      KeySchema: [{ AttributeName: "listingId", KeyType: "HASH" }],
      GlobalSecondaryIndexes: [
        {
          IndexName: "category-createdAt-index",
          KeySchema: [
            { AttributeName: "category", KeyType: "HASH" },
            { AttributeName: "createdAt", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
      SSESpecification: { Enabled: true },
      Tags: [
        { Key: "Project", Value: "RealEstate" },
        { Key: "Group", Value: "Group1" },
      ],
    })
  );

  console.log(`Created table ${TABLE} in ${REGION}.`);
  console.log("Wait about 30 seconds for it to become ACTIVE, then run: npm run seed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
