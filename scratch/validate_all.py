import re
import os

print("--- AUDITING UNICORN GOODS REPOSITORY ---")

# 1. Check all files exist
required_files = [
    "index.html",
    "admin.html",
    "UNIADMSCREATE.html",
    "style.css",
    "firebase-config.js",
    "app.js",
    "admin.js",
    "vercel.json",
    "_redirects",
    "netlify.toml"
]

all_exist = True
for f in required_files:
    path = os.path.join("e:\\unicon study", f)
    if os.path.exists(path):
        size = os.path.getsize(path)
        print(f"[OK] {f} exists ({size} bytes)")
    else:
        print(f"[FAIL] Missing {f}")
        all_exist = False

# 2. Check DOM ID Consistency
def extract_ids_from_html(html_path):
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return set(re.findall(r'id=["\']([^"\']+)["\']', content))

def extract_dom_ids_from_js(js_path):
    with open(js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return set(re.findall(r'getElementById\(["\']([^"\']+)["\']\)', content))

index_ids = extract_ids_from_html("e:\\unicon study\\index.html")
app_js_ids = extract_dom_ids_from_js("e:\\unicon study\\app.js")
missing_in_index = app_js_ids - index_ids

admin_ids = extract_ids_from_html("e:\\unicon study\\admin.html")
admin_js_ids = extract_dom_ids_from_js("e:\\unicon study\\admin.js")
missing_in_admin = admin_js_ids - admin_ids

print("\n--- DOM ID AUDIT ---")
print(f"app.js referenced IDs missing in index.html: {missing_in_index}")
print(f"admin.js referenced IDs missing in admin.html: {missing_in_admin}")

import sys
sys.path.append("e:\\unicon study\\scratch")
from validate_syntax import check_js_syntax_exact

print("\n--- JS SYNTAX BALANCE CHECK ---")
for js_file in ["firebase-config.js", "app.js", "admin.js"]:
    path = os.path.join("e:\\unicon study", js_file)
    res = check_js_syntax_exact(path)
    print(f"{js_file}: {res}")

print("\n--- AUDIT COMPLETE ---")
