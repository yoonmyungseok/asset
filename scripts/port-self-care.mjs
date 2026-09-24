/**
 * One-time port from ../self-care into this repo. Run: node scripts/port-self-care.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.resolve(ROOT, "..", "self-care");

const REPLACEMENTS = [
  [/@\/components\/ui\//g, "@/components/care/ui/"],
  [/@\/components\/charts\//g, "@/components/care/charts/"],
  [/@\/components\/Providers/g, "@/components/care/Providers"],
  [/@\/lib\/validations\//g, "@/lib/care/validations/"],
  [/@\/lib\/integrations\//g, "@/lib/care/integrations/"],
  [/@\/lib\/services\//g, "@/lib/care/services/"],
  [/@\/lib\/calculations\//g, "@/lib/care/calculations/"],
  [/@\/lib\/format\//g, "@/lib/care/format/"],
  [/@\/lib\/running-type-defaults/g, "@/lib/care/running-type-defaults"],
  [/@\/lib\/constants/g, "@/lib/care/constants"],
  [/@\/lib\/utils/g, "@/lib/care/utils"],
];

const SKIP = new Set([
  path.normalize("src/lib/db.ts"),
  path.normalize("src/components/layout/AppLayout.tsx"),
  path.normalize("src/components/layout/Sidebar.tsx"),
  path.normalize("src/app/layout.tsx"),
  path.normalize("src/app/page.tsx"),
  path.normalize("src/app/settings/page.tsx"),
]);

const COPY_MAP = [
  { from: "src/lib/utils.ts", to: "src/lib/care/utils.ts" },
  { from: "src/lib/constants.ts", to: "src/lib/care/constants.ts" },
  { from: "src/lib/running-type-defaults.ts", to: "src/lib/care/running-type-defaults.ts" },
  { from: "src/lib/calculations", to: "src/lib/care/calculations" },
  { from: "src/lib/format", to: "src/lib/care/format" },
  { from: "src/lib/integrations", to: "src/lib/care/integrations" },
  { from: "src/lib/services", to: "src/lib/care/services" },
  { from: "src/lib/validations", to: "src/lib/care/validations" },
  { from: "src/components/ui", to: "src/components/care/ui" },
  { from: "src/components/charts", to: "src/components/care/charts" },
  { from: "src/components/Providers.tsx", to: "src/components/care/Providers.tsx" },
  { from: "src/app/api", to: "src/app/api" },
  { from: "src/app/weight", to: "src/app/weight" },
  { from: "src/app/running", to: "src/app/running" },
  { from: "src/app/running-settings", to: "src/app/running-settings" },
  { from: "src/app/diet", to: "src/app/diet" },
  { from: "src/app/food-settings", to: "src/app/food-settings" },
  { from: "src/app/settings/page.tsx", to: "src/components/care/HealthSettingsPanel.tsx" },
  { from: "src/app/page.tsx", to: "src/components/care/CareDashboardSection.tsx" },
];

function transform(content) {
  let out = content;
  for (const [re, rep] of REPLACEMENTS) {
    out = out.replace(re, rep);
  }
  out = out.replace(
    /import \{ AppLayout \} from "@\/components\/layout\/AppLayout";?\r?\n/g,
    "",
  );
  out = out.replace(
    /<AppLayout>\s*/g,
    "",
  );
  out = out.replace(
    /\s*<\/AppLayout>/g,
    "",
  );
  return out;
}

function copyFile(relFrom, relTo) {
  const from = path.join(SRC, relFrom);
  const to = path.join(ROOT, relTo);
  if (!fs.existsSync(from)) {
    console.warn("skip missing", relFrom);
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  let content = fs.readFileSync(from, "utf8");
  if (relFrom.endsWith(".ts") || relFrom.endsWith(".tsx")) {
    content = transform(content);
  }
  fs.writeFileSync(to, content);
  console.log("wrote", relTo);
}

function copyTree(relFrom, relTo) {
  const from = path.join(SRC, relFrom);
  if (!fs.existsSync(from)) return;
  const stat = fs.statSync(from);
  if (stat.isFile()) {
    copyFile(relFrom, relTo);
    return;
  }
  for (const name of fs.readdirSync(from)) {
    const childFrom = path.join(relFrom, name);
    const childTo = path.join(relTo, name);
    const norm = path.normalize(childFrom);
    if (SKIP.has(norm)) continue;
    if (fs.statSync(path.join(SRC, childFrom)).isDirectory()) {
      copyTree(childFrom, childTo);
    } else {
      copyFile(childFrom, childTo);
    }
  }
}

if (!fs.existsSync(SRC)) {
  console.error("self-care not found at", SRC);
  process.exit(1);
}

for (const { from, to } of COPY_MAP) {
  copyTree(from, to);
}

console.log("Done. Review settings page and home dashboard manually.");
