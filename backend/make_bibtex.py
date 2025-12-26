#!/usr/bin/env python3
"""
make_bibtex.py

Create BibTeX entries *without touching parsing*.

- Reads the same input.json format as parse_pdfs.py (list of root dirs, or {"paths":[...]}).
- For each root dir, reads:   <root>/parsed_pdfs.json
- Writes a NEW file:          <root>/bibtex_pdfs.json

This keeps parsing (parse_pdfs.py) and reference creation separate.

Usage:
  ./make_bibtex.py --input input.json
  ./make_bibtex.py --input input.json --parsed-name parsed_pdfs.json --output-name bibtex_pdfs.json
"""

from __future__ import annotations

import os
import re
import json
import datetime as dt
from typing import Any, Dict, List, Optional


# -----------------------------
# IO helpers
# -----------------------------
def read_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: str, data: Any) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def load_input_paths(input_json_path: str) -> List[str]:
    data = read_json(input_json_path)
    if isinstance(data, list):
        paths = data
    elif isinstance(data, dict) and isinstance(data.get("paths"), list):
        paths = data["paths"]
    else:
        raise ValueError("input.json must be a JSON list of paths or {'paths':[...]}")

    out: List[str] = []
    for p in paths:
        if isinstance(p, str) and p.strip():
            out.append(os.path.expanduser(p.strip()))
    return out


# -----------------------------
# BibTeX formatting
# -----------------------------
_BIBTEX_ESC = {
    "\\": r"\\",
    "{": r"\{",
    "}": r"\}",
    "%": r"\%",
    "$": r"\$",
    "&": r"\&",
    "#": r"\#",
    "_": r"\_",
    "~": r"\~{}",
    "^": r"\^{}",
}


def bibtex_escape(s: str) -> str:
    """Escape the most common BibTeX special chars."""
    if not s:
        return ""
    return "".join(_BIBTEX_ESC.get(ch, ch) for ch in s)


def _fold_ascii(s: str) -> str:
    # rough "diacritics folding" without extra deps
    repl = {
        "ä": "a", "Ä": "a", "ö": "o", "Ö": "o", "ü": "u", "Ü": "u",
        "ß": "ss",
        "ç": "c", "Ç": "c",
        "ğ": "g", "Ğ": "g",
        "ı": "i", "İ": "i",
        "ş": "s", "Ş": "s",
        "é": "e", "è": "e", "ê": "e", "ë": "e",
        "á": "a", "à": "a", "â": "a", "ã": "a",
        "ó": "o", "ò": "o", "ô": "o", "õ": "o",
        "ú": "u", "ù": "u", "û": "u",
        "ñ": "n",
    }
    return "".join(repl.get(ch, ch) for ch in s)


def _normalize_key_token(s: str) -> str:
    s = _fold_ascii(s or "").lower()
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s


_STOPWORDS = {
    "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on",
    "or", "the", "to", "with", "without", "via", "using",
}


def _first_significant_title_word(title: str) -> str:
    for w in re.split(r"\s+", (title or "").strip()):
        ww = re.sub(r"[^\w]+", "", _fold_ascii(w).lower())
        if ww and ww not in _STOPWORDS:
            return ww
    return "work"


def _last_name_from_author(author: str) -> str:
    a = (author or "").strip()
    if not a:
        return "anon"
    # If "Surname, Given"
    if "," in a:
        return _normalize_key_token(a.split(",", 1)[0])
    # Else assume last token is surname
    parts = re.split(r"\s+", a)
    return _normalize_key_token(parts[-1] if parts else a)


def _bibtex_author_field(authors: List[str]) -> str:
    # parse_pdfs.py already outputs "Surname, Given", which BibTeX likes.
    cleaned: List[str] = []
    for a in (authors or []):
        a = (a or "").strip()
        if not a:
            continue
        cleaned.append(a)
    return " and ".join(cleaned)


def guess_entry_type(title: str, file_name: str) -> str:
    """Best-effort type guess. Falls back to 'misc'."""
    t = _fold_ascii((title or "").lower())
    fn = _fold_ascii((file_name or "").lower())

    # theses/dissertations
    if "phd" in t or "dissertation" in t or "doctoral" in t:
        return "phdthesis"
    if "master" in t or "msc" in t or "m.sc" in t:
        return "mastersthesis"
    if "thesis" in t:
        # ambiguous; default to phdthesis is risky; use generic thesis type
        return "phdthesis"

    # conference/proceedings
    if "proceedings" in t or "conference" in t or "symposium" in t or "workshop" in t:
        return "inproceedings"

    # technical report hints (NASA TM/TP, "technical report", etc.)
    if "technical report" in t or "tech report" in t or "nasa/tm" in t or "nasa/tp" in t:
        return "techreport"
    if re.search(r"\b(tm|tp|tr)[-_]?\d{3,}\b", fn) or "report" in t:
        return "techreport"

    # if nothing suggests otherwise
    return "misc"


