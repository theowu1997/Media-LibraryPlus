import { _electron as electron, expect, test } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";

async function createProfile() {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "mla-plus-e2e-"));
  const mediaDir = path.join(userDataDir, "media");
  const normalRoot = path.join(mediaDir, "normal");
  const gentleRoot = path.join(mediaDir, "gentle");
  await fs.mkdir(normalRoot, { recursive: true });
  await fs.mkdir(gentleRoot, { recursive: true });

  const subtitleFixture = await fs.readFile(path.join(process.cwd(), "tests", "sample.srt"), "utf8");

  const dbPath = path.join(userDataDir, "mla-plus.db");
  const database = new DatabaseSync(dbPath);

  try {
    const alphaPath = path.join(normalRoot, "Alpha Feature.mp4");
    const zetaPath = path.join(normalRoot, "Zeta Feature.mp4");
    const gentlePath = path.join(gentleRoot, "Gentle Feature.mp4");
    const zetaSubtitlePath = path.join(normalRoot, "Zeta Feature.srt");

    await fs.writeFile(alphaPath, "alpha");
    await fs.writeFile(zetaPath, "zeta");
    await fs.writeFile(gentlePath, "gentle");
    await fs.writeFile(zetaSubtitlePath, subtitleFixture);

    database.exec(`
      CREATE TABLE IF NOT EXISTS movies (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        year INTEGER,
        video_id TEXT,
        source_path TEXT NOT NULL UNIQUE,
        folder_path TEXT NOT NULL,
        library_mode TEXT NOT NULL,
        resolution TEXT NOT NULL DEFAULT 'Unknown',
        poster_url TEXT,
        poster_source TEXT NOT NULL DEFAULT 'none',
        actresses_json TEXT NOT NULL DEFAULT '[]',
        keywords_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS subtitles (
        id TEXT PRIMARY KEY,
        movie_id TEXT NOT NULL,
        language TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const now = new Date().toISOString();
    const insertSetting = database.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
    );
    insertSetting.run("library_roots", JSON.stringify({ normal: [normalRoot], gentle: [gentleRoot] }));
    insertSetting.run("gentle_shortcut", "Ctrl+Alt+D");
    insertSetting.run("gentle_pin_hash", "not-used-in-this-test");
    insertSetting.run("theme_mode", "dark");
    insertSetting.run(
      "metadata_settings",
      JSON.stringify({
        tmdbReadAccessToken: "",
        language: "en-US",
        region: "US",
        autoFetchWebPosters: true,
        tmdbNonCommercialUse: false,
        sourceProfile: "auto"
      })
    );
    insertSetting.run(
      "organization_settings",
      JSON.stringify({
        normalPathTemplate: "{title} ({year})",
        gentlePathTemplate: "{studio}/{actress}/{dvdId}",
        fileNameTemplate: "{dvdId}",
        normalLibraryPath: "",
        gentleLibraryPath: ""
      })
    );

    const insertMovie = database.prepare(`
      INSERT INTO movies (
        id, title, year, video_id, source_path, folder_path, library_mode,
        resolution, poster_url, poster_source, actresses_json, keywords_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertMovie.run(
      "alpha-id",
      "Alpha Feature",
      2022,
      "AAA-001",
      alphaPath,
      normalRoot,
      "normal",
      "1080p",
      null,
      "none",
      JSON.stringify(["Alpha Actress"]),
      JSON.stringify(["AAA"]),
      now
    );
    insertMovie.run(
      "zeta-id",
      "Zeta Feature",
      2024,
      "ZZZ-001",
      zetaPath,
      normalRoot,
      "normal",
      "4K",
      null,
      "none",
      JSON.stringify(["Zeta Actress"]),
      JSON.stringify(["ZZZ"]),
      now
    );
    insertMovie.run(
      "gentle-id",
      "Gentle Feature",
      2023,
      "GENTLE-001",
      gentlePath,
      gentleRoot,
      "gentle",
      "720p",
      null,
      "none",
      JSON.stringify(["Gentle Actress"]),
      JSON.stringify(["Gentle"]),
      now
    );

    const insertSubtitle = database.prepare(
      "INSERT INTO subtitles (id, movie_id, language, path) VALUES (?, ?, ?, ?)"
    );
    insertSubtitle.run("zeta-subtitle", "zeta-id", "en", zetaSubtitlePath);

    return {
      userDataDir,
      database
    };
  } catch (error) {
    database.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
    throw error;
  }
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "pipe",
      windowsHide: true
    });
    const stderr: Buffer[] = [];

    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          Buffer.concat(stderr).toString("utf8").trim() ||
            `${command} exited with code ${code ?? "unknown"}`
        )
      );
    });
  });
}

