#!/usr/bin/python3
from __future__ import annotations

import os
import re
import json
import uuid
import datetime as dt
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

# -----------------------------
# Config
# -----------------------------
DEFAULT_GROBID_BASE = "http://localhost:8070"
TEI_NS = {"tei": "http://www.tei-c.org/ns/1.0"}
CURRENT_YEAR = dt.datetime.now().year

# -----------------------------
# Year helpers (GROBID TEI + PDF fallback)
# -----------------------------
def _year_candidates(text: str) -> List[int]:
    if not text:
        return []
    years = re.findall(r"\b((?:19|20)\d{2})\b", text)
    out: List[int] = []
    for y in years:
        yi = int(y)
        if 1950 <= yi <= CURRENT_YEAR + 1:
            out.append(yi)
    return out

def _pick_best_year_scored(cands: List[Tuple[int, int]]) -> Optional[int]:
    """
    cands: list of (year, score). Higher score wins.
    Tie-break: higher year wins.
    """
    if not cands:
        return None
    cands.sort(key=lambda t: (t[1], t[0]), reverse=True)
    best_score = cands[0][1]
    top = [y for (y, s) in cands if s == best_score]
    return max(top) if top else cands[0][0]

def _import_pdfreader():
    try:
        from pypdf import PdfReader  # modern
        return PdfReader
    except Exception:
        from PyPDF2 import PdfReader  # distro/older
        return PdfReader

MONTHS = {
    "january","february","march","april","may","june",
    "july","august","september","october","november","december"
}

def _year_candidates_from_text(s: str) -> List[int]:
    return _year_candidates(s)

def _score_year_in_line(line: str, y: int) -> int:
    low = line.lower()

    # Kill common junk that causes wrong years
    if "downloaded by" in low:
        return -999
    if "doi" in low and "http" in low:
        return 5

    score = 10

    # Strong: month + year ("November 2023")
    for m in MONTHS:
        if m in low and str(y) in low:
            score = max(score, 95)

    # Strong: journal volume/issue line containing year
    if ("vol." in low or "volume" in low or "no." in low or "issue" in low) and str(y) in low:
        score = max(score, 85)

    # Medium: copyright line
    if ("copyright" in low or "©" in low) and str(y) in low:
        score = max(score, 80)

    return score

def fallback_year_from_pdf_first_pages(pdf_path: str, pages: int = 2) -> Optional[int]:
    """
    Offline fallback when GROBID doesn't provide year.
    Extract text from first N pages using pypdf/PyPDF2 and score year candidates.
    """
    PdfReader = _import_pdfreader()
    reader = PdfReader(pdf_path)

    text_parts: List[str] = []
    for i in range(min(pages, len(reader.pages))):
        try:
            text_parts.append(reader.pages[i].extract_text() or "")
        except Exception:
            pass

    text = "\n".join(text_parts)
    if not text.strip():
        return None

    best: Tuple[int, int] = (0, -10**9)  # (year, score)
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        for y in _year_candidates_from_text(line):
            s = _score_year_in_line(line, y)
            if s > best[1] or (s == best[1] and y > best[0]):
                best = (y, s)

    return best[0] if best[1] > 0 else None

# -----------------------------
# PDF first-page fallback: title + authors blocks
# -----------------------------
def _norm_spaces(s: str) -> str:
    return re.sub(r"\s{2,}", " ", s).strip()

