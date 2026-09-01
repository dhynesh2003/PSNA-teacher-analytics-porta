import test from "node:test";
import assert from "node:assert/strict";
import { normalizedText, parsePercent, progressStatus, sourceHash } from "../src/normalization.js";

test("normalizes college variants", () => {
  assert.equal(normalizedText("PSNA College Of Engineering AND Technology"), "psna college of engineering and technology");
});
test("parses percentages", () => assert.equal(parsePercent("86.67%"), 86.67));
test("maps progress statuses", () => {
  assert.equal(progressStatus("Completed"), "completed");
  assert.equal(progressStatus("Not Attempted"), "not_attempted");
});
test("source hashes are deterministic", () => assert.equal(sourceHash("A", "B"), sourceHash("a", "b")));
