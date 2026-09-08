import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../.."),
  dir = resolve(root, "docs/testing/evidence/wave6-smart-reallocation-closure"),
  manifest = JSON.parse(await readFile(resolve(dir, "manifest.json"), "utf8")),
  sha = (value) => createHash("sha256").update(value).digest("hex"),
  requiredStates = [
    "booking-A-preserved",
    "reallocation-loading",
    "reallocation-offers",
    "offer-with-missing-optional-facts",
    "offer-expiring",
    "offer-accept-confirmation",
    "booking-B-pending-A-preserved",
    "clinic-replacement-pending",
    "replacement-confirmed",
    "owner-final-replaced-booking",
    "replacement-rejected-original-preserved",
    "replacement-expired-original-preserved",
    "stale-offer",
    "no-alternatives",
    "error-retry",
  ];

if (manifest.status !== "PASS" || manifest.physicalDevice !== false)
  throw new Error("manifest status/classification mismatch");
for (const gate of [
  "realConfirmed",
  "realRejected",
  "realExpired",
  "staleOfferSafety",
  "bookingAPreservedUntilConfirmation",
  "ownerAuthoritativeReadback",
  "rankingOrderAndBound",
  "missingOptionalFactsUsable",
])
  if (manifest.checks[gate] !== "PASS") throw new Error(`failed gate ${gate}`);
if (
  manifest.checks.axeSeriousCritical !== 0 ||
  manifest.checks.horizontalOverflow !== 0 ||
  manifest.checks.minActionHeight < 44 ||
  manifest.checks.keyboardFocus !== "PASS" ||
  manifest.checks.rawEnumsVisible !== 0
)
  throw new Error("accessibility or presentation gate mismatch");
if (manifest.cases.length < 20 || manifest.cases.length > 26)
  throw new Error("screenshot bound mismatch");
for (const state of requiredStates)
  if (!manifest.states.includes(state)) throw new Error(`missing state ${state}`);
for (const viewport of [
  "390x844",
  "768x1024",
  "1440x900",
  "430x932",
  "1024x768",
])
  if (!manifest.viewports.includes(viewport))
    throw new Error(`missing viewport ${viewport}`);
for (const [file, hash] of Object.entries(manifest.sources))
  if (sha(await readFile(resolve(root, file))) !== hash)
    throw new Error(`source hash mismatch ${file}`);
for (const item of manifest.cases)
  if (sha(await readFile(resolve(dir, item.file))) !== item.sha256)
    throw new Error(`image hash mismatch ${item.file}`);
const pngs = (await readdir(dir)).filter((file) => file.endsWith(".png")).sort(),
  listed = manifest.cases.map((item) => item.file).sort();
if (JSON.stringify(pngs) !== JSON.stringify(listed))
  throw new Error("orphan or missing screenshot");
console.log(`Wave 6 smart reallocation evidence verified: ${listed.length}/${listed.length}`);