def _looks_like_noise_line(s: str) -> bool:
    """
    Heuristic filter for title/author extraction from raw PDF text.

    We want to discard lines that are *very likely* to be:
    - URLs / DOIs / license boilerplate
    - addresses / affiliations
    - section labels like "Abstract" / "Keywords"
    - proceedings/editorial boilerplate
    """
    s = _norm_spaces(s)
    low = s.lower().strip()
    if not s:
        return True

    # URLs / identifiers / license boilerplate
    if "http" in low or "doi" in low:
        return True
    if "licensed under" in low or "creativecommons" in low:
        return True
    if "copyright" in low or "rights reserved" in low:
        return True

    # Proceedings / editorial boilerplate
    if "proceedings" in low or "edited by" in low:
        return True
    if "peer reviewed" in low:
        return True
    if "author:" in low:
        return True

    # Common "not-a-title" descriptors seen in reports / code docs
    if low.startswith("programming language") or low.startswith("nature of problem"):
        return True
    if "these authors contributed equally" in low:
        return True

    # Section labels (treat as noise)
    # (Keep this strict to avoid false positives like "abstract interpretation" titles.)
    if re.match(r"^(abstract|keywords?|key words)\b", low):
        return True
    if re.search(r"\b(abstract|keywords?)\b\s*[:,-]", low) and low.find("abstract") < 30:
        return True

    # Emails
    if "@" in s:
        return True

    # Address/affiliation patterns
    # - postal codes (EU + US)
    if re.search(r"\b\d{3}\s?\d{2}\b", s) or re.search(r"\b\d{5}(?:-\d{4})?\b", s):
        return True

    # - "StreetName 12, City" patterns
    if re.search(r"\b\d{1,5}\s+[A-Za-z]{2,}\b", s) and "," in s:
        return True

    # - too many commas usually means affiliation / address / author list
    if s.count(",") >= 3 and len(s.split()) > 8:
        return True

    # - affiliation keywords + comma + (digits or country-ish words) => very likely address block
    if any(k in low for k in ["university", "department", "faculty", "institute", "laboratory", "centre", "center"]):
        if "," in s and (re.search(r"\d", s) or any(c in low for c in ["republic", "usa", "u.s.", "uk", "germany", "france", "italy", "spain", "china", "japan", "canada", "australia", "turkey", "türkiye", "poland"])):
            return True

    return False

def _is_section_label_line(line: str, label: str) -> bool:
    """
    Return True if `line` looks like the start of a section block like "Abstract" or "Keywords".
    Handles both:
      - "Abstract: ...."
      - "... Abstract, ...." (affiliation line + abstract on same line)
    """
    low = line.lower().strip()
    if not low:
        return False
    if re.match(rf"^{re.escape(label)}\b", low):
        return True
    m = re.search(rf"\b{re.escape(label)}\b\s*[:,-]", low)
    return bool(m and m.start() < 30)
def pdf_first_pages_text_lines(pdf_path: str, pages: int = 1) -> List[str]:
    PdfReader = _import_pdfreader()  # you already have this helper for year fallback
    reader = PdfReader(pdf_path)

    parts: List[str] = []
    for i in range(min(pages, len(reader.pages))):
        try:
            parts.append(reader.pages[i].extract_text() or "")
        except Exception:
            pass

    text = "\n".join(parts)
    lines = [_norm_spaces(x) for x in text.splitlines()]
    # drop empty
    return [ln for ln in lines if ln]


# -----------------------------
# Header extraction for journal/volume/issue (PDF tools + regex)
# -----------------------------
def _import_pdfplumber():
    try:
        import pdfplumber  # type: ignore
        return pdfplumber
    except Exception:
        return None

def extract_header_lines_from_pdf(pdf_path: str, page_index: int, top_frac: float = 0.18) -> List[str]:
    """
    Extract *header region* lines from a specific page using pdfplumber (preferred).
    Falls back to pypdf/PyPDF2 full-page text if pdfplumber fails.

    page_index is 0-based.
    top_frac is fraction of page height to treat as header.
    """
    pdfplumber = _import_pdfplumber()
    if pdfplumber is not None:
        try:
            with pdfplumber.open(pdf_path) as pdf:
                if page_index < 0 or page_index >= len(pdf.pages):
                    return []
                page = pdf.pages[page_index]
                w = float(page.width)
                h = float(page.height)
                bbox = (0, 0, w, h * float(top_frac))  # (x0, top, x1, bottom)
                header_text = page.crop(bbox).extract_text(x_tolerance=2, y_tolerance=2) or ""
            lines = [_norm_spaces(x) for x in header_text.splitlines()]
            return [ln for ln in lines if ln]
        except Exception:
            pass

    # Fallback: pypdf/PyPDF2 (ordering can be unreliable for multi-column layouts)
    PdfReader = _import_pdfreader()
    try:
        reader = PdfReader(pdf_path)
        if page_index < 0 or page_index >= len(reader.pages):
            return []
        text = reader.pages[page_index].extract_text() or ""
        lines = [_norm_spaces(x) for x in text.splitlines()]
        return [ln for ln in lines if ln][:60]
    except Exception:
        return []

