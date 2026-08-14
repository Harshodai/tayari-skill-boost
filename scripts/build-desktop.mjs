import { spawnSync } from "node:child_process";
import process from "node:process";

function fail(message) {
  console.error(`[desktop-build] ${message}`);
  process.exit(1);
}

function validateReleaseEnvironment() {
  const required = ["VITE_API_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    fail(`Missing required release environment variable(s): ${missing.join(", ")}`);
  }

  let apiUrl;
  try {
    apiUrl = new URL(process.env.VITE_API_URL);
  } catch {
    fail("VITE_API_URL must be a valid URL.");
  }
  const isLoopback = apiUrl.hostname === "127.0.0.1" || apiUrl.hostname === "localhost" || apiUrl.hostname === "::1";
  if (apiUrl.protocol !== "https:" || isLoopback) {
    fail("VITE_API_URL must use HTTPS and must not point to a local loopback service.");
  }
}

function run(label, args, env) {
  console.log(`[desktop-build] ${label}`);
  const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(packageManager, ["exec", ...args], { stdio: "inherit", env, shell: false });
  if (result.error) fail(label + " could not start: " + result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

validateReleaseEnvironment();
const env = {
  ...process.env,
  VITE_DESKTOP_BUILD: "true",
  VITE_USE_SELF_HOSTED: "false",
};
const builderArgs = process.argv.slice(2);
if (builderArgs.length === 0) {
  fail("Pass an electron-builder target, for example --win --x64 or --linux --x64.");
}

run("Building the Vite renderer", ["vite", "build"], env);
run("Packaging the Electron application", ["electron-builder", ...builderArgs], env);
console.log("[desktop-build] Completed successfully.");
