#!/usr/bin/env python3
"""
DnDAIe5 - Google GenAI Backend Engine
Uses the official Google GenAI SDK (pip install google-genai)
"""

import sys
import os
import json
import re

# Force UTF-8 for stdin/stdout on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stdin.encoding != 'utf-8':
    sys.stdin.reconfigure(encoding='utf-8')

# Load API key from .env.local if not already in env
def load_env_local():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local')
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        k = k.strip()
                        v = v.strip().strip("'").strip('"')
                        if k and not os.environ.get(k):
                            os.environ[k] = v
        except Exception:
            pass

load_env_local()

try:
    from google import genai
    from google.genai import types
except ImportError:
    print(json.dumps({
        "error": "SDK 'google-genai' is not installed. Run: pip install google-genai"
    }, ensure_ascii=True))
    sys.exit(1)

def extract_json(text: str) -> dict:
    if not text:
        raise ValueError("Empty response text")
    clean = text.strip()
    clean = re.sub(r'^```(?:json)?\s*', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'\s*```$', '', clean)
    clean = clean.strip()
    
    first_brace = clean.find('{')
    last_brace = clean.rfind('}')
    if first_brace != -1 and last_brace != -1:
        clean = clean[first_brace:last_brace + 1]
    
    return json.loads(clean)

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"error": "No input provided to Python dm_engine"}, ensure_ascii=True))
            sys.exit(1)
        
        req_data = json.loads(raw_input)
        prompt = req_data.get('prompt', '')
        model_name = req_data.get('model', 'gemini-2.0-flash')
        api_key = req_data.get('apiKey') or os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')

        if not prompt:
            print(json.dumps({"error": "Prompt is empty"}, ensure_ascii=True))
            sys.exit(1)

        if not api_key:
            print(json.dumps({
                "error": "NO_GEMINI_API_KEY",
                "message": "GEMINI_API_KEY is not set. Please provide Google Gemini API key."
            }, ensure_ascii=True))
            sys.exit(0)

        # Initialize official Google GenAI Client
        client = genai.Client(api_key=api_key)

        # Call Gemini models (gemini-2.0-flash, gemini-1.5-pro, etc.)
        config = types.GenerateContentConfig(
            temperature=0.75,
            response_mime_type="application/json",
        )

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=config,
        )

        resp_text = response.text or ""
        parsed = extract_json(resp_text)
        print(json.dumps(parsed, ensure_ascii=True))

    except Exception as err:
        err_msg = str(err)
        print(json.dumps({
            "error": f"Google GenAI Error: {err_msg}",
            "is_error": True
        }, ensure_ascii=True))
        sys.exit(0)

if __name__ == '__main__':
    main()