def is_aiaa_paper_pdf(pdf_path: str) -> bool:
    """
    Heuristic AIAA detection.

    Strong signals:
      - DOI prefix 10.2514 (AIAA)
      - Keyword 'AIAA' on first page
    """
    # First page header region
    hdr0 = " ".join(extract_header_lines_from_pdf(pdf_path, 0, top_frac=0.22))
    if re.search(r"\bAIAA\b", hdr0, flags=re.IGNORECASE):
        return True
    if "10.2514" in hdr0:
        return True

    # First page full text (DOI often appears near title/footer)
    try:
        full0 = "\n".join(pdf_first_pages_text_lines(pdf_path, pages=1))
        if "10.2514" in full0:
            return True
        if re.search(r"\bAIAA\b", full0, flags=re.IGNORECASE):
            return True
        if re.search(r"american institute of aeronautics and astronautics", full0, flags=re.IGNORECASE):
            return True
        # Common AIAA journal header line (often all-caps)
        if re.search(r"JOURNAL OF\s+[A-Z][A-Z\s&-]{6,}", full0):
            return True
    except Exception:
        pass

    return False

def extract_title_from_cite_as(lines: List[str]) -> Optional[str]:
    """
    Example line:
    "Cite as: Harvey, E.: Combining a density-based ... model. In Proceedings of ..."
    """
    for ln in lines:
        low = ln.lower()
        if "cite as:" not in low:
            continue

        # Remove leading "Cite as:"
        s = ln.split(":", 1)[-1].strip()

        # Often pattern "... E.: <TITLE>. In ..."
        # Try split by ". In"
        m = re.search(r"\.\s+in\s+", s, flags=re.IGNORECASE)
        if m:
            s2 = s[:m.start()].strip()
        else:
            s2 = s

        # If there's "X.: Title" keep after last ".:" occurrence
        if ".:" in s2:
            s2 = s2.split(".:", 1)[-1].strip()

        # Remove trailing punctuation
        s2 = s2.strip(" .;-")
        # sanity: must be title-like
        if len(s2.split()) >= 4 and not _looks_like_noise_line(s2):
            return s2
    return None

def _title_score(s: str) -> int:
    s = _norm_spaces(s)
    if not s:
        return -10**9
    low = s.lower()

    # reject obvious non-titles
    if _looks_like_noise_line(s):
        return -10**6

    words = s.split()
    n_words = len(words)

    # too short is usually not a real title
    if n_words < 4:
        return -1000

    score = 0
    score += min(len(s), 200)            # longer title often better (cap)
    score += 20 * min(n_words, 20)

    # penalize all-caps headers (series titles)
    letters = re.sub(r"[^A-Za-z]+", "", s)
    if letters and letters.upper() == letters:
        score -= 200

    # penalize generic course/series headers
    if "cfd with opensource software" in low:
        score -= 500

    # mild bonus: typical title punctuation/structure
    if ":" in s:
        score += 30
    if "-" in s:
        score += 15

    return score

