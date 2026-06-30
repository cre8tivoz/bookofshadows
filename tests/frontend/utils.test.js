import { describe, expect, test } from "vitest";

import { esc, cleanContent, roleOf, shortId } from "../../static/src/utils/escape.js";
import { fmtBytes, prettyTime } from "../../static/src/utils/format.js";

describe("escape utilities", () => {
  test("escapes HTML-sensitive characters", () => {
    expect(esc(`<script data-x="1">Tom & Jerry's</script>`)).toBe(
      "&lt;script data-x=&quot;1&quot;&gt;Tom &amp; Jerry&#39;s&lt;/script&gt;",
    );
  });

  test("cleans chat role prefixes without changing normal content", () => {
    expect(cleanContent("[USER] remember this")).toBe("remember this");
    expect(cleanContent("[assistant] response")).toBe("response");
    expect(cleanContent("ordinary memory")).toBe("ordinary memory");
  });

  test("detects known role prefixes", () => {
    expect(roleOf("[SYSTEM] rules")).toBe("system");
    expect(roleOf("[assistant] response")).toBe("assistant");
    expect(roleOf("plain text")).toBe("");
  });

  test("shortens long identifiers while preserving head and tail", () => {
    expect(shortId("abcdefghijklmnop", 4, 3)).toBe("abcd…nop");
    expect(shortId("short", 4, 3)).toBe("short");
  });
});

describe("format utilities", () => {
  test("formats byte counts using binary units", () => {
    expect(fmtBytes(0)).toBe("0 B");
    expect(fmtBytes(512)).toBe("512 B");
    expect(fmtBytes(1536)).toBe("1.5 KB");
    expect(fmtBytes(1048576)).toBe("1.0 MB");
  });

  test("prettyTime keeps invalid values readable", () => {
    expect(prettyTime("not-a-date")).toBe("not-a-date");
    expect(prettyTime("")).toBe("");
  });

  test("prettyTime accepts an injected formatter for deterministic tests", () => {
    const formatter = new Intl.DateTimeFormat("en-AU", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    expect(prettyTime("2026-05-04T08:15:00Z", formatter)).toContain("4 May 2026");
  });
});
