import { describe, expect, it } from "vitest";
import {
  checkableUrl,
  explainWithAi,
  isPublicAddress,
  readSource,
} from "./sourceCheck";

const now = new Date("2026-11-18T12:00:00Z");
const url = new URL("https://www.example.ca/poll");

const page = `<html><head>
<title>Support for a second sheet of ice | Example Research</title>
<meta property="og:site_name" content="Example Research">
<meta property="article:published_time" content="2024-03-12T08:00:00-07:00">
</head><body><script>var x = "65%";</script>
<p>A new survey finds that 65% of residents support a second sheet of ice. Opinion varied by age group.</p>
<p>The online survey of 1,204 respondents was conducted between March 1 and March 5, 2024. Results were weighted by age and region.</p>
</body></html>`;

describe("which links a server will open", () => {
  it("opens public https pages only", () => {
    expect(checkableUrl("https://example.ca/a")).not.toBeNull();
    for (const bad of [
      "http://example.ca/",
      "https://127.0.0.1/",
      "https://[::1]/",
      "https://localhost/",
      "https://intranet/",
      "https://user:pw@example.ca/",
      "https://example.ca:8443/",
      "file:///etc/passwd",
      "not a url",
    ])
      expect(checkableUrl(bad), bad).toBeNull();
  });

  it("refuses private, loopback and metadata addresses", () => {
    for (const ip of [
      "10.0.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.9",
      "192.168.1.1",
      "100.64.0.1",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
    ])
      expect(isPublicAddress(ip), ip).toBe(false);
    for (const ip of ["8.8.8.8", "142.250.80.46", "2606:4700::1111"])
      expect(isPublicAddress(ip), ip).toBe(true);
  });
});

describe("reading a source page", () => {
  const read = readSource(page, url, 65, now);

  it("reports what the page declares about itself", () => {
    expect(read.title).toBe(
      "Support for a second sheet of ice | Example Research",
    );
    expect(read.site).toBe("Example Research");
    expect(read.published).toBe("2024-03-12");
  });

  it("copies the sentences that state the figure and the method", () => {
    expect(read.statFound).toBe(true);
    expect(read.statExcerpts[0]).toContain("65% of residents");
    expect(read.methodExcerpts.join(" ")).toContain("1,204 respondents");
    expect(read.methodExcerpts.join(" ")).toContain("weighted");
  });

  it("does not find a figure the page does not state", () => {
    const miss = readSource(page, url, 41, now);
    expect(miss.statFound).toBe(false);
    expect(miss.statExcerpts).toEqual([]);
    // 165% is not 65%
    expect(
      readSource(
        "<p>Turnout reached 165% of forecast in the region.</p>",
        url,
        65,
        now,
      ).statFound,
    ).toBe(false);
  });

  it("invents no date and takes no figure from scripts", () => {
    const bare = readSource(
      "<title>x</title><p>No dates here at all, none.</p>",
      url,
      null,
      now,
    );
    expect(bare.published).toBeNull();
    expect(bare.statFound).toBeNull();
    expect(
      readSource(
        '<meta name="date" content="2031-01-01"><p>hello there friend.</p>',
        url,
        null,
        now,
      ).published,
    ).toBeNull();
  });
});

describe("optional AI help", () => {
  const found = {
    statExcerpts: ["65% of residents agree."],
    methodExcerpts: [],
  };

  it("does nothing when the page gave it nothing to work from", async () => {
    let called = false;
    const out = await explainWithAi(
      "c",
      { statExcerpts: [], methodExcerpts: [] },
      async () => {
        called = true;
        return "{}";
      },
    );
    expect(out).toBeNull();
    expect(called).toBe(false);
  });

  it("keeps only what it says, and drops 'not stated'", async () => {
    const out = await explainWithAi("c", found, async (system, user) => {
      expect(system).toMatch(/ONLY/);
      expect(user).toContain("65% of residents agree.");
      return '```json\n{"measures":"Support among residents.","method":"not stated"}\n```';
    });
    expect(out).toEqual({ measures: "Support among residents.", method: null });
  });

  it("treats a malformed reply as no answer", async () => {
    expect(await explainWithAi("c", found, async () => "sure!")).toBeNull();
  });
});