def extract_title_from_pdf_lines(lines: List[str]) -> Optional[str]:
    """
    General fallback: choose best-scoring 1-3 line span from first page.

    IMPORTANT:
    We intentionally avoid scanning into the Abstract/Keywords region because
    those lines are long and will "win" naive scoring (and then you end up
    with addresses + abstract text as the "title").
    """
    # First try cite-as (very reliable for these course proceedings)
    t = extract_title_from_cite_as(lines)
    if t:
        return t

    # Pre-trim: keep only the top part of the page (before Abstract/Keywords)
    trimmed: List[str] = []
    for ln in lines[:80]:
        ln = _norm_spaces(ln)
        if not ln:
            continue

        if (
            _is_section_label_line(ln, "abstract")
            or _is_section_label_line(ln, "keywords")
            or _is_section_label_line(ln, "key words")
        ):
            break

        trimmed.append(ln)

        # titles are almost always in the first ~30 useful lines
        if len(trimmed) >= 35:
            break

    lines = trimmed
    if not lines:
        return None

    # Otherwise score spans of 1..3 consecutive lines
    best = (None, -10**9)  # (title, score)
    N = len(lines)

    for i in range(N):
        if _looks_like_noise_line(lines[i]):
            continue

        for span in (1, 2, 3):
            if i + span > N:
                continue

            chunk = _norm_spaces(" ".join(lines[i:i+span]))

            # avoid spans that include block labels or obvious boilerplate
            low = chunk.lower()
            if any(x in low for x in ["author:", "peer reviewed by:", "licensed under", "cite as:"]):
                continue
            if _is_section_label_line(chunk, "abstract") or _is_section_label_line(chunk, "keywords"):
                continue

            # keep candidates in a realistic title length range
            n_words = len(chunk.split())
            if n_words < 4 or n_words > 35:
                continue
            if len(chunk) > 220:
                continue

            sc = _title_score(chunk)
            if sc > best[1]:
                best = (chunk, sc)

    return best[0]

def _is_good_title(s: str) -> bool:
    s = _norm_spaces(s)
    if not s:
        return False
    low = s.lower()

    if _looks_like_noise_line(s):
        return False

    # common "series header" in your dataset
    if "cfd with opensource software" in low:
        return False

    # titles should not contain abstract/keyword labels
    if (
        _is_section_label_line(s, "abstract")
        or _is_section_label_line(s, "keywords")
        or _is_section_label_line(s, "key words")
    ):
        return False

    # titles rarely have many commas (affiliations do)
    if s.count(",") >= 3:
        return False

    # avoid unrealistically long titles (usually we're grabbing title+authors+affiliation)
    if len(s.split()) > 35 or len(s) > 220:
        return False

    return True
def _norm_person(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z\s\.\-']", " ", s)
    s = _norm_spaces(s)
    return s

def extract_block_after_label(lines: List[str], label: str) -> List[str]:
    """
    Extract subsequent non-empty lines after a label line (case-insensitive),
    stopping on blank line or another label-ish line.
    """
    out: List[str] = []
    label_low = label.lower()

    # find label
    idx = None
    for i, ln in enumerate(lines):
        if ln.lower().strip().startswith(label_low):
            idx = i
            break
        if ln.lower().strip() == label_low.strip(":"):
            idx = i
            break

    if idx is None:
        return out

    # collect following lines
    for j in range(idx + 1, len(lines)):
        ln = lines[j].strip()
        low = ln.lower()

        if not ln:
            break
        if any(k in low for k in ["peer reviewed by", "licensed under", "cite as:", "cfd with opensource software"]):
            break
        # stop if next block label appears
        if low.endswith(":") and len(low) < 40:
            break

        out.append(_norm_spaces(ln))

        # prevent runaway
        if len(out) >= 12:
            break

    return out

def filter_name_lines(lines: List[str]) -> List[str]:
    """
    Keep lines that look like person names.
    """
    names: List[str] = []
    for ln in lines:
        if _looks_like_noise_line(ln):
            continue
        if re.search(r"\d", ln):
            continue
        if "university" in ln.lower():
            continue
        if "@" in ln:
            continue

        # heuristics: 1-5 tokens, mostly letters
        toks = ln.split()
        if not (1 <= len(toks) <= 5):
            continue

        letters = re.sub(r"[^A-Za-z]+", "", ln)
        if len(letters) < 4:
            continue

        names.append(ln)

    # de-dup
    out: List[str] = []
    seen = set()
    for n in names:
        k = _norm_person(n)
        if k and k not in seen:
            seen.add(k)
            out.append(n)
    return out

def fallback_authors_from_pdf(pdf_path: str) -> Optional[List[str]]:
    lines = pdf_first_pages_text_lines(pdf_path, pages=1)

    author_block = extract_block_after_label(lines, "author:")
    authors = filter_name_lines(author_block)
    if not authors:
        return None

    peer_block = extract_block_after_label(lines, "peer reviewed by:")
    peers = set(_norm_person(x) for x in filter_name_lines(peer_block))

    # remove peers if any overlap
    cleaned = []
    for a in authors:
        if _norm_person(a) not in peers:
            cleaned.append(a)

    return cleaned if cleaned else authors


# -----------------------------
# IO
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

def find_pdfs(root: str) -> List[str]:
    pdfs: List[str] = []
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if fn.lower().endswith(".pdf"):
                pdfs.append(os.path.join(dirpath, fn))
    pdfs.sort()
    return pdfs

# -----------------------------
# GROBID (stdlib HTTP)
# -----------------------------
def grobid_is_alive(base_url: str) -> bool:
    try:
        with urllib.request.urlopen(base_url.rstrip("/") + "/api/isalive", timeout=5) as resp:
            s = resp.read().decode("utf-8", errors="replace").strip().lower()
        return ("true" in s) or ("alive" in s) or (s == "ok")
    except Exception:
        return False

def multipart_post_file(
    url: str,
    field_name: str,
    filename: str,
    file_bytes: bytes,
    content_type: str = "application/pdf",
    timeout: int = 240,
    accept: str = "application/xml",
) -> str:
    boundary = f"----Boundary{uuid.uuid4().hex}"
    parts: List[bytes] = []
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(
        f'Content-Disposition: form-data; name="{field_name}"; filename="{os.path.basename(filename)}"\r\n'.encode()
    )
    parts.append(f"Content-Type: {content_type}\r\n\r\n".encode())
    parts.append(file_bytes)
    parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)

    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "Accept": accept},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")

