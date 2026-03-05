import {readFile, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexPath = join(__dirname, "..", "index.html");
const packageUrl = "https://hex.pm/api/packages/alloy";

async function fetchLatestStableVersion() {
  const response = await fetch(packageUrl, {
    headers: {Accept: "application/json"}
  });

  if (!response.ok) {
    throw new Error(`Hex API returned ${response.status}`);
  }

  const payload = await response.json();
  const releases = Array.isArray(payload.releases) ? payload.releases : [];

  const stableVersions = releases
    .map((release) => release?.version)
    .filter(
      (version) =>
        typeof version === "string" && /^\d+\.\d+\.\d+$/.test(version)
    );

  if (stableVersions.length === 0) {
    throw new Error("Could not find a stable release in Hex payload");
  }

  const sorted = stableVersions.sort((a, b) => {
    const [aMajor, aMinor, aPatch] = a.split(".").map(Number);
    const [bMajor, bMinor, bPatch] = b.split(".").map(Number);
    if (aMajor !== bMajor) return bMajor - aMajor;
    if (aMinor !== bMinor) return bMinor - aMinor;
    return bPatch - aPatch;
  });

  return sorted[0];
}

function updateIndexHtml(html, version) {
  let next = html;

  next = next.replace(
    /(<span id="hero-release-version">)v\d+\.\d+\.\d+(<\/span>)/,
    `$1v${version}$2`
  );

  next = next.replace(
    /(version in mix\.exs is )\d+\.\d+\.\d+/,
    `$1${version}`
  );

  next = next.replace(
    /(\{:alloy,\s*"~>\s*)\d+\.\d+\.\d+("\})/,
    `$1${version}$2`
  );

  return next;
}

async function main() {
  const [version, html] = await Promise.all([
    fetchLatestStableVersion(),
    readFile(indexPath, "utf8")
  ]);

  const updated = updateIndexHtml(html, version);

  if (updated === html) {
    console.log(`No version update needed (latest: ${version}).`);
    return;
  }

  await writeFile(indexPath, updated, "utf8");
  console.log(`Updated index.html to Alloy v${version}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
