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
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx
from dotenv import load_dotenv, find_dotenv

# Try finding .env from current directory or backend directory
backend_dir = Path(__file__).resolve().parent.parent.parent
env_paths = [
    Path.cwd() / ".env",
    backend_dir / ".env",
    backend_dir.parent / ".env"
]
for p in env_paths:
    if p.exists():
        load_dotenv(p)
load_dotenv(find_dotenv())

logger = logging.getLogger(__name__)


def get_dashscope_config():
    api_key = os.environ.get("DASHSCOPE_API_KEY") or os.environ.get("ALIBABA_CLOUD_API_KEY", "")
    raw_url = (os.environ.get("DASHSCOPE_BASE_URL") or "").strip().rstrip('/')
    if not raw_url or "maas.aliyuncs.com" in raw_url:
        base_url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    else:
        base_url = raw_url
    model = os.environ.get("QWEN_MODEL_NAME", "qwen-plus")
    return api_key, base_url, model


def get_gemini_key():
    return os.environ.get("GEMINI_API_KEY", "")


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
    dashscope_key, _, qwen_model = get_dashscope_config()
    gemini_key = get_gemini_key()
    
    if dashscope_key:
        return {
            "provider": "Alibaba Cloud Model Studio",
            "model": qwen_model,
            "is_alibaba_cloud": True,
            "engine": "Qwen 2.5 (DashScope)",
            "status": "ready"
        }
    elif gemini_key:
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
    dashscope_key, base_url, qwen_model = get_dashscope_config()
    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {dashscope_key}",
        "Content-Type": "application/json"
    }
    payload: Dict[str, Any] = {
        "model": qwen_model,
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
    gemini_key = get_gemini_key()
    genai.configure(api_key=gemini_key)
    
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(
        full_prompt,
        generation_config=genai.types.GenerationConfig(temperature=temperature)
    )
    return response.text


def generate_text(prompt: str, system_prompt: str = "", temperature: float = 0.2) -> str:
    """Generate freeform text using Alibaba Cloud Qwen 2.5 with Gemini fallback."""
    dashscope_key, _, qwen_model = get_dashscope_config()
    gemini_key = get_gemini_key()

    if dashscope_key:
        try:
            logger.info(f"Calling Alibaba Cloud Model Studio ({qwen_model})...")
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            return _call_qwen_chat(messages, temperature=temperature)
        except Exception as e:
            logger.warning(f"Alibaba Cloud Qwen call failed ({e}), falling back to Gemini...")
    
    if gemini_key:
        try:
            logger.info("Calling Google Gemini fallback...")
            return _call_gemini_chat(prompt, system_prompt=system_prompt, temperature=temperature)
        except Exception as e:
            logger.error(f"Gemini fallback also failed: {e}")
            raise e

    raise ValueError("Neither DASHSCOPE_API_KEY nor GEMINI_API_KEY is configured.")


def generate_json(prompt: str, system_prompt: str = "", temperature: float = 0.2) -> Dict[str, Any]:
    """Generate a structured JSON dictionary using Alibaba Cloud Qwen 2.5 with Gemini fallback."""
    dashscope_key, _, qwen_model = get_dashscope_config()
    gemini_key = get_gemini_key()

    json_system_prompt = (
        (system_prompt + "\n" if system_prompt else "") +
        "You MUST respond ONLY with a valid JSON object. Do not include any explanations, greetings, or markdown code fences."
    )
    
    raw_text = ""
    if dashscope_key:
        try:
            logger.info(f"Generating JSON via Alibaba Cloud Model Studio ({qwen_model})...")
            messages = [
                {"role": "system", "content": json_system_prompt},
                {"role": "user", "content": prompt}
            ]
            raw_text = _call_qwen_chat(messages, temperature=temperature, response_format="json_object")
            cleaned = clean_json_markdown(raw_text)
            return json.loads(cleaned)
        except Exception as e:
            logger.warning(f"Alibaba Cloud Qwen JSON generation failed ({e}), falling back to Gemini...")

    if gemini_key:
        try:
            logger.info("Generating JSON via Google Gemini fallback...")
            raw_text = _call_gemini_chat(prompt, system_prompt=json_system_prompt, temperature=temperature)
            cleaned = clean_json_markdown(raw_text)
            return json.loads(cleaned)
        except Exception as e:
            logger.error(f"Gemini fallback JSON generation failed: {e}")
            raise e

    raise ValueError("Neither DASHSCOPE_API_KEY nor GEMINI_API_KEY is configured.")