def grobid_process_header(base_url: str, pdf_path: str) -> str:
    endpoint = base_url.rstrip("/") + "/api/processHeaderDocument"
    params = {"consolidateHeader": "0", "start": "1", "end": "2"}
    url = endpoint + "?" + urllib.parse.urlencode(params)
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
    return multipart_post_file(url, "input", pdf_path, pdf_bytes, timeout=120)

# -----------------------------
# TEI helpers
# -----------------------------
def _text(el: Optional[ET.Element]) -> str:
    if el is None:
        return ""
    return " ".join("".join(el.itertext()).split()).strip()

def _norm_name(s: str) -> str:
    s = re.sub(r"\s{2,}", " ", s).strip()
    if not s:
        return ""
    # drop obvious non-name junk
    if any(x in s.lower() for x in ["university", "department", "republic", "rights", "permission", "http", "www"]):
        return ""
    if re.search(r"\d", s):
        return ""
    if len(s.split()) > 6:
        return ""
    return s

def parse_title_authors_year_from_header_tei(tei_xml: str) -> Tuple[str, List[str], Optional[int]]:
    root = ET.fromstring(tei_xml)

    title_el = root.find(".//tei:teiHeader//tei:fileDesc//tei:titleStmt//tei:title", TEI_NS)
    title = _text(title_el)

    # Authors: ONLY from persName (avoid affiliation/address junk)
    authors: List[str] = []
    for author in root.findall(".//tei:teiHeader//tei:sourceDesc//tei:biblStruct//tei:analytic//tei:author", TEI_NS):
        pers = author.find(".//tei:persName", TEI_NS)
        if pers is None:
            continue

        forenames = [_text(x) for x in pers.findall(".//tei:forename", TEI_NS)]
        forenames = [x for x in forenames if x]
        surname = _text(pers.find(".//tei:surname", TEI_NS))

        name = " ".join([*forenames, surname]).strip()
        name = _norm_name(name)
        if name:
            authors.append(name)

    # de-dup preserve order
    seen = set()
    uniq: List[str] = []
    for a in authors:
        k = a.lower()
        if k not in seen:
            seen.add(k)
            uniq.append(a)
    authors = uniq

    # Year (robust, scored from TEI)
    scored: List[Tuple[int, int]] = []

    # (A) Strong: imprint date(s)
    for d in root.findall(
        ".//tei:teiHeader//tei:sourceDesc//tei:biblStruct//tei:monogr//tei:imprint//tei:date",
        TEI_NS,
    ):
        when = (d.get("when") or "").strip()
        if len(when) >= 4 and when[:4].isdigit():
            scored.append((int(when[:4]), 100))
        for y in _year_candidates(_text(d)):
            scored.append((y, 95))

    # (B) Other header dates
    for d in root.findall(".//tei:teiHeader//tei:date", TEI_NS):
        when = (d.get("when") or "").strip()
        if len(when) >= 4 and when[:4].isdigit():
            scored.append((int(when[:4]), 90))
        for y in _year_candidates(_text(d)):
            scored.append((y, 85))

    # (C) Monograph text often contains "... (2024)"
    monogr = root.find(".//tei:teiHeader//tei:sourceDesc//tei:biblStruct//tei:monogr", TEI_NS)
    if monogr is not None:
        for y in _year_candidates(_text(monogr)):
            scored.append((y, 75))

    # (D) biblScope
    for bs in root.findall(".//tei:teiHeader//tei:biblScope", TEI_NS):
        for y in _year_candidates(_text(bs)):
            scored.append((y, 70))

    # (E) meeting/conference year (downweight)
    meeting = root.find(".//tei:teiHeader//tei:meeting", TEI_NS)
    if meeting is not None:
        for y in _year_candidates(_text(meeting)):
            scored.append((y, 40))

    # (F) last resort: whole header
    header = root.find(".//tei:teiHeader", TEI_NS)
    if header is not None:
        for y in _year_candidates(_text(header)):
            scored.append((y, 20))

    year = _pick_best_year_scored(scored)
    return title, authors, year

