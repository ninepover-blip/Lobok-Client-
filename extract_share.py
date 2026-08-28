#!/usr/bin/env python3
"""
Извлекает исходники проекта из HTML-страницы шаринга opencode (opncd.ai/share/xxx).

Содержимое файлов вшито в сериализованное состояние страницы:
  - вызовы инструмента write:  filePath:"..."  content:"..."
  - вызовы инструмента edit:   filePath:"..."  oldString:"..." newString:"..."
  - снимки предпросмотра:      type:"file", path:"...", text:"..."

Версии одного файла упорядочиваются по смещению в документе (позже = новее),
поэтому итогом становится последнее состояние файла.

Использование:
    python3 extract_share.py share.html ./lobok-client
"""
import json
import re
import sys
from pathlib import Path

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/share.html"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/home/user/lobok-client")

data = Path(SRC).read_text(encoding="utf-8", errors="replace")


def read_js_string(s: str, i: int):
    """s[i] — открывающая кавычка. Возвращает (сырой литерал, индекс после)."""
    quote = s[i]
    j = i + 1
    buf = []
    while j < len(s):
        c = s[j]
        if c == "\\":
            buf.append(s[j:j + 2])
            j += 2
            continue
        if c == quote:
            return "".join(buf), j + 1
        buf.append(c)
        j += 1
    raise ValueError("unterminated string")


def decode_js(raw: str) -> str:
    raw = re.sub(r"\\x([0-9a-fA-F]{2})", lambda m: "\\u00" + m.group(1), raw)
    raw = raw.replace("\\'", "'")
    try:
        return json.loads('"' + raw + '"')
    except json.JSONDecodeError:
        out, k = [], 0
        simple = {"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f",
                  "\\": "\\", '"': '"', "/": "/", "0": "\0"}
        while k < len(raw):
            if raw[k] == "\\" and k + 1 < len(raw):
                nxt = raw[k + 1]
                if nxt in simple:
                    out.append(simple[nxt]); k += 2; continue
                if nxt == "u" and k + 6 <= len(raw):
                    try:
                        out.append(chr(int(raw[k + 2:k + 6], 16))); k += 6; continue
                    except ValueError:
                        pass
                out.append(nxt); k += 2; continue
            out.append(raw[k]); k += 1
        return "".join(out)


def grab(offset: int, key: str, window: int = 400):
    """Ищет key:"..." начиная с offset в пределах окна."""
    m = re.search(rf'\b{key}\s*:\s*"', data[offset:offset + window])
    if not m:
        return None, None
    q = offset + m.end() - 1
    raw, after = read_js_string(data, q)
    return decode_js(raw), after


def normalize(p: str) -> str:
    p = p.replace("\\", "/")
    low = p.lower()
    if low.startswith("c:/lobok-client/"):
        return p[len("c:/lobok-client/"):]
    p = re.sub(r"^[A-Za-z]:/", "", p)
    return p.lstrip("/")


# ---- собираем события с их позицией в документе -------------------------
events = []   # (offset, kind, path, payload)

for m in re.finditer(r'tool:"(write|edit)"', data):
    kind = m.group(1)
    path, after = grab(m.end(), "filePath", 3000)
    if not path:
        continue
    if kind == "write":
        content, _ = grab(after, "content", 400)
        if content is not None:
            events.append((m.start(), "write", normalize(path), content))
    else:
        old, a2 = grab(after, "oldString", 400)
        new, _ = grab(a2 or after, "newString", 400)
        if old is not None and new is not None:
            events.append((m.start(), "edit", normalize(path), (old, new)))

for m in re.finditer(r'type:"file",\s*path:"', data):
    path, after = grab(m.start(), "path", 200)
    if not path:
        continue
    text, _ = grab(after, "text", 200)
    if text is not None:
        events.append((m.start(), "write", normalize(path), text))

events.sort(key=lambda e: e[0])
print(f"Событий с файлами: {len(events)}")

# ---- проигрываем историю по порядку -------------------------------------
files: dict[str, str] = {}
edits_ok = edits_fail = 0
for _, kind, rel, payload in events:
    if not rel or rel.endswith("/") or ".." in rel.split("/"):
        continue
    if kind == "write":
        files[rel] = payload
    else:
        old, new = payload
        cur = files.get(rel)
        if cur is None:
            continue
        if old and old in cur:
            files[rel] = cur.replace(old, new, 1)
            edits_ok += 1
        else:
            edits_fail += 1

print(f"Применено правок: {edits_ok}" + (f", не применилось: {edits_fail}" if edits_fail else ""))

SKIP = ("node_modules/", ".next/", ".git/")
written = 0
for rel, content in sorted(files.items()):
    if rel.startswith(SKIP):
        continue
    target = OUT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8", newline="")
    written += 1
    print(f"  ✔ {rel}  ({len(content)} симв.)")

print(f"\nЗаписано файлов: {written}\nПапка: {OUT}")
