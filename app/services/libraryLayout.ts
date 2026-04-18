import fs from "node:fs/promises";
import path from "node:path";
import type { LibraryMode, OrganizationSettings } from "../shared/contracts";
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  renderOrganizationFileTemplate,
  renderOrganizationPathTemplate,
  resolveOrganizationTemplateValues
} from "../shared/organizationTemplates";

interface LibraryLayoutParams {
  libraryMode: LibraryMode;
  title: string;
  year: number | null;
  videoId: string | null;
  actresses: string[];
  modelName?: string | null;
  resolveLongPath: boolean;
  organizationSettings?: OrganizationSettings;
}

interface NfoParams {
  directory: string;
  libraryMode: LibraryMode;
  title: string;
  year: number | null;
  videoId: string | null;
  actresses: string[];
  modelName?: string | null;
  sourcePath: string;
  organizationSettings?: OrganizationSettings;
}

export function buildMovieBaseName(params: LibraryLayoutParams): string {
  const settings = params.organizationSettings ?? DEFAULT_ORGANIZATION_SETTINGS;
  const values = resolveOrganizationTemplateValues({
    title: params.title,
    year: params.year,
    videoId: params.videoId,
    actresses: params.actresses,
    studio: params.modelName
  });
  const fallback = params.videoId || params.title || "Untitled";

  return renderOrganizationFileTemplate(
    settings.fileNameTemplate,
    values,
    fallback,
    params.resolveLongPath ? 48 : 120
  );
}

export function buildLibraryTargetDirectory(
  root: string,
  params: LibraryLayoutParams
): string {
  const settings = params.organizationSettings ?? DEFAULT_ORGANIZATION_SETTINGS;
  const values = resolveOrganizationTemplateValues({
    title: params.title,
    year: params.year,
    videoId: params.videoId,
    actresses: params.actresses,
    studio: params.modelName
  });
  const defaultMovieName =
    params.videoId || values.title || values.studio || "Untitled";
  const template =
    params.libraryMode === "gentle"
      ? settings.gentlePathTemplate
      : settings.normalPathTemplate;
  const segments = renderOrganizationPathTemplate(
    template,
    values,
    [defaultMovieName],
    params.resolveLongPath ? 40 : 80
  );

  // If we have actress data, prefer `Actress/Title` organization by
  // prefixing the rendered path with the first actress name. This keeps
  // organization intuitive: libraryRoot/Actress/MovieFolder
  const firstActress = params.actresses && params.actresses.length > 0 ? params.actresses[0] : null;
  if (firstActress) {
    const sanitized = firstActress.replace(/[\\/:*?"<>|]/g, "-").trim();
    const actressSegment = sanitized || "Unknown Actress";
    return path.join(root, actressSegment, ...segments);
  }

  return path.join(root, ...segments);
}

export function buildTargetVideoPath(
  directory: string,
  params: LibraryLayoutParams,
  extension: string
): string {
  const stem = buildMovieBaseName(params);
  let candidate = path.join(directory, `${stem}${extension.toLowerCase()}`);

  if (params.resolveLongPath && candidate.length > 220) {
    const budget = Math.max(20, 220 - directory.length - extension.length - 2);
    const shortenedStem = stem.slice(0, budget).trim() || "Untitled";
    candidate = path.join(directory, `${shortenedStem}${extension.toLowerCase()}`);
  }

  return candidate;
}

export function buildTargetNfoPath(
  directory: string,
  params: LibraryLayoutParams
): string {
  const stem = buildMovieBaseName(params);
  return path.join(directory, `${stem}.nfo`);
}

export function buildTargetSubtitlePath(params: {
  directory: string;
  title: string;
  year: number | null;
  videoId: string | null;
  actresses: string[];
  modelName?: string | null;
  language: string;
  extension: string;
  subtitleCount: number;
  resolveLongPath: boolean;
  organizationSettings?: OrganizationSettings;
}): string {
  const stem = buildMovieBaseName({
    libraryMode: "normal",
    title: params.title,
    year: params.year,
    videoId: params.videoId,
    actresses: params.actresses,
    modelName: params.modelName,
    resolveLongPath: params.resolveLongPath,
    organizationSettings: params.organizationSettings
  });
  const needsLanguageSuffix =
    params.subtitleCount > 1 && params.language !== "UND";
  const languageSuffix = needsLanguageSuffix
    ? `.${params.language.toLowerCase()}`
    : "";

  return path.join(
    params.directory,
    `${stem}${languageSuffix}${params.extension.toLowerCase()}`
  );
}

export async function ensureLibraryTargetDirectory(
  root: string,
  params: LibraryLayoutParams
): Promise<string> {
  const directory = buildLibraryTargetDirectory(root, params);
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

export async function writeMovieNfo(params: NfoParams): Promise<string> {
  const nfoPath = buildTargetNfoPath(params.directory, {
    libraryMode: params.libraryMode,
    title: params.title,
    year: params.year,
    videoId: params.videoId,
    actresses: params.actresses,
    modelName: params.modelName,
    resolveLongPath: true,
    organizationSettings: params.organizationSettings
  });
  const xml = buildMovieNfoXml(params);
  await fs.writeFile(nfoPath, xml, "utf8");
  return nfoPath;
}

function buildMovieNfoXml(params: NfoParams): string {
  const baseName = buildMovieBaseName({
    libraryMode: params.libraryMode,
    title: params.title,
    year: params.year,
    videoId: params.videoId,
    actresses: params.actresses,
    modelName: params.modelName,
    resolveLongPath: true,
    organizationSettings: params.organizationSettings
  });
  const actorsXml = params.actresses
    .map(
      (actress) =>
        `  <actor>\n    <name>${escapeXml(actress)}</name>\n  </actor>`
    )
    .join("\n");
  const modelName =
    params.modelName || params.videoId?.split("-")[0] || "Unknown Studio";

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    "<movie>",
    `  <title>${escapeXml(baseName)}</title>`,
    `  <originaltitle>${escapeXml(baseName)}</originaltitle>`,
    `  <sorttitle>${escapeXml(baseName)}</sorttitle>`,
    params.videoId ? `  <id>${escapeXml(params.videoId)}</id>` : "",
    `  <studio>${escapeXml(modelName)}</studio>`,
    `  <tag>${escapeXml(params.libraryMode)}</tag>`,
    `  <source>${escapeXml(params.sourcePath)}</source>`,
    actorsXml,
    "</movie>",
    ""
  ]
    .filter(Boolean)
    .join("\n");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