# -----------------------------
# Journal / volume / issue helpers (TEI + PDF fallback)
# -----------------------------
def _clean_scope_value(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    # keep something like "55", "S1", "14", "10"
    m = re.search(r"\b([A-Za-z]?\d{1,4}[A-Za-z]?)\b", s)
    return m.group(1) if m else s.strip()

def _is_plausible_journal_name(s: str) -> bool:
    s = _norm_spaces(s)
    if not s:
        return False
    low = s.lower()
    if any(x in low for x in ["abstract", "keywords", "doi", "http", "www", "rights reserved"]):
        return False
    # too short / too long
    if len(s) < 4 or len(s) > 140:
        return False
    # usually at least 2 words
    if len(s.split()) < 2:
        return False
    # avoid obvious boilerplate
    if low.startswith("published by"):
        return False
    return True

def parse_journal_volume_issue_from_header_tei(tei_xml: str) -> Tuple[str, Optional[str], Optional[str]]:
    """Best-effort extraction from GROBID TEI header."""
    root = ET.fromstring(tei_xml)

    # --- Journal / container title ---
    best_title = ""
    best_score = -10**9
    for t in root.findall(
        ".//tei:teiHeader//tei:sourceDesc//tei:biblStruct//tei:monogr//tei:title",
        TEI_NS,
    ):
        cand = _text(t)
        if not _is_plausible_journal_name(cand):
            continue
        level = (t.get("level") or "").strip().lower()
        typ = (t.get("type") or "").strip().lower()

        score = 0
        if level == "j":
            score += 200
        if typ == "main":
            score += 30
        if "journal" in cand.lower() or "transactions" in cand.lower():
            score += 10
        # Prefer reasonably-sized container titles
        score += max(0, 20 - abs(len(cand.split()) - 5))
        if score > best_score:
            best_score = score
            best_title = cand

    journal = best_title.strip() if best_title else ""

    # --- Volume / issue (a.k.a. number) ---
    volume: Optional[str] = None
    number: Optional[str] = None

    scopes = root.findall(
        ".//tei:teiHeader//tei:sourceDesc//tei:biblStruct//tei:monogr//tei:imprint//tei:biblScope",
        TEI_NS,
    )
    if not scopes:
        scopes = root.findall(".//tei:teiHeader//tei:biblScope", TEI_NS)

    for bs in scopes:
        unit = (bs.get("unit") or bs.get("type") or "").strip().lower()
        val = _clean_scope_value(_text(bs))
        if not val:
            continue
        if unit in ("volume", "vol"):
            if volume is None:
                volume = val
        elif unit in ("issue", "number", "no"):
            if number is None:
                number = val

    return journal, volume, number

def fallback_journal_volume_issue_from_pdf_lines(lines: List[str]) -> Tuple[str, Optional[str], Optional[str]]:
    """Extract journal/volume/issue from first-page text lines (pypdf/PyPDF2)."""
    if not lines:
        return "", None, None

    # Only scan the top portion of the first page (before Abstract/Keywords).
    trimmed: List[str] = []
    for ln in lines[:40]:
        ln = _norm_spaces(ln)
        if not ln:
            continue
        if (
            _is_section_label_line(ln, "abstract")
            or _is_section_label_line(ln, "keywords")
            or _is_section_label_line(ln, "key words")
        ):
            break
        trimmed.append(ln)

    lines = trimmed if trimmed else lines[:60]

    best = ("", None, None, -10**9)  # (journal, vol, num, score)

    def consider(j: str, v: Optional[str], n: Optional[str], score: int):
        nonlocal best
        j = _norm_spaces(j)
        if j and not _is_plausible_journal_name(j):
            return
        if score > best[3]:
            best = (j, v, n, score)

    for i, ln in enumerate(lines):
        low = ln.lower()

        # 1) AIP-style citation line: "Citation: Physics of Fluids 30, 106108 (2018); ..."
        if "citation:" in low:
            s = ln.split(":", 1)[-1].strip()
            m = re.search(r"\b(\d{1,4})\b", s)
            if m:
                j = s[:m.start()].strip(" ,;")
                v = m.group(1)
                consider(j, v, None, 90)
            continue

        # 1b) MDPI-like header: "Aerospace 2021, 8, 193"  (treat as journal + volume; last number is article/page id, NOT issue)
        m = re.search(r"^(?P<j>[A-Za-z][A-Za-z0-9&\-\s]+?)\s+(?P<y>(?:19|20)\d{2})\s*,\s*(?P<v>\d{1,4})\s*,\s*\d+\b", ln)
        if m:
            consider(m.group("j"), m.group("v"), None, 82)
            continue

        # 2) Single-line journal+vol(+year): "Aerospace Science and Technology 14 (2010) 295-301"
        m = re.search(r"^(?P<j>.+?)\s+(?P<v>\d{1,4})\s*\(\s*(?:19|20)\d{2}\s*\)", ln)
        if m:
            consider(m.group("j"), m.group("v"), None, 80)
            continue

        # 3) "Journal ... Vol. 55, No. 4, ..."
        m = re.search(
            r"^(?P<j>.+?)\s+vol\.?\s*(?P<v>\d{1,4})\s*,?\s*(?:no\.?|number|issue)\s*(?P<n>\d{1,4})\b",
            ln,
            flags=re.IGNORECASE,
        )
        if m:
            consider(m.group("j"), m.group("v"), m.group("n"), 100)
            continue

        # 4) Line that starts with Vol/No but journal is on the previous line
        m = re.search(
            r"^vol\.?\s*(?P<v>\d{1,4})\s*,?\s*(?:no\.?|number|issue)\s*(?P<n>\d{1,4})\b",
            ln,
            flags=re.IGNORECASE,
        )
        if m:
            prev = ""
            for k in range(i - 1, max(-1, i - 6), -1):
                cand = lines[k].strip()
                if not cand:
                    continue
                if _looks_like_noise_line(cand):
                    continue
                if _is_section_label_line(cand, "abstract") or _is_section_label_line(cand, "keywords"):
                    continue
                prev = cand
                break
            consider(prev, m.group("v"), m.group("n"), 95)
            continue

        # 5) "Physics of Fluids 30, 106108 (2018)" (without "Citation:")
        m = re.search(r"^(?P<j>.+?)\s+(?P<v>\d{1,4})\s*,\s*\d+\s*\(\s*(?:19|20)\d{2}\s*\)", ln)
        if m:
            consider(m.group("j"), m.group("v"), None, 85)
            continue

    return best[0], best[1], best[2]


# -----------------------------
# Pipeline
# -----------------------------
def parse_pdf(pdf_path: str, grobid_base: str) -> Dict[str, Any]:
    rec: Dict[str, Any] = {
        "file_path": pdf_path,
        "file_name": os.path.basename(pdf_path),
        "title": "",
        "authors": [],
        "year": None,
        "journal": "",
        "volume": None,
        "number": None,
    }

    try:
        header_tei = grobid_process_header(grobid_base, pdf_path)
        title, authors, year = parse_title_authors_year_from_header_tei(header_tei)

        rec["title"] = title
        rec["authors"] = authors
        rec["year"] = year

        # Journal / volume / issue: prefer PDF header parsing (GROBID often misses these)
        rec["journal"] = ""
        rec["volume"] = None
        rec["number"] = None

        # If GROBID didn't catch year (common for running headers), fallback to PDF text
        if rec["year"] is None:
            fy = fallback_year_from_pdf_first_pages(pdf_path, pages=2)
            if fy is not None:
                rec["year"] = fy
        # --- Title fallback (ONLY if GROBID title is missing / clearly bad) ---
        lines1 = pdf_first_pages_text_lines(pdf_path, pages=1)
        pdf_title = extract_title_from_pdf_lines(lines1)
        if pdf_title and (not _is_good_title(rec["title"])) and _is_good_title(pdf_title):
            rec["title"] = pdf_title



        # --- Journal / volume / issue extraction from PDF headers (regex) ---
        # Rule:
        #   - AIAA paper  -> use first page header
        #   - non-AIAA    -> use second page header (fallback to first if second fails)
        is_aiaa = is_aiaa_paper_pdf(pdf_path)
        header_page = 0 if is_aiaa else 1

        header_lines = extract_header_lines_from_pdf(
            pdf_path,
            header_page,
            top_frac=0.22 if is_aiaa else 0.18,
        )
        fj, fvol, fnum = fallback_journal_volume_issue_from_pdf_lines(header_lines)

        # If non-AIAA and page-2 header didn't work, try page-1 header as a last resort
        if (not is_aiaa) and (not fj) and (fvol is None) and (fnum is None):
            header_lines0 = extract_header_lines_from_pdf(pdf_path, 0, top_frac=0.18)
            fj2, fvol2, fnum2 = fallback_journal_volume_issue_from_pdf_lines(header_lines0)
            if fj2 or fvol2 or fnum2:
                fj, fvol, fnum = fj2, fvol2, fnum2

        # Fill fields (leave empty/null if not found)
        rec["journal"] = fj or ""
        rec["volume"] = fvol
        rec["number"] = fnum

        # Final fallback: try GROBID TEI only if still missing (does not affect title/authors)
        if (not rec.get("journal")) or (rec.get("volume") is None and rec.get("number") is None):
            try:
                tj, tvol, tnum = parse_journal_volume_issue_from_header_tei(header_tei)
                if (not rec.get("journal")) and tj:
                    rec["journal"] = tj
                if (rec.get("volume") is None) and tvol:
                    rec["volume"] = tvol
                if (rec.get("number") is None) and tnum:
                    rec["number"] = tnum
            except Exception:
                pass


        # --- Authors fallback: prefer explicit "Author:" block; remove "Peer reviewed by:" ---
        pdf_authors = fallback_authors_from_pdf(pdf_path)
        if pdf_authors:
            rec["authors"] = pdf_authors

    except Exception as e:
        rec["error"] = f"{type(e).__name__}: {e}"

    return rec

def process_root(root: str, grobid_base: str) -> Dict[str, Any]:
    pdfs = find_pdfs(root)
    records = [parse_pdf(p, grobid_base) for p in pdfs]
    return {
        "root_path": root,
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "pdf_count": len(pdfs),
        "pdfs": records,
    }

def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="input.json")
    ap.add_argument("--grobid", default=DEFAULT_GROBID_BASE)
    args = ap.parse_args()

    paths = load_input_paths(args.input)
    if not paths:
        print("No paths found in input.json")
        return 2

    if not grobid_is_alive(args.grobid):
        print(f"[ERROR] GROBID is not reachable at {args.grobid} (check /api/isalive).")
        return 3

    for root in paths:
        if not os.path.isdir(root):
            print(f"[WARN] Not a directory: {root}")
            continue
        data = process_root(root, args.grobid)
        out_path = os.path.join(root, "parsed_pdfs.json")
        write_json(out_path, data)
        print(f"[OK] Wrote: {out_path} (pdfs={data['pdf_count']})")

    return 0

if __name__ == "__main__":
    raise SystemExit(main())

