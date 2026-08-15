/**
 * A stand-in for LEAD_STORE_URL.
 *
 * Several suites need the delivery path to actually succeed — a form that
 * cannot deliver returns 502 and never reaches its thank-you route, which would
 * make unrelated assertions fail for the wrong reason. This accepts every POST,
 * answers 200, and writes what it received to a file so a test can inspect the
 * record that was really persisted rather than the API's own reply.
 *
 *   node tests/collector.mjs [port] [outfile]
 */
import http from "node:http";
import { writeFileSync } from "node:fs";

const PORT = Number(process.argv[2] ?? 4899);
const OUT = process.argv[3] ?? "/tmp/test-collector.json";
const received = [];

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        received.push(JSON.parse(body));
      } catch {
        received.push({ unparsed: body.slice(0, 300) });
      }
      try {
        writeFileSync(OUT, JSON.stringify(received, null, 1));
      } catch {
        /* the file is a convenience, not a requirement */
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"ok":true}');
    });
  })
  .listen(PORT, () => console.error(`collector listening on ${PORT}`));
