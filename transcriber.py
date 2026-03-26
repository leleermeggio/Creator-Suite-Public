"""Servizio di trascrizione audio con OpenAI Whisper."""

from __future__ import annotations

import logging

import torch
import whisper

logger = logging.getLogger("bot.transcriber")


class WhisperTranscriber:
    """Wrapper per il modello Whisper — caricato una sola volta."""

    def __init__(self, model_name: str = "small", language: str = "it"):
        logger.info("📥 Download/caricamento modello Whisper '%s'...", model_name)
        self._use_fp16 = torch.cuda.is_available()
        device = "cuda" if self._use_fp16 else "cpu"
        self.model = whisper.load_model(model_name, device=device)
        self.language = language
        logger.info("✅ Modello Whisper '%s' pronto (device=%s, fp16=%s)", model_name, device, self._use_fp16)

    def transcribe(self, audio_path: str) -> str:
        """Trascrive un file audio. Ritorna il testo o stringa vuota."""
        try:
            logger.info("⚙️  Whisper — trascrizione di: %s (lingua: %s)", audio_path, self.language)
            result = self.model.transcribe(
                audio_path,
                language=self.language,
                fp16=self._use_fp16,
            )
            text = result["text"].strip()
            logger.info("✅ Trascrizione completata — %d caratteri", len(text))
            return text
        except Exception as e:
            logger.exception("❌ Errore trascrizione Whisper: %s", e)
            return ""
