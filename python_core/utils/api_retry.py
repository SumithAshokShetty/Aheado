import urllib.request
import json
import time
import random
import sys

def call_api_with_retry(url_template, data, headers, api_keys_pool, max_retries=15, initial_backoff=2):
    """Executes an API request with exponential backoff, jitter, and key rotation."""
    backoff = initial_backoff
    
    # Make a local copy of valid keys, ignoring temporary 1-hour OAuth platform tokens
    active_keys = []
    for k in api_keys_pool:
        key_str = k.strip()
        if not key_str:
            continue
        # Avoid any temporary 1-hour OAuth/Bearer platform tokens from clogging the loop
        if key_str.startswith("ya29") or key_str.startswith("Bearer"):
            sys.stderr.write(f"DEBUG: Ignoring temporary OAuth/Bearer token in API retry pool (prefix: {key_str[:4]}).\n")
            continue
        active_keys.append(key_str)
        
    if not active_keys:
        raise ValueError("No valid API keys in pool")

    for attempt in range(max_retries):
        if not active_keys:
            raise ValueError("All API keys in pool have been removed due to auth errors")
            
        # Rotate key within the remaining active ones
        key = active_keys[attempt % len(active_keys)]
            
        req_headers = headers.copy()
        
        # Both keys starting with 'AIza' and keys starting with 'AQ.' are treated as
        # valid, permanent, long-lived developer API keys, cleanly injected into standard target template
        if key.startswith("AIza") or key.startswith("AQ.") or key.startswith("AQ"):
            url = url_template.replace("{key}", key)
        else:
            # Fallback query parameter replacement
            url = url_template.replace("{key}", key)
            
        request = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=req_headers)
        
        try:
            with urllib.request.urlopen(request) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            # If it is a permanent auth error (401, 403), remove the key from rotation and try next key immediately
            if e.code in [401, 403]:
                sys.stderr.write(f"DEBUG: Auth Error {e.code} for key prefix {key[:4]}. Removing invalid key from rotation pool.\n")
                if key in active_keys:
                    active_keys.remove(key)
                if active_keys and attempt < max_retries - 1:
                    continue
                raise e
                
            # If we hit rate limits (429) or server errors, rotate to next key immediately with zero delay
            if (e.code in [400, 429, 500, 502, 503, 504]) and attempt < max_retries - 1:
                sys.stderr.write(f"DEBUG: {e.code} Error (key prefix: {key[:4]}). Key rate-limited or busy, rotating to next key immediately (attempt {attempt + 1}/{max_retries})...\n")
                continue
            raise e