def format_bibtex(entry_type: str, key: str, fields: Dict[str, str]) -> str:
    """Render a BibTeX entry with stable ordering."""
    order_by_type = {
        "article": ["author", "title", "journal", "year", "volume", "number", "pages", "doi", "url", "note"],
        "inproceedings": ["author", "title", "booktitle", "year", "pages", "doi", "url", "note"],
        "techreport": ["author", "title", "institution", "number", "year", "doi", "url", "note"],
        "phdthesis": ["author", "title", "school", "year", "url", "note"],
        "mastersthesis": ["author", "title", "school", "year", "url", "note"],
        "misc": ["author", "title", "year", "howpublished", "url", "note"],
    }
    order = order_by_type.get(entry_type, order_by_type["misc"])

    lines = [f"@{entry_type}{{{key},"]
    used = set()
    for k in order:
        v = fields.get(k, "").strip()
        if v:
            lines.append(f"  {k} = {{{bibtex_escape(v)}}},")
            used.add(k)
    # append any extra fields not in the default order (stable alpha)
    for k in sorted(fields.keys()):
        if k in used:
            continue
        v = fields.get(k, "").strip()
        if v:
            lines.append(f"  {k} = {{{bibtex_escape(v)}}},")
    # remove trailing comma on last field if any
    if len(lines) > 1 and lines[-1].endswith(","):
        lines[-1] = lines[-1][:-1]
    lines.append("}")
    return "\n".join(lines)


def make_bibtex_record(rec: Dict[str, Any], used_keys: Dict[str, int]) -> Dict[str, Any]:
    title = (rec.get("title") or "").strip()
    authors = rec.get("authors") or []
    year = rec.get("year", None)
    file_name = (rec.get("file_name") or "").strip()
    file_path = (rec.get("file_path") or "").strip()

    entry_type = guess_entry_type(title, file_name)

    first_author = authors[0] if isinstance(authors, list) and authors else ""
    base_key = _last_name_from_author(first_author) or "anon"
    y = str(year) if isinstance(year, int) else "nodate"
    w = _first_significant_title_word(title)

    key = _normalize_key_token(base_key + y + w)
    if not key:
        key = "ref" + y

    # ensure uniqueness
    n = used_keys.get(key, 0)
    used_keys[key] = n + 1
    if n > 0:
        key = f"{key}{n+1}"

    fields: Dict[str, str] = {}
    a_field = _bibtex_author_field(authors if isinstance(authors, list) else [])
    if a_field:
        fields["author"] = a_field
    if title:
        fields["title"] = title
    if isinstance(year, int):
        fields["year"] = str(year)

    # Minimal but useful provenance
    fields["note"] = f"Local PDF: {file_name}" if file_name else "Local PDF"
    if file_path:
        # not a standard BibTeX field, but many tools accept it
        fields["file"] = file_path

    if entry_type == "misc":
        fields.setdefault("howpublished", "PDF")

    bibtex = format_bibtex(entry_type, key, fields)

    return {
        "file_path": file_path,
        "file_name": file_name,
        "title": title,
        "authors": authors,
        "year": year,
        "bibtex_type": entry_type,
        "bibtex_key": key,
        "bibtex": bibtex,
    }


def process_root(root: str, parsed_name: str, output_name: str) -> Optional[str]:
    parsed_path = os.path.join(root, parsed_name)
    if not os.path.isfile(parsed_path):
        print(f"[WARN] Missing parsed file: {parsed_path}")
        return None

    data = read_json(parsed_path)
    records = data.get("pdfs", [])
    if not isinstance(records, list):
        print(f"[WARN] Bad format in {parsed_path}: expected dict with 'pdfs' list")
        return None

    used_keys: Dict[str, int] = {}
    bib_records: List[Dict[str, Any]] = []
    for rec in records:
        if not isinstance(rec, dict):
            continue
        bib_records.append(make_bibtex_record(rec, used_keys))

    out = {
        "root_path": root,
        "source_parsed_json": parsed_name,
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "bibtex_count": len(bib_records),
        "entries": bib_records,
    }

    out_path = os.path.join(root, output_name)
    write_json(out_path, out)
    print(f"[OK] Wrote: {out_path} (entries={len(bib_records)})")
    return out_path


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="input.json", help="Same input.json used by parse_pdfs.py")
    ap.add_argument("--parsed-name", default="parsed_pdfs.json", help="Name of the parsed JSON file in each root directory")
    ap.add_argument("--output-name", default="bibtex_pdfs.json", help="Output JSON name to write in each root directory")
    args = ap.parse_args()

    try:
        roots = load_input_paths(args.input)
    except Exception as e:
        print(f"[ERROR] Failed to read {args.input}: {type(e).__name__}: {e}")
        return 2

    if not roots:
        print("No paths found in input.json")
        return 3

    wrote_any = False
    for root in roots:
        if not os.path.isdir(root):
            print(f"[WARN] Not a directory: {root}")
            continue
        outp = process_root(root, args.parsed_name, args.output_name)
        wrote_any = wrote_any or (outp is not None)

    return 0 if wrote_any else 4


if __name__ == "__main__":
    raise SystemExit(main())
