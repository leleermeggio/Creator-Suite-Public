"""Servizio di jump cut automatico — rimozione silenzi con ffmpeg."""

from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger("bot.jumpcut")

# ---------------------------------------------------------------------------
# Configurazione (valori di default, sovrascrivibili da env)
# ---------------------------------------------------------------------------
JUMPCUT_SILENCE_THRESH = float(os.getenv("JUMPCUT_SILENCE_THRESH", "-35"))   # dB
JUMPCUT_MIN_SILENCE    = float(os.getenv("JUMPCUT_MIN_SILENCE", "0.4"))      # secondi
JUMPCUT_PADDING        = float(os.getenv("JUMPCUT_PADDING", "0.1"))          # secondi

_RE_SILENCE_START = re.compile(r"silence_start:\s*([\d.]+)")
_RE_SILENCE_END   = re.compile(r"silence_end:\s*([\d.]+)")
_RE_DURATION      = re.compile(r"Duration:\s*(\d+):(\d+):([\d.]+)")


# ---------------------------------------------------------------------------
# Controllo ffmpeg
# ---------------------------------------------------------------------------
def check_ffmpeg() -> bool:
    """Verifica che ffmpeg sia installato e raggiungibile."""
    try:
        subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True, timeout=10,
        )
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


# ---------------------------------------------------------------------------
# Durata video
# ---------------------------------------------------------------------------
def _get_duration(path: str) -> float:
    """Ottieni la durata in secondi di un file multimediale."""
    result = subprocess.run(
        ["ffmpeg", "-i", path],
        capture_output=True, text=True, timeout=30,
    )
    # ffmpeg scrive info su stderr
    match = _RE_DURATION.search(result.stderr)
    if match:
        h, m, s = int(match.group(1)), int(match.group(2)), float(match.group(3))
        return h * 3600 + m * 60 + s
    return 0.0


