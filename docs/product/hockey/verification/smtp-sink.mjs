#!/usr/bin/env node
/**
 * **A mailbox for the local stack.** Accepts whatever GoTrue sends on
 * SMTP_PORT (default 2525) and writes each message to $MAIL_DIR
 * (default /tmp/hockey-mail) as `<n>.eml`, so a test can read the
 * confirmation email a real inbox would have received. Not an SMTP server
 * anybody should point anything real at: no auth, no TLS, no relay.
 */
import net from "node:net";
import fs from "node:fs";

const PORT = Number(process.env.SMTP_PORT ?? 2525);
const DIR = process.env.MAIL_DIR ?? "/tmp/hockey-mail";
fs.mkdirSync(DIR, { recursive: true });
let n = fs.readdirSync(DIR).length;

net
  .createServer((sock) => {
    let data = false;
    let body = "";
    let buf = "";
    sock.write("220 hockey.local ESMTP\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (data) {
          if (line === ".") {
            data = false;
            fs.writeFileSync(`${DIR}/${++n}.eml`, body);
            body = "";
            sock.write("250 queued\r\n");
          } else body += (line.startsWith("..") ? line.slice(1) : line) + "\n";
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO")
          sock.write("250-hockey.local\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (cmd === "AUTH") sock.write("235 ok\r\n");
        else if (cmd === "DATA") {
          data = true;
          sock.write("354 go\r\n");
        } else if (cmd === "QUIT") sock.end("221 bye\r\n");
        else sock.write("250 ok\r\n");
      }
    });
    sock.on("error", () => {});
  })
  .listen(PORT, "127.0.0.1", () =>
    console.log(`mail sink on ${PORT} -> ${DIR}`),
  );
