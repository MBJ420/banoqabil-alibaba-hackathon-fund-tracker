"""
llm_service.py
──────────────
Unified AI client service integrating Alibaba Cloud Model Studio (Qwen 2.5)
with seamless fallback to Google Gemini.

Supports:
- Alibaba Cloud Model Studio (DashScope OpenAI-compatible API): qwen-max, qwen-plus, qwen-turbo
- Google Gemini API (gemini-2.5-flash / gemini-flash-latest) as fallback
- Clean JSON and structured outputs with Markdown fence stripping
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Alibaba Cloud Model Studio (DashScope) Configuration
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY") or os.environ.get("ALIBABA_CLOUD_API_KEY", "")
DASHSCOPE_BASE_URL = os.environ.get("DASHSCOPE_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").rstrip('/')
QWEN_MODEL = os.environ.get("QWEN_MODEL_NAME", "qwen-plus")

# Google Gemini Fallback Configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")


def clean_json_markdown(text: str) -> str:
    """Strip markdown code fences from LLM responses."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def get_active_ai_provider() -> Dict[str, Any]:
    """Returns metadata about the active AI model and provider."""
    if DASHSCOPE_API_KEY:
        return {
            "provider": "Alibaba Cloud Model Studio",
            "model": QWEN_MODEL,
            "is_alibaba_cloud": True,
            "engine": "Qwen 2.5 (DashScope)",
            "status": "ready"
        }
    elif GEMINI_API_KEY:
        return {
            "provider": "Google Gemini",
            "model": "gemini-2.5-flash",
            "is_alibaba_cloud": False,
            "engine": "Gemini Flash (Fallback)",
            "status": "ready"
        }
    else:
        return {
            "provider": "None",
            "model": "None",
            "is_alibaba_cloud": False,
            "engine": "Unconfigured",
            "status": "missing_keys"
        }


def _call_qwen_chat(
    messages: List[Dict[str, str]],
    temperature: float = 0.2,
    response_format: Optional[str] = None
) -> str:
    """Execute a chat completion request against Alibaba Cloud Model Studio."""
    url = f"{DASHSCOPE_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json"
    }
    payload: Dict[str, Any] = {
        "model": QWEN_MODEL,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format == "json_object":
        payload["response_format"] = {"type": "json_object"}

    with httpx.Client(timeout=45.0) as client:
        resp = client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


def _call_gemini_chat(
    prompt: str,
    system_prompt: str = "",
    temperature: float = 0.2
) -> str:
    """Execute a fallback generation request against Google Gemini."""
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(
        full_prompt,
        generation_config=genai.types.GenerationConfig(temperature=temperature)
    )
    return response.text


def generate_text(prompt: str, system_prompt: str = "", temperature: float = 0.2) -> str:
    """Generate freeform text using Alibaba Cloud Qwen 2.5 with Gemini fallback."""
    if DASHSCOPE_API_KEY:
        try:
            logger.info(f"Calling Alibaba Cloud Model Studio ({QWEN_MODEL})...")
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            return _call_qwen_chat(messages, temperature=temperature)
        except Exception as e:
            logger.warning(f"Alibaba Cloud Qwen call failed ({e}), falling back to Gemini...")
    
    if GEMINI_API_KEY:
        try:
            logger.info("Calling Google Gemini fallback...")
            return _call_gemini_chat(prompt, system_prompt=system_prompt, temperature=temperature)
        except Exception as e:
            logger.error(f"Gemini fallback also failed: {e}")
            raise e

    raise ValueError("Neither DASHSCOPE_API_KEY nor GEMINI_API_KEY is configured.")


def generate_json(prompt: str, system_prompt: str = "", temperature: float = 0.2) -> Dict[str, Any]:
    """Generate a structured JSON dictionary using Alibaba Cloud Qwen 2.5 with Gemini fallback."""
    json_system_prompt = (
        (system_prompt + "\n" if system_prompt else "") +
        "You MUST respond ONLY with a valid JSON object. Do not include any explanations, greetings, or markdown code fences."
    )
    
    raw_text = ""
    if DASHSCOPE_API_KEY:
        try:
            logger.info(f"Generating JSON via Alibaba Cloud Model Studio ({QWEN_MODEL})...")
            messages = [
                {"role": "system", "content": json_system_prompt},
                {"role": "user", "content": prompt}
            ]
            raw_text = _call_qwen_chat(messages, temperature=temperature, response_format="json_object")
            cleaned = clean_json_markdown(raw_text)
            return json.loads(cleaned)
        except Exception as e:
            logger.warning(f"Alibaba Cloud Qwen JSON generation failed ({e}), falling back to Gemini...")

    if GEMINI_API_KEY:
        try:
            logger.info("Generating JSON via Google Gemini fallback...")
            raw_text = _call_gemini_chat(prompt, system_prompt=json_system_prompt, temperature=temperature)
            cleaned = clean_json_markdown(raw_text)
            return json.loads(cleaned)
        except Exception as e:
            logger.error(f"Gemini fallback JSON generation failed: {e}")
            raise e

    raise ValueError("Neither DASHSCOPE_API_KEY nor GEMINI_API_KEY is configured.")
