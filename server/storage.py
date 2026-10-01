"""
AlgoStudio Question Storage & Indexing Engine
Provides CRUD persistence, schema validation, and catalog re-indexing.
"""

import os
import re
import json
import uuid
import shutil

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
    companies = list((q.get("company") or {}).keys())
    company_name = companies[0] if companies else q.get("companyName", "General")

    editorial = q.get("editorial") or q.get("explanation") or ""
    has_editorial = bool(editorial.strip())
    has_solution = bool(q.get("language", {}).get("python", {}).get("solutionCode"))

    return {
        "id": q["id"],
        "title": q.get("title", "Untitled"),
        "slug": q.get("slug", generate_slug(q.get("title", ""))),
        "difficulty": diff,
        "difficultyLabel": diff_labels.get(diff, "Medium"),
        "company": company_name,
        "companyFrequency": "High",
        "tags": q.get("tags") or q.get("algorithmTags") or ["Algorithms"],
        "acceptance": q.get("stats", {}).get("acceptance", "50.0%"),
        "hasEditorial": has_editorial,
        "hasSolution": has_solution,
        "testCaseCount": len(q.get("testCases") or [])
    }


def reindex_all():
    """Scan data/questions/*.json and rebuild data/index.json."""
    ensure_storage_dirs()
    q_dir = os.path.join(DATA_DIR, "questions")
    index = []

    for fname in sorted(os.listdir(q_dir)):
        if not fname.endswith(".json"):
            continue
        filepath = os.path.join(q_dir, fname)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                q = json.load(f)
                index.append(build_index_summary(q))
        except Exception:
            continue

    index_path = os.path.join(DATA_DIR, "index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

    return index


def save_question(q: dict) -> tuple[dict, list]:
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
