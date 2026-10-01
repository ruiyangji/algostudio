"""
AlgoStudio Question Storage & Indexing Engine
Provides CRUD persistence, schema validation, catalog re-indexing, and ZIP bulk import/export.
"""

import os
import re
import io
import json
import uuid
import shutil
import zipfile

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")
SAMPLE_DATA_DIR = os.path.join(BASE_DIR, "sample_data")


def ensure_storage_dirs():
    """Ensure data/ and data/questions/ exist."""
    q_dir = os.path.join(DATA_DIR, "questions")
    os.makedirs(q_dir, exist_ok=True)

    index_path = os.path.join(DATA_DIR, "index.json")
    if not os.path.exists(index_path):
        sample_index = os.path.join(SAMPLE_DATA_DIR, "index.json")
        if os.path.exists(sample_index):
            shutil.copy(sample_index, index_path)
            sample_q_dir = os.path.join(SAMPLE_DATA_DIR, "questions")
            if os.path.exists(sample_q_dir):
                for f in os.listdir(sample_q_dir):
                    if f.endswith(".json"):
                        shutil.copy(os.path.join(sample_q_dir, f), os.path.join(q_dir, f))
        else:
            with open(index_path, "w", encoding="utf-8") as f:
                json.dump([], f)


def generate_slug(title: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9\s-]", "", title.lower())
    return re.sub(r"[\s-]+", "-", slug).strip("-")


