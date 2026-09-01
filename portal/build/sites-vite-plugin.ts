import type { Plugin } from "vite";

// Compatibility shim retained for local Vite development of the exported portal.
export function sites(): Plugin {
  return { name: "sites-local-compatibility" };
}
