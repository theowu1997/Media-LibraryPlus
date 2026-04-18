import argparse
import json
import os
import sys

from faster_whisper import WhisperModel


def write_srt(segments, output_path: str) -> None:
    with open(output_path, "w", encoding="utf-8") as handle:
        for index, segment in enumerate(segments, start=1):
            start = format_timestamp(segment.start)
            end = format_timestamp(segment.end)
            text = (segment.text or "").strip()
            handle.write(f"{index}\n{start} --> {end}\n{text}\n\n")


def format_timestamp(seconds: float) -> str:
    total_millis = max(0, int(seconds * 1000))
    hours = total_millis // 3_600_000
    minutes = (total_millis % 3_600_000) // 60_000
    secs = (total_millis % 60_000) // 1000
    millis = total_millis % 1000
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"


def normalize_whisper_language(language: str | None) -> str | None:
    if not language:
        return None

    value = language.strip().lower()
    aliases = {
        "jp": "ja",
        "jpn": "ja",
        "zho": "zh",
        "cmn": "zh",
        "chs": "zh",
        "cht": "zh",
        "eng": "en",
    }
    return aliases.get(value, value)


def map_nllb_language(language: str | None) -> str:
    normalized = normalize_whisper_language(language) or "eng_Latn"
    mapping = {
        "ar": "arb_Arab",
        "de": "deu_Latn",
        "en": "eng_Latn",
        "es": "spa_Latn",
        "fr": "fra_Latn",
        "id": "ind_Latn",
        "it": "ita_Latn",
        "ja": "jpn_Jpan",
        "km": "khm_Khmr",
        "ko": "kor_Hang",
        "pt": "por_Latn",
        "ru": "rus_Cyrl",
        "th": "tha_Thai",
        "vi": "vie_Latn",
        "zh": "zho_Hans",
    }
    return mapping.get(normalized, "eng_Latn")


def translate_segments(segment_list, source_language: str | None, target_language: str):
    try:
        from transformers import pipeline
    except ImportError as exc:
        raise RuntimeError(
            "Translation mode requires transformers and sentencepiece from resources/subgen/requirements.txt."
        ) from exc

    src_lang = map_nllb_language(source_language)
    target_map = {
        "en": "eng_Latn",
        "zh": "zho_Hans",
        "km": "khm_Khmr",
    }
    tgt_lang = target_map[target_language]
    translator = pipeline(
        "translation",
        model="facebook/nllb-200-distilled-600M",
        src_lang=src_lang,
        tgt_lang=tgt_lang,
    )

    texts = [(segment.text or "").strip() for segment in segment_list]
    if not any(texts):
        return

    results = translator(texts, batch_size=8, max_length=512)
    for segment, result in zip(segment_list, results):
        translated = (result.get("translation_text") or "").strip()
        if translated:
          segment.text = translated


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="medium")
    parser.add_argument("--language", default=None)
    parser.add_argument("--translate-to", choices=["en", "zh", "km"], default=None)
    args = parser.parse_args()

    device = "cpu"
    compute_type = "int8"
    model = WhisperModel(args.model, device=device, compute_type=compute_type)
    segments, info = model.transcribe(
        args.input,
        language=args.language,
        task="transcribe",
        vad_filter=True,
        beam_size=5,
    )
    segment_list = list(segments)
    detected_language = normalize_whisper_language(getattr(info, "language", None))
    output_language = detected_language
    if args.translate_to:
        translate_segments(segment_list, detected_language, args.translate_to)
        output_language = args.translate_to
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    write_srt(segment_list, args.output)
    print(json.dumps({
        "output": args.output,
        "detected_language": detected_language,
        "output_language": output_language,
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
