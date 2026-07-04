import { describe, it, expect } from "vitest";
import { parseModelJson } from "../server/lib/modelJson";

describe("parseModelJson", () => {
  it("parses plain JSON", () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips ```json fences", () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("strips bare ``` fences", () => {
    expect(parseModelJson('```\n{"b":2}\n```')).toEqual({ b: 2 });
  });

  it("extracts a {...} block from surrounding prose", () => {
    expect(parseModelJson('Sure! Here is the result:\n{"c":3}\nHope that helps.')).toEqual({ c: 3 });
  });

  it("parses nested objects", () => {
    expect(parseModelJson('{"title":"x","meta":{"n":2}}')).toEqual({ title: "x", meta: { n: 2 } });
  });

  it("throws when there is no JSON", () => {
    expect(() => parseModelJson("no json here")).toThrow();
  });
});
