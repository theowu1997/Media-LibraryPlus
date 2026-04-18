feat(subgen): add metadata-enhanced transcription prompt and prompt forwarding

- Add optional `prompt` field to `SubtitleGenerationOptions`
- Add Sub-Gen UI: prompt textarea with Enhance button that injects
  movie context (title, actresses, keywords, video ID) into the prompt
- Forward prompt from renderer through main process to Python generator
- Wire prompt to Whisper `initial_prompt` in `generate_subtitles.py`
- Add renderer tests for Enhance behavior and prompt forwarding (single + batch)
- Update existing component tests for new scan telemetry props
- Document Sub-Gen prompt enhancement in README
- Fix duplicate `--prompt` argument push in `main.ts` `runSubtitleGeneration`
