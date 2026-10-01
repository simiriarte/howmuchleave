// howmuchleave sync: stores one JSON blob per pond code in DynamoDB.
// GET  ?code=...                      -> { data, updatedAt } or 404
// PUT  { code, data, updatedAt }      -> { ok, updatedAt }
// Only the app's own site may call this (CORS on the Function URL).
import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";

const db = new DynamoDBClient({});
const TABLE = process.env.TABLE;
// pond codes look like coral-tuna-lantern-kelp-42
const CODE = /^[a-z]{3,10}(-[a-z]{3,10}){3}-\d{2}$/;
const MAX_BYTES = 20000;

const reply = (status, body) => ({ statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const handler = async (event) => {
  const method = event.requestContext?.http?.method;
  try {
    if (method === "GET") {
      const code = event.queryStringParameters?.code || "";
      if (!CODE.test(code)) return reply(400, { error: "bad code" });
      const out = await db.send(new GetItemCommand({ TableName: TABLE, Key: { code: { S: code } } }));
      if (!out.Item) return reply(404, { error: "no pond with that code" });
      return reply(200, { data: JSON.parse(out.Item.data.S), updatedAt: Number(out.Item.updatedAt.N) });
    }
    if (method === "PUT") {
      const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString() : event.body || "";
      if (raw.length > MAX_BYTES) return reply(413, { error: "too big" });
      const { code, data, updatedAt } = JSON.parse(raw);
      if (!CODE.test(code || "")) return reply(400, { error: "bad code" });
      if (typeof data !== "object" || data === null || !Array.isArray(data.trips)) return reply(400, { error: "bad data" });
      const when = Number(updatedAt) || Date.now();
      await db.send(new PutItemCommand({
        TableName: TABLE,
        Item: { code: { S: code }, data: { S: JSON.stringify(data) }, updatedAt: { N: String(when) } },
      }));
      return reply(200, { ok: true, updatedAt: when });
    }
    return reply(405, { error: "method not allowed" });
  } catch (e) {
    console.error(e);
    return reply(500, { error: "server error" });
  }
};
