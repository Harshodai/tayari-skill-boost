import os
import re
import sys

def check_stubs(directory):
    patterns = [
        r"TODO",
        r"FIXME",
        r"placeholder",
        r"pass\s*$",
        r"return\s*\{\}\s*$",
        r"return\s*None\s*$",
        r"NotImplementedError"
    ]
    
    stub_count = 0
    print(f"🔍 Scanning {directory} for stubs and placeholders...")
    
    for root, dirs, files in os.walk(directory):
        if "node_modules" in dirs:
            dirs.remove("node_modules")
        if ".git" in dirs:
            dirs.remove(".git")
            
        for file in files:
            if file.endswith((".py", ".tsx", ".ts", ".js")):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        for pattern in patterns:
                            matches = re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)
                            for match in matches:
                                line_no = content.count('\n', 0, match.start()) + 1
                                print(f"🚩 Found '{match.group()}' in {path}:{line_no}")
                                stub_count += 1
                except Exception as e:
                    print(f"❌ Error reading {path}: {e}")
                    
    print(f"\n✅ Scan complete. Found {stub_count} potential stubs/placeholders.")

if __name__ == "__main__":
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    check_stubs(target_dir)
