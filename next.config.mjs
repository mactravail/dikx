/** @type {import('next').NextConfig} */
const nextConfig = {
  // Le moteur (src/) utilise des imports avec extension .js (style NodeNext,
  // requis par Vitest/tsx qui l'executent en ESM Node). Turbopack ne remappe
  // pas ces specifiers vers les .ts ; webpack le fait via `extensionAlias`.
  // On force donc webpack (scripts `next dev/build --webpack`).
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
