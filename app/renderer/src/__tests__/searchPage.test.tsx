import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchPage } from "../components/SearchPage";
import type { MovieRecord } from "../../../shared/contracts";

function makeMovie(overrides: Partial<MovieRecord> = {}): MovieRecord {
  return {
    id: "movie-1",
    title: "Skyline Session",
    videoId: "SSN-101",
    year: 2024,
    resolution: "1080p",
    posterUrl: null,
    posterSource: "none",
    sourcePath: "C:/library/normal/skyline-session.mp4",
    folderPath: "C:/library/normal",
    libraryMode: "normal",
    actresses: ["Ari Lane", "Mila Hart"],
    keywords: ["interview", "ambient"],
    subtitles: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("SearchPage prompt enhancement", () => {
  it("enhances an empty prompt with selected movie context", () => {
    const movie = makeMovie();

    (window as unknown as { desktopApi: unknown }).desktopApi = {
      generateSubtitleForMovie: vi.fn(),
    };

    render(
      <SearchPage
        movies={[movie]}
        setSelectedMovieId={() => {}}
        setActivePage={() => {}}
        onSubtitleGenerated={async () => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    const input = screen.getByLabelText("Transcription prompt") as HTMLTextAreaElement;
    expect(input.value).toContain("Transcribe this video. Context:");
    expect(input.value).toContain("Skyline Session");
    expect(input.value).toContain("Actresses: Ari Lane, Mila Hart");
    expect(input.value).toContain("Keywords: interview, ambient");
    expect(input.value).toContain("ID: SSN-101");
  });

  it("forwards prompt for single and batch generation", async () => {
    const generateSubtitleForMovie = vi.fn().mockResolvedValue({
      ok: true,
      message: "ok",
      subtitlePath: "C:/library/normal/output.srt",
      detectedLanguage: "en",
      outputLanguage: "en",
      setupRequired: false,
    });

    const onSubtitleGenerated = vi.fn().mockResolvedValue(undefined);

    (window as unknown as { desktopApi: unknown }).desktopApi = {
      generateSubtitleForMovie,
    };

    const movies = [makeMovie(), makeMovie({ id: "movie-2", title: "Moonline Echo" })];

    render(
      <SearchPage
        movies={movies}
        setSelectedMovieId={() => {}}
        setActivePage={() => {}}
        onSubtitleGenerated={onSubtitleGenerated}
      />
    );

    const promptInput = screen.getByLabelText("Transcription prompt");
    fireEvent.change(promptInput, { target: { value: "Focus on dialogue" } });

    fireEvent.click(screen.getByRole("button", { name: "Generate subtitle" }));

    await waitFor(() => {
      expect(generateSubtitleForMovie).toHaveBeenCalledWith(
        "movie-1",
        expect.objectContaining({ prompt: "Focus on dialogue" })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Batch generate visible/ }));

    await waitFor(() => {
      expect(generateSubtitleForMovie).toHaveBeenCalledWith(
        "movie-1",
        expect.objectContaining({ prompt: "Focus on dialogue" })
      );
      expect(generateSubtitleForMovie).toHaveBeenCalledWith(
        "movie-2",
        expect.objectContaining({ prompt: "Focus on dialogue" })
      );
    });
  });
});
