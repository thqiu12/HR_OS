import { describe, it, expect } from "vitest";
import { parseCsv, csvToObjects } from "@/lib/csv";

describe("CSV parser", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([["a","b","c"],["1","2","3"]]);
  });

  it("handles quoted fields with commas", () => {
    expect(parseCsv('name,desc\n"Tanaka","loves, ramen"\n')).toEqual([["name","desc"],["Tanaka","loves, ramen"]]);
  });

  it("handles escaped quotes inside fields", () => {
    expect(parseCsv('"he said ""hi"""\n')).toEqual([['he said "hi"']]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a","b"],["1","2"]]);
  });

  it("csvToObjects converts to keyed records", () => {
    const objs = csvToObjects("name,age\n田中,30\n佐藤,25\n");
    expect(objs).toEqual([{ name: "田中", age: "30" }, { name: "佐藤", age: "25" }]);
  });

  it("skips empty lines", () => {
    expect(csvToObjects("a\n1\n\n2\n").length).toBe(2);
  });
});
