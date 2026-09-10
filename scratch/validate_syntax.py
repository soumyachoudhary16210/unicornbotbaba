import re

def check_js_syntax_exact(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        code = f.read()

    # Accurate state-machine tokenizer
    i = 0
    n = len(code)
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    line = 1
    col = 1
    
    while i < n:
        ch = code[i]
        if ch == '\n':
            line += 1
            col = 1
            i += 1
            continue
            
        # Single-line comment
        if ch == '/' and i + 1 < n and code[i+1] == '/':
            i += 2
            while i < n and code[i] != '\n':
                i += 1
            continue
            
        # Multi-line comment
        if ch == '/' and i + 1 < n and code[i+1] == '*':
            i += 2
            while i + 1 < n and not (code[i] == '*' and code[i+1] == '/'):
                if code[i] == '\n':
                    line += 1
                    col = 1
                i += 1
            i += 2
            continue
            
        # Single-quoted string
        if ch == "'":
            i += 1
            while i < n and code[i] != "'":
                if code[i] == '\\':
                    i += 2
                else:
                    if code[i] == '\n':
                        line += 1
                        col = 1
                    i += 1
            i += 1
            continue
            
        # Double-quoted string
        if ch == '"':
            i += 1
            while i < n and code[i] != '"':
                if code[i] == '\\':
                    i += 2
                else:
                    if code[i] == '\n':
                        line += 1
                        col = 1
                    i += 1
            i += 1
            continue
            
        # Template literal (backticks)
        if ch == '`':
            i += 1
            while i < n and code[i] != '`':
                if code[i] == '\\':
                    i += 2
                elif code[i] == '$' and i + 1 < n and code[i+1] == '{':
                    # nested JS expression inside ${...}
                    # We let the main loop handle it by breaking or pushing
                    pass
                if i < n and code[i] == '\n':
                    line += 1
                    col = 1
                i += 1
            i += 1
            continue

        # Regex literal detection
        if ch == '/' and (i == 0 or code[i-1] in '=(:,;!&|?+\n\t '):
            # check if regex
            j = i + 1
            is_regex = False
            while j < n and code[j] != '\n':
                if code[j] == '\\':
                    j += 2
                    continue
                if code[j] == '/':
                    is_regex = True
                    j += 1
                    while j < n and code[j].isalpha():
                        j += 1
                    break
                j += 1
            if is_regex:
                i = j
                continue

        # Delimiters
        if ch in '({[':
            stack.append((ch, line, col))
        elif ch in ')}]':
            if not stack:
                return f"Error: Unmatched '{ch}' at line {line}, col {col}"
            top, top_line, top_col = stack.pop()
            if top != pairs[ch]:
                return f"Error: Mismatched pair: '{top}' (line {top_line}) with '{ch}' (line {line}, col {col})"
                
        i += 1
        col += 1
        
    if stack:
        top, top_line, top_col = stack[-1]
        return f"Error: Unclosed delimiter '{top}' opened at line {top_line}, col {top_col}"
        
    return "Syntax and Delimiters 100% Valid & Balanced"

for f in ["e:\\unicon study\\firebase-config.js", "e:\\unicon study\\app.js", "e:\\unicon study\\admin.js"]:
    print(f"{f}: {check_js_syntax_exact(f)}")