def get_all_questions() -> list:
    ensure_storage_dirs()
    index_path = os.path.join(DATA_DIR, "index.json")
    try:
        with open(index_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def get_question(qid: str) -> dict:
    ensure_storage_dirs()
    q_path = os.path.join(DATA_DIR, "questions", f"{qid}.json")
    if not os.path.exists(q_path):
        sample_q_path = os.path.join(SAMPLE_DATA_DIR, "questions", f"{qid}.json")
        if os.path.exists(sample_q_path):
            q_path = sample_q_path
        else:
            return None

    try:
        with open(q_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def validate_question(data: dict) -> list:
    """Validate question document schema."""
    errors = []
    if not data.get("title", "").strip():
        errors.append("Title cannot be empty")

    if not isinstance(data.get("difficulty", 2), int) or data.get("difficulty") not in (1, 2, 3):
        errors.append("Difficulty must be 1 (Easy), 2 (Medium), or 3 (Hard)")

    if "testCases" in data and not isinstance(data["testCases"], list):
        errors.append("TestCases must be an array")

    return errors


def build_index_summary(q: dict) -> dict:
    diff_labels = {1: "Easy", 2: "Medium", 3: "Hard"}
    diff = q.get("difficulty", 2)

    comp_dict = q.get("company")
    company_name = "General"
    if isinstance(comp_dict, dict):
        active = [k for k, v in comp_dict.items() if v]
        if active:
            company_name = active[0].title()
        elif comp_dict:
            company_name = list(comp_dict.keys())[0].title()
    elif isinstance(comp_dict, str):
        company_name = comp_dict
    elif q.get("companyName"):
        company_name = q.get("companyName")

    editorial = q.get("editorial") or q.get("explanation") or ""
    has_editorial = bool(editorial.strip())
    has_solution = bool(q.get("language", {}).get("python", {}).get("solutionCode"))

    return {
        "id": q["id"],
        "title": q.get("title", "Untitled"),
        "slug": q.get("slug", generate_slug(q.get("title", ""))),
        "difficulty": diff,
        "difficultyLabel": diff_labels.get(diff, "Medium"),
        "type": q.get("type", "SINGLE_STEP"),
        "company": company_name,
        "companyFrequency": "High",
        "tags": q.get("tags") or q.get("algorithmTags") or ["Algorithms"],
        "acceptance": q.get("stats", {}).get("acceptance", "50.0%"),
        "hasEditorial": has_editorial,
        "hasSolution": has_solution,
        "testCaseCount": len(q.get("testCases") or [])
    }


def reindex_all():
    """Scan data/questions/*.json and rebuild data/index.json (deduplicating by question ID)."""
    ensure_storage_dirs()
    q_dir = os.path.join(DATA_DIR, "questions")
    index = []
    seen_ids = set()

    for fname in sorted(os.listdir(q_dir)):
        if not fname.endswith(".json"):
            continue
        filepath = os.path.join(q_dir, fname)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                q = json.load(f)
                qid = q.get("id")
                if not qid or qid in seen_ids:
                    continue
                seen_ids.add(qid)
                index.append(build_index_summary(q))
        except Exception:
            continue

    index_path = os.path.join(DATA_DIR, "index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

    return index


def save_question(q: dict, reindex: bool = True) -> tuple[dict, list]:
    """Create a new question."""
    ensure_storage_dirs()
    errors = validate_question(q)
    if errors:
        return None, errors

    qid = q.get("id") or f"custom_{uuid.uuid4().hex[:12]}"
    q["id"] = qid
    if not q.get("slug"):
        q["slug"] = generate_slug(q.get("title", "custom-question"))

    diff_labels = {1: "Easy", 2: "Medium", 3: "Hard"}
    q["difficultyLabel"] = diff_labels.get(q.get("difficulty", 2), "Medium")

    filepath = os.path.join(DATA_DIR, "questions", f"{qid}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(q, f, indent=2, ensure_ascii=False)

    if reindex:
        reindex_all()
    return q, []


def update_question(qid: str, q: dict) -> tuple[dict, list]:
    """Update an existing question."""
    ensure_storage_dirs()
    errors = validate_question(q)
    if errors:
        return None, errors

    q["id"] = qid
    if not q.get("slug"):
        q["slug"] = generate_slug(q.get("title", "custom-question"))

    diff_labels = {1: "Easy", 2: "Medium", 3: "Hard"}
    q["difficultyLabel"] = diff_labels.get(q.get("difficulty", 2), "Medium")

    filepath = os.path.join(DATA_DIR, "questions", f"{qid}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(q, f, indent=2, ensure_ascii=False)

    reindex_all()
    return q, []


def delete_question(qid: str) -> bool:
    """Delete a question by id."""
    ensure_storage_dirs()
    filepath = os.path.join(DATA_DIR, "questions", f"{qid}.json")
    if os.path.exists(filepath):
        os.remove(filepath)
        reindex_all()
        return True
    return False


def import_zip_archive(zip_bytes: bytes) -> tuple[int, list, list]:
    """
    Import questions in bulk from a zip file containing JSON question files.
    Supports flat zip, nested questions/ directory, or custom structured zip files.
    Returns (imported_count, imported_titles, errors).
    """
    ensure_storage_dirs()
    imported_titles = []
    errors = []

    try:
        buf = io.BytesIO(zip_bytes)
        with zipfile.ZipFile(buf, "r") as zf:
            for fname in zf.namelist():
                base = os.path.basename(fname)
                # Ignore directory entries, hidden files, or non-JSON
                if not base or base.startswith(".") or not base.endswith(".json"):
                    continue
                if "__MACOSX" in fname:
                    continue
                # Skip index manifests if present
                if base in ("index.json", "bundle.js", "package.json"):
                    continue

                try:
                    content = zf.read(fname).decode("utf-8")
                    data = json.loads(content)
                except Exception as e:
                    errors.append(f"Failed to parse {base}: {e}")
                    continue

                if not isinstance(data, dict):
                    continue

                # Validate and save question
                title = data.get("title")
                if not title:
                    continue

                saved, val_errs = save_question(data, reindex=False)
                if saved:
                    imported_titles.append(saved["title"])
                elif val_errs:
                    errors.append(f"{title}: {', '.join(val_errs)}")

        reindex_all()
        return len(imported_titles), imported_titles, errors
    except Exception as e:
        return 0, [], [f"Invalid ZIP archive: {e}"]


def export_zip_archive() -> bytes:
    """
    Package all current questions into a downloadable ZIP archive.
    """
    ensure_storage_dirs()
    q_dir = os.path.join(DATA_DIR, "questions")
    buf = io.BytesIO()

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Include all questions
        if os.path.exists(q_dir):
            for fname in sorted(os.listdir(q_dir)):
                if fname.endswith(".json"):
                    fpath = os.path.join(q_dir, fname)
                    zf.write(fpath, arcname=f"questions/{fname}")

        # Include index.json
        index_path = os.path.join(DATA_DIR, "index.json")
        if os.path.exists(index_path):
            zf.write(index_path, arcname="index.json")

    buf.seek(0)
    return buf.getvalue()

