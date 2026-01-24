import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function serveStatic(app: Express) {
  // In production (built), __dirname is 'dist/' and public is at 'dist/public/'
  // In development, __dirname is 'server/' and we need to go up to find 'dist/public/'
  const possiblePaths = [
    path.resolve(__dirname, "public"),           // Production: dist/public
    path.resolve(__dirname, "..", "dist/public"), // Development: ../dist/public
    path.resolve(process.cwd(), "dist/public"),  // Fallback: from project root
    path.resolve(process.cwd(), "public"),       // Alternative: project root/public
  ];

  let distPath: string | null = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      distPath = testPath;
      break;
    }
  }

  if (!distPath) {
    const searchedPaths = possiblePaths.join('\n  - ');
    throw new Error(
      `Could not find the build directory. Searched in:\n  - ${searchedPaths}\n\nMake sure to build the client first with: npm run build`,
    );
  }

  console.log(`[Static] Serving static files from: ${distPath}`);

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath!, "index.html"));
  });
}
