import os
from google import genai
import time

class GeminiProxy:
    def __init__(self, keys_env_var="GEMINI_API_KEYS"):
        raw_keys = os.environ.get(keys_env_var, "")
        self.keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
        if not self.keys:
            # Fallback to single key if available
            single_key = os.environ.get("GEMINI_API_KEY", "")
            if single_key:
                self.keys = [single_key]
                
        self.current_idx = 0
        if self.keys:
            self.client = genai.Client(api_key=self.keys[self.current_idx])
        else:
            self.client = None # type: ignore

    def rotate(self):
        if not self.keys: return
        self.current_idx = (self.current_idx + 1) % len(self.keys)
        print(f"🔄 [GeminiProxy] Đổi sang API Key thứ {self.current_idx + 1}...")
        self.client = genai.Client(api_key=self.keys[self.current_idx])

    @property
    def models(self):
        return self

    def generate_content(self, *args, **kwargs):
        if not self.client:
            raise Exception("No API Keys configured!")
            
        max_retries = max(1, len(self.keys)) # Try each key once
        last_exception = None
        
        for attempt in range(max_retries):
            try:
                return self.client.models.generate_content(*args, **kwargs)
            except Exception as e:
                err_msg = str(e).lower()
                last_exception = e
                # Check for rate limit, quota, 429
                if "429" in err_msg or "quota" in err_msg or "rate limit" in err_msg or "exhausted" in err_msg:
                    print(f"⚠️ API Key {self.current_idx + 1} bị limit. Đang đổi key...")
                    self.rotate()
                    time.sleep(0.5)
                else:
                    raise e
                    
        raise Exception(f"❌ Tất cả API Keys đều đã bị Rate Limit hoặc hết Quota! Lỗi cuối: {last_exception}")
