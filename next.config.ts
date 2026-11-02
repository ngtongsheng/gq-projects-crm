import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.md is the single agent rules file; a generated AGENTS.md would compete with it.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
