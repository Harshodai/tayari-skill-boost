import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

describe("ResumeUpload.tsx cloud-path removal", () => {
  const source = readFileSync(new URL("./ResumeUpload.tsx", import.meta.url), "utf8");
  const sf = ts.createSourceFile("ResumeUpload.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const imports = sf.statements.filter(ts.isImportDeclaration);
  const importedFrom = (spec: string) =>
    imports.some((imp) => {
      const mod = (imp.moduleSpecifier as ts.StringLiteral).text;
      return mod === spec || mod.endsWith(`/${spec}`) || mod.endsWith(`/${spec}.ts`);
    });

  it("imports analyzeResume from the Go-gateway @/api barrel", () => {
    const apiImport = imports.find((imp) => {
      const mod = (imp.moduleSpecifier as ts.StringLiteral).text;
      return mod === "@/api" || mod.endsWith("/api");
    });
    expect(apiImport).toBeDefined();
    const names = apiImport!.importClause!.namedBindings as ts.NamedImports;
    const imported = names.elements.map((e) => e.name.text);
    expect(imported).toContain("analyzeResume");
  });

  it("never imports the supabase client (cloud path unreachable)", () => {
    expect(importedFrom("supabase")).toBe(false);
    expect(importedFrom("@/integrations/supabase/client")).toBe(false);
  });

  it("has no functions.invoke call anywhere (aliases/computed names included)", () => {
    const invokes: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (ts.isPropertyAccessExpression(callee) && callee.name.text === "invoke") {
          invokes.push(callee.expression.getText(sf));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    expect(invokes).toEqual([]);
  });

  it("has no USE_SELF_HOSTED identifier usage", () => {
    const uses: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && node.text === "USE_SELF_HOSTED") uses.push(node.text);
      ts.forEachChild(node, visit);
    };
    visit(sf);
    expect(uses).toEqual([]);
  });

  it("no longer references the analyze-resume edge function (substring guard)", () => {
    expect(source).not.toContain("functions.invoke");
    expect(source).not.toContain("analyze-resume");
  });

  it("no longer branches on USE_SELF_HOSTED for analysis (substring guard)", () => {
    expect(source).not.toContain("if (USE_SELF_HOSTED)");
  });
});