# ---------------------------------------------------------------------------
# Rileva silenzi
# ---------------------------------------------------------------------------
def _detect_silences(
    input_path: str,
    noise_db: float = JUMPCUT_SILENCE_THRESH,
    min_dur: float = JUMPCUT_MIN_SILENCE,
) -> list[tuple[float, float]]:
    """Rileva i segmenti silenziosi con ffmpeg silencedetect.

    Returns: lista di (start, end) dei silenzi.
    """
    cmd = [
        "ffmpeg", "-i", input_path,
        "-af", f"silencedetect=noise={noise_db}dB:d={min_dur}",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    output = result.stderr

    starts = [float(m.group(1)) for m in _RE_SILENCE_START.finditer(output)]
    ends   = [float(m.group(1)) for m in _RE_SILENCE_END.finditer(output)]

    silences: list[tuple[float, float]] = []
    for i, start in enumerate(starts):
        end = ends[i] if i < len(ends) else _get_duration(input_path)
        silences.append((start, end))

    logger.info("🔇 Rilevati %d segmenti silenziosi", len(silences))
    return silences


# ---------------------------------------------------------------------------
# Calcola segmenti da mantenere
# ---------------------------------------------------------------------------
def _compute_keep_segments(
    silences: list[tuple[float, float]],
    total_duration: float,
    padding: float = JUMPCUT_PADDING,
) -> list[tuple[float, float]]:
    """Calcola i segmenti da mantenere (inverso dei silenzi, con padding).

    Returns: lista di (start, end) dei segmenti audio attivi.
    """
    if not silences:
        return [(0.0, total_duration)]

    segments: list[tuple[float, float]] = []

    # Prima del primo silenzio
    first_silence_start = silences[0][0]
    if first_silence_start > 0:
        seg_end = min(first_silence_start + padding, total_duration)
        segments.append((0.0, seg_end))

    # Tra silenzi consecutivi
    for i in range(len(silences) - 1):
        seg_start = max(silences[i][1] - padding, 0.0)
        seg_end   = min(silences[i + 1][0] + padding, total_duration)
        if seg_end > seg_start + 0.05:  # segmento minimo 50ms
            segments.append((seg_start, seg_end))

    # Dopo l'ultimo silenzio
    last_silence_end = silences[-1][1]
    if last_silence_end < total_duration:
        seg_start = max(last_silence_end - padding, 0.0)
        segments.append((seg_start, total_duration))

    logger.info("✂️  %d segmenti da mantenere", len(segments))
    return segments


# ---------------------------------------------------------------------------
# Estrai e concatena segmenti
# ---------------------------------------------------------------------------
def _extract_and_concat(
    input_path: str,
    segments: list[tuple[float, float]],
    output_path: str,
    tmp_dir: str,
) -> bool:
    """Estrai ogni segmento e concatenali con ffmpeg concat.

    Returns: True se la concatenazione ha successo.
    """
    segment_files: list[str] = []

    for i, (start, end) in enumerate(segments):
        seg_path = os.path.join(tmp_dir, f"seg_{i:04d}.mp4")
        duration = end - start
        cmd = [
            "ffmpeg", "-y",
            "-ss", f"{start:.3f}",
            "-i", input_path,
            "-t", f"{duration:.3f}",
            "-codec:v", "libx264", "-preset", "fast", "-crf", "23",
            "-codec:a", "aac", "-b:a", "192k",
            "-avoid_negative_ts", "make_zero",
            "-movflags", "+faststart",
            seg_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            logger.error("❌ Errore estrazione segmento %d: %s", i, result.stderr[-300:])
            return False
        segment_files.append(seg_path)

    if not segment_files:
        return False

    # File lista per concat
    list_path = os.path.join(tmp_dir, "concat_list.txt")
    with open(list_path, "w") as f:
        for seg in segment_files:
            f.write(f"file '{seg}'\n")

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", list_path,
        "-codec", "copy",
        "-movflags", "+faststart",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        logger.error("❌ Errore concatenazione: %s", result.stderr[-500:])
        return False

    return True


# ---------------------------------------------------------------------------
# API pubblica
# ---------------------------------------------------------------------------
class JumpCutResult:
    """Risultato del processo di jump cut."""
    __slots__ = ("output_path", "original_duration", "final_duration",
                 "removed_pct", "segments_count", "error")

    def __init__(
        self, output_path: str | None = None,
        original_duration: float = 0.0,
        final_duration: float = 0.0,
        segments_count: int = 0,
        error: str | None = None,
    ):
        self.output_path = output_path
        self.original_duration = original_duration
        self.final_duration = final_duration
        self.removed_pct = (
            ((original_duration - final_duration) / original_duration * 100)
            if original_duration > 0 else 0.0
        )
        self.segments_count = segments_count
        self.error = error


def process_jumpcut(
    input_path: str,
    output_dir: str,
    noise_db: float = JUMPCUT_SILENCE_THRESH,
    min_silence: float = JUMPCUT_MIN_SILENCE,
    padding: float = JUMPCUT_PADDING,
) -> JumpCutResult:
    """Processa un video rimuovendo i silenzi.

    Args:
        input_path: percorso al video originale.
        output_dir: cartella dove salvare il file finale.
        noise_db: soglia silenzio in dB (es. -35).
        min_silence: durata minima silenzio da tagliare in secondi.
        padding: padding da mantenere attorno alle parole in secondi.

    Returns: JumpCutResult con statistiche e path del file output.
    """
    tmp_dir = None
    try:
        # Durata originale
        original_duration = _get_duration(input_path)
        if original_duration <= 0:
            return JumpCutResult(error="Impossibile determinare la durata del video. File corrotto?")

        logger.info("🎬 Jump cut — durata originale: %.1fs", original_duration)

        # Controlla che il video abbia audio
        probe_cmd = [
            "ffmpeg", "-i", input_path,
            "-af", "volumedetect",
            "-f", "null", "-",
        ]
        probe = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=120)
        if "Stream" not in probe.stderr or "Audio" not in probe.stderr:
            return JumpCutResult(error="Il video non contiene una traccia audio. "
                                       "Il jump cut necessita dell'audio per rilevare i silenzi.")

        # 1. Rileva silenzi
        silences = _detect_silences(input_path, noise_db, min_silence)

        if not silences:
            return JumpCutResult(error="Nessun silenzio rilevato. Il video non necessita di jump cut, "
                                       "oppure prova ad alzare la soglia (es. -30 dB).")

        # 2. Calcola segmenti da mantenere
        segments = _compute_keep_segments(silences, original_duration, padding)

        if not segments:
            return JumpCutResult(error="Nessun segmento audio da mantenere — "
                                       "il video sembra essere tutto silenzio.")

        # 3. Estrai e concatena
        tmp_dir = tempfile.mkdtemp(prefix="jumpcut_")
        stem = Path(input_path).stem
        output_path = os.path.join(output_dir, f"{stem}_jumpcut.mp4")

        logger.info("✂️  Estrazione e concatenazione di %d segmenti…", len(segments))
        ok = _extract_and_concat(input_path, segments, output_path, tmp_dir)

        if not ok or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            return JumpCutResult(error="Errore durante la concatenazione dei segmenti video.")

        # Statistiche finali
        final_duration = _get_duration(output_path)
        size_mb = os.path.getsize(output_path) / (1024 * 1024)

        logger.info("✅ Jump cut completato — %.1fs → %.1fs (%.1f%% rimosso, %.1f MB)",
                     original_duration, final_duration,
                     (original_duration - final_duration) / original_duration * 100,
                     size_mb)

        return JumpCutResult(
            output_path=output_path,
            original_duration=original_duration,
            final_duration=final_duration,
            segments_count=len(segments),
        )

    except subprocess.TimeoutExpired:
        logger.error("❌ [JumpCut] Timeout durante l'elaborazione")
        return JumpCutResult(error="Timeout: il video è troppo lungo o complesso da elaborare.")
    except Exception as e:
        logger.exception("❌ [JumpCut] Errore imprevisto: %s", e)
        return JumpCutResult(error=f"Errore imprevisto: {e}")
    finally:
        if tmp_dir and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)
