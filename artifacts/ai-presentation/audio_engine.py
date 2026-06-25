"""
audio_engine.py — Speechace STT + Pronunciation Diagnosis + Qwen CosyVoice TTS
Encapsulates all audio AI calls so app.py stays clean.
"""
import os
import json
import traceback
import urllib.request
import urllib.parse
import urllib.error

SPEECHACE_API_KEY = os.environ.get("SPEECHACE_API_KEY", "")
SPEECHACE_REGION  = os.environ.get("SPEECHACE_REGION", "singapore")
QWEN_API_KEY      = os.environ.get("QWEN_API_KEY", "")

_SPEECHACE_BASE = {
    "singapore": "https://api.speechace.co",
    "us":        "https://api.speechace.com",
}


def _speechace_url(path: str) -> str:
    base = _SPEECHACE_BASE.get((SPEECHACE_REGION or "singapore").lower(),
                                _SPEECHACE_BASE["singapore"])
    encoded_key = urllib.parse.quote(SPEECHACE_API_KEY, safe="")
    return f"{base}{path}?key={encoded_key}"


def _build_multipart(fields: dict, files: dict) -> tuple:
    """
    Minimal multipart/form-data builder (zero extra dependencies).
    fields: {name: str_value}
    files:  {name: (filename, bytes, content_type)}
    Returns (body_bytes, content_type_header_value)
    """
    boundary = "SpeechaceAudioBoundary20260624"
    parts = []
    for name, value in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n'
            f'{value}\r\n'.encode()
        )
    for name, (filename, data, ctype) in files.items():
        header = (
            f'--{boundary}\r\n'
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
            f'Content-Type: {ctype}\r\n\r\n'
        ).encode()
        parts.append(header + data + b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    return b''.join(parts), f'multipart/form-data; boundary={boundary}'


def recognize_and_diagnose(audio_bytes: bytes,
                            reference_text: str = "",
                            filename: str = "audio.webm") -> dict:
    """
    Submit audio to Speechace (Singapore node) for pronunciation scoring.

    reference_text: the Web-Speech-API live transcript — used as the target
                    sentence so Speechace can score phoneme-level accuracy.
    Returns a pronunciation_diagnostic dict compatible with the report schema:
    {
        "transcript":    str,
        "overall_score": int  (0-100),
        "summary_text":  str  (Chinese summary),
        "error_list":    [ {word, correct_phonetic, user_phonetic,
                            error_type, score, tts_demo_url} ]
    }
    """
    if not SPEECHACE_API_KEY:
        return _empty_diagnostic("SPEECHACE_API_KEY 未配置")
    if not audio_bytes or len(audio_bytes) < 500:
        return _empty_diagnostic("音频过短，跳过诊断")

    ref = reference_text.strip()
    if ref:
        question_info = json.dumps({
            "version": "v0.1",
            "dialect": "en-us",
            "item_group": [{
                "items": [{"text": ref, "type": "sentence"}],
                "type": "sentence"
            }]
        })
    else:
        question_info = json.dumps({
            "version": "v0.1",
            "dialect": "en-us",
            "item_group": [{"items": [], "type": "free_speech",
                            "config": {"num_words": 200}}]
        })

    body, ct = _build_multipart(
        fields={"question_info": question_info},
        files={"user_audio_file": (filename, audio_bytes, "audio/webm")},
    )
    url = _speechace_url("/api/v9/scoring/text/scoring/json")
    try:
        req = urllib.request.Request(url, data=body,
                                     headers={"Content-Type": ct}, method="POST")
        with urllib.request.urlopen(req, timeout=28) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode("utf-8", errors="replace")
        return _empty_diagnostic(f"Speechace HTTP {e.code}: {body_txt[:200]}")
    except Exception as exc:
        traceback.print_exc()
        return _empty_diagnostic(f"Speechace 请求失败: {exc}")

    return _parse_speechace_response(raw, ref)


def _parse_speechace_response(raw: dict, reference_text: str) -> dict:
    status = raw.get("status")
    if status not in ("success", "ok", 1, "1", True):
        msg = raw.get("error_msg") or raw.get("message") or str(raw)[:200]
        return _empty_diagnostic(f"Speechace 返回错误: {msg}")

    score_data = (
        raw.get("speechace_score")
        or raw.get("score")
        or raw.get("text_score")
        or {}
    )
    word_list = (
        score_data.get("word_score_list")
        or score_data.get("words")
        or []
    )
    transcript = (
        score_data.get("text") or score_data.get("transcript") or reference_text or ""
    )
    overall = score_data.get("quality_score") or score_data.get("score") or 0
    try:
        overall = float(overall)
    except (TypeError, ValueError):
        overall = 0.0

    mispronounced = []
    for w in word_list:
        word = (w.get("word") or w.get("text") or "").strip()
        q_sc = w.get("quality_score") or w.get("score") or 100
        try:
            q_sc = float(q_sc)
        except (TypeError, ValueError):
            q_sc = 100.0

        if q_sc < 70 and word:
            phones = w.get("phone_score_list") or []
            mispronounced.append({
                "word":             word,
                "correct_phonetic": w.get("ipa") or w.get("phonetic") or f"/{word}/",
                "user_phonetic":    _phones_to_ipa(phones) or f"/{word}/",
                "error_type":       _classify_error(phones, q_sc),
                "score":            round(q_sc),
                "tts_demo_url":     "",
            })

    n = len(mispronounced)
    if n == 0:
        summary = "发音表现优秀，本段未检测到明显发音错误。"
    elif n <= 2:
        summary = f"总体发音良好，但有 {n} 个词汇的发音需要注意。"
    else:
        summary = f"本段共检测到 {n} 个发音问题，请重点练习下列单词。"

    return {
        "transcript":    transcript,
        "overall_score": round(overall),
        "summary_text":  summary,
        "error_list":    mispronounced[:8],
    }


def _phones_to_ipa(phones: list) -> str:
    if not phones:
        return ""
    segs = [p.get("phone") or p.get("phoneme") or "" for p in phones]
    return "/" + "".join(segs) + "/"


def _classify_error(phones: list, score: float) -> str:
    if score < 40:
        return "严重发音错误"
    low = [p for p in phones if (p.get("quality_score") or 100) < 60]
    if len(low) >= 2:
        return "多个音素偏差"
    for p in phones:
        if "stress" in (p.get("error_type") or "").lower():
            return "重音位置错误"
    return "发音不准确"


def _empty_diagnostic(reason: str = "") -> dict:
    return {
        "transcript":    "",
        "overall_score": 0,
        "summary_text":  reason or "发音诊断不可用",
        "error_list":    [],
    }


def generate_pronunciation_demo(word: str, voice: str = "Stella") -> bytes | None:
    """
    Generate MP3 pronunciation demo via Qwen CosyVoice-v3-flash (DashScope).
    voice: 'Stella' (English female, clear RP accent) | 'Davis' (American male)
    Returns raw MP3 bytes, or None on failure.
    """
    if not QWEN_API_KEY or not word:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=QWEN_API_KEY,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
        demo_text = f"The correct pronunciation is: {word}. {word}."
        resp = client.audio.speech.create(
            model="cosyvoice-v3-flash",
            input=demo_text,
            voice=voice,
            response_format="mp3",
        )
        return resp.content
    except Exception as exc:
        traceback.print_exc()
        return None
