/**
 * Lists API routes, app pages, Prisma models, and npm scripts for doc sync.
 * Usage: npx tsx scripts/doc-audit.ts
 */
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

function walk(dir: string, suffix: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full, suffix));
    } else if (name.endsWith(suffix)) {
      out.push(full);
    }
  }
  return out;
}

function routePathFromFile(file: string): string {
  const rel = path.relative(path.join(ROOT, "src/app/api"), file).replace(/\\/g, "/");
  const withoutRoute = rel.replace(/\/route\.ts$/, "");
  const segments = withoutRoute.split("/").map((seg) => {
    if (seg.startsWith("[") && seg.endsWith("]")) return `[${seg.slice(1, -1)}]`;
    return seg;
  });
  return "/api/" + segments.join("/");
}

function httpMethods(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const methods: string[] = [];
  for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    if (new RegExp(`export async function ${m}\\b`).test(src)) methods.push(m);
  }
  return methods;
}

function prismaModels(): string[] {
  const schema = readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
  return [...schema.matchAll(/^model (\w+)/gm)].map((m) => m[1]);
}

function packageScripts(): Record<string, string> {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  return pkg.scripts ?? {};
}

const routeFiles = walk(path.join(ROOT, "src/app/api"), "route.ts").sort();
const routes = routeFiles.map((f) => ({
  path: routePathFromFile(f),
  methods: httpMethods(f),
}));

const pages = walk(path.join(ROOT, "src/app"), "page.tsx")
  .map((f) => "/" + path.relative(path.join(ROOT, "src/app"), f).replace(/\\/g, "/").replace(/\/page\.tsx$/, ""))
  .map((p) => (p === "/" ? "/" : p.replace(/\/$/, "") || "/"))
  .sort();

const report = {
  generatedAt: new Date().toISOString().slice(0, 10),
  routeCount: routes.length,
  routes,
  pages,
  prismaModels: prismaModels(),
  npmScripts: packageScripts(),
};

console.log(JSON.stringify(report, null, 2));