async function createImportScanProfile() {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "mla-plus-e2e-import-"));
  const mediaDir = path.join(userDataDir, "media");
  const normalRoot = path.join(mediaDir, "normal");
  const gentleRoot = path.join(mediaDir, "gentle");
  await fs.mkdir(normalRoot, { recursive: true });
  await fs.mkdir(gentleRoot, { recursive: true });

  const sampleMovPath = path.join(normalRoot, "UI Import Sample.mov");
  const brokenFlvPath = path.join(normalRoot, "Broken Sample.flv");

  if (!ffmpegStatic) {
    throw new Error("ffmpeg-static path is unavailable for import test.");
  }

  await runCommand(ffmpegStatic, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=320x240:d=1",
    "-c:v",
    "mpeg4",
    sampleMovPath
  ]);
  await fs.writeFile(brokenFlvPath, "");

  const dbPath = path.join(userDataDir, "mla-plus.db");
  const database = new DatabaseSync(dbPath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const insertSetting = database.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
  );
  insertSetting.run("library_roots", JSON.stringify({ normal: [normalRoot], gentle: [gentleRoot] }));
  insertSetting.run("gentle_shortcut", "Ctrl+Alt+D");
  insertSetting.run("gentle_pin_hash", "not-used-in-this-test");
  insertSetting.run("theme_mode", "dark");
  insertSetting.run(
    "metadata_settings",
    JSON.stringify({
      tmdbReadAccessToken: "",
      language: "en-US",
      region: "US",
      autoFetchWebPosters: false,
      tmdbNonCommercialUse: false,
      sourceProfile: "local-only"
    })
  );
  insertSetting.run(
    "organization_settings",
    JSON.stringify({
      normalPathTemplate: "{title} ({year})",
      gentlePathTemplate: "{studio}/{actress}/{dvdId}",
      fileNameTemplate: "{dvdId}",
      normalLibraryPath: "",
      gentleLibraryPath: ""
    })
  );

  return {
    userDataDir,
    database
  };
}

test("Electron app smoke flow covers library, gentle toggle, player, and theme persistence", async () => {
  const profile = await createProfile();
  const launchEnv = {
    ...process.env,
    MLA_USER_DATA_DIR: profile.userDataDir
  };

    const app = await electron.launch({
      args: [process.cwd()],
      env: launchEnv
    });

    try {
      const page = await app.firstWindow();
      await expect(page).toHaveTitle("MLA+");
      const libraryButton = page.getByRole("button", { name: "Library", exact: true });
      await expect(libraryButton).toBeEnabled();
      await expect(page.getByText(/gentle off/i)).toBeVisible();

      await libraryButton.click();
      await expect(page.locator(".movie-tile").filter({ hasText: "Alpha Feature" }).first()).toBeVisible();
      await expect(page.locator(".movie-tile").filter({ hasText: "Zeta Feature" }).first()).toBeVisible();
      await expect(page.locator(".movie-tile").filter({ hasText: "Gentle Feature" })).toHaveCount(0);

      await page.locator(".movie-tile").filter({ hasText: "Zeta Feature" }).first().click({ button: "right" });
      await page.getByRole("button", { name: "Open in built-in player" }).click();
      await expect(page.getByText("Zeta Feature", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Subtitles" }).click();
      await expect(page.getByPlaceholder("Search by DVDID or title")).toHaveValue("ZZZ-001 Zeta Feature");

      await page.getByRole("button", { name: "Settings", exact: true }).click();
      const themeToggle = page.getByLabel("Use light theme");
      await themeToggle.check();
      await page.getByRole("button", { name: "Save theme" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    } finally {
      await app.close();
    }

  const relaunched = await electron.launch({
    args: [process.cwd()],
    env: launchEnv
  });

  try {
    const page = await relaunched.firstWindow();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await expect(page.locator(".movie-tile").filter({ hasText: "Gentle Feature" })).toHaveCount(0);
    await expect(page.getByText(/gentle off/i)).toBeVisible();
  } finally {
    await relaunched.close();
    profile.database.close();
    await fs.rm(profile.userDataDir, { recursive: true, force: true });
  }
});

test("Electron app scans supported videos and reports blocked files", async () => {
  const profile = await createImportScanProfile();
  const launchEnv = {
    ...process.env,
    MLA_USER_DATA_DIR: profile.userDataDir
  };

  const app = await electron.launch({
    args: [process.cwd()],
    env: launchEnv
  });

  try {
    const page = await app.firstWindow();
    await expect(page).toHaveTitle("MLA+");

    await page.getByRole("button", { name: "Scan library" }).click();
    await page.getByRole("button", { name: "Rescan saved folders" }).click();

    await page.waitForFunction(() => {
      const text = document.body.innerText || "";
      return text.includes("Scan complete.");
    }, null, { timeout: 45000 });

    await page.getByRole("button", { name: "Library", exact: true }).click();
    await expect(
      page.locator(".movie-tile").filter({ hasText: "UI Import Sample" }).first()
    ).toBeVisible();

    const skippedPanel = page.locator(".scan-report-panel");
    await expect(skippedPanel).toBeVisible();
    await expect(skippedPanel).toContainText("Broken Sample.flv");
    await expect(skippedPanel).toContainText("File is empty.");
  } finally {
    await app.close();
    profile.database.close();
    await fs.rm(profile.userDataDir, { recursive: true, force: true });
  }
});
