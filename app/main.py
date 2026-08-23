import glob
import os

import duckdb
from fastapi import FastAPI, HTTPException, Request
from openai import BadRequestError, OpenAI
from pydantic import BaseModel

DATA_DIR = os.environ.get("DATA_DIR", "/data")
CACHE_DIR = os.environ.get("CACHE_DIR", "/app/cache")

R2_BUCKET = os.environ.get("R2_BUCKET")
R2_ENDPOINT = os.environ.get("R2_ENDPOINT")  # https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")

# Both DeepSeek and Groq expose OpenAI-compatible APIs, so the official
# openai package works unmodified against either -- just point base_url at
# the provider and use one of its model names instead of OpenAI's.
#
# Two separate providers on purpose: DeepSeek writes the actual application
# (quality matters, fires once per Generate click); Groq's free tier drives
# prompt auto-suggest (fires much more often while typing, speed/cost
# matters more than quality there).
#
# `or` (not dict.get's default) because docker-compose sets these to an
# empty string, not unset, when left blank in .env -- a plain default
# would never kick in against "".
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY") or None
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL") or "https://api.deepseek.com"
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL") or "deepseek-chat"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY") or None
GROQ_BASE_URL = os.environ.get("GROQ_BASE_URL") or "https://api.groq.com/openai/v1"
# gpt-oss-20b is a reasoning model -- see suggest_prompt() below for why
# that needs reasoning_effort="low" (with a fallback for plain chat models
# configured here instead, which don't support that param at all).
GROQ_MODEL = os.environ.get("GROQ_MODEL") or "openai/gpt-oss-20b"

# Constructed lazily (not at import time) so a missing key only breaks the
# endpoints that need it, not the whole app -- search/health keep working.
_client_cache: dict[str, OpenAI] = {}


def get_ai_client(provider: str) -> OpenAI:
    api_key, base_url, env_name = {
        "deepseek": (DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, "DEEPSEEK_API_KEY"),
        "groq": (GROQ_API_KEY, GROQ_BASE_URL, "GROQ_API_KEY"),
    }[provider]
    if not api_key:
        raise HTTPException(status_code=503, detail=f"AI writer is not configured ({env_name} missing)")
    if provider not in _client_cache:
        _client_cache[provider] = OpenAI(api_key=api_key, base_url=base_url)
    return _client_cache[provider]

# Add an entry here for each searchable dataset. r2_env names the env var
# holding that dataset's object key in R2_BUCKET; local_glob is the fallback
# CSV lookup under DATA_DIR for local dev without R2 configured.
#
# Each field is a query param the frontend can send:
#   match "any"      -> OR's the value across all listed columns (free-text box)
#   match "exact"     -> column = value (e.g. a dropdown)
#   match "contains"  -> column ILIKE %value% (a plain text field)
# Fields present in the request are ANDed together; at least one is required.
DATASETS = {
    "annapurna": {
        "fields": [
            {
                "param": "q",
                "columns": ["ApplicationNo.", "Mobile", "Applicant Name"],
                "match": "any",
            },
        ],
        "local_glob": "*annapurna_report*.csv",
        "r2_env": "R2_OBJECT_KEY_ANNAPURNA",
    },
    "booth-president": {
        "fields": [
            {"param": "gp", "columns": ["Location"], "match": "exact"},
            {"param": "booth_no", "columns": ["Booth No"], "match": "contains"},
        ],
        "local_glob": "*Booth President*.csv",
        "r2_env": "R2_OBJECT_KEY_BOOTH_PRESIDENT",
    },
}

app = FastAPI(title="DataHub Search")


def parquet_path(dataset_id: str) -> str:
    return os.path.join(CACHE_DIR, f"{dataset_id}.parquet")


def find_local_csv(pattern: str) -> str:
    candidates = sorted(glob.glob(os.path.join(DATA_DIR, pattern)))
    if not candidates:
        raise FileNotFoundError(f"No CSV file matching {pattern} found in {DATA_DIR}")
    return candidates[0]


def configure_r2(con: duckdb.DuckDBPyConnection) -> None:
    if not R2_ENDPOINT or not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY:
        raise RuntimeError(
            "R2_BUCKET set but R2_ENDPOINT, R2_ACCESS_KEY_ID, "
            "or R2_SECRET_ACCESS_KEY is missing"
        )
    use_ssl = not R2_ENDPOINT.startswith("http://")
    endpoint_host = R2_ENDPOINT.removeprefix("https://").removeprefix("http://")
    con.execute("INSTALL httpfs")
    con.execute("LOAD httpfs")
    con.execute(f"SET s3_endpoint='{endpoint_host}'")
    con.execute("SET s3_url_style='path'")
    con.execute("SET s3_region='auto'")
    con.execute(f"SET s3_use_ssl={'true' if use_ssl else 'false'}")
    con.execute(f"SET s3_access_key_id='{R2_ACCESS_KEY_ID}'")
    con.execute(f"SET s3_secret_access_key='{R2_SECRET_ACCESS_KEY}'")


def write_parquet(con: duckdb.DuckDBPyConnection, csv_source: str, dataset_id: str) -> None:
    source_escaped = csv_source.replace("'", "''")
    parquet_escaped = parquet_path(dataset_id).replace("'", "''")
    con.execute(
        f"COPY (SELECT * FROM read_csv_auto('{source_escaped}', ALL_VARCHAR=TRUE)) "
        f"TO '{parquet_escaped}' (FORMAT PARQUET)"
    )


def ensure_parquet(dataset_id: str) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    config = DATASETS[dataset_id]
    r2_object_key = os.environ.get(config["r2_env"])

    if R2_BUCKET and r2_object_key:
        con = duckdb.connect()
        try:
            configure_r2(con)
            write_parquet(con, f"s3://{R2_BUCKET}/{r2_object_key}", dataset_id)
        finally:
            con.close()
        return parquet_path(dataset_id)

    csv_path = find_local_csv(config["local_glob"])
    out_path = parquet_path(dataset_id)
    if not os.path.exists(out_path) or os.path.getmtime(csv_path) > os.path.getmtime(out_path):
        con = duckdb.connect()
        try:
            write_parquet(con, csv_path, dataset_id)
        finally:
            con.close()
    return out_path


@app.on_event("startup")
def startup() -> None:
    for dataset_id in DATASETS:
        try:
            ensure_parquet(dataset_id)
        except FileNotFoundError as e:
            print(f"Skipping dataset '{dataset_id}': {e}")


@app.get("/api/search")
def search(request: Request, dataset: str = "annapurna", limit: int = 50):
    if dataset not in DATASETS:
        raise HTTPException(status_code=400, detail=f"Unknown dataset '{dataset}'")
    path = parquet_path(dataset)
    if not os.path.exists(path):
        raise HTTPException(status_code=503, detail=f"Dataset '{dataset}' not loaded")

    clauses = []
    params: list[str] = []
    for field in DATASETS[dataset]["fields"]:
        value = request.query_params.get(field["param"], "").strip()
        if not value:
            continue
        is_exact = field["match"] == "exact"
        column_clauses = []
        for col in field["columns"]:
            column_clauses.append(f'"{col}" = ?' if is_exact else f'"{col}" ILIKE ?')
            params.append(value if is_exact else f"%{value}%")
        clauses.append("(" + " OR ".join(column_clauses) + ")")

    if not clauses:
        raise HTTPException(status_code=400, detail="At least one search field is required")

    where_clause = " AND ".join(clauses)
    con = duckdb.connect()
    try:
        rows = con.execute(
            f"SELECT * FROM read_parquet(?) WHERE {where_clause} LIMIT ?",
            [path, *params, limit],
        ).fetchdf()
    finally:
        con.close()
    return rows.to_dict(orient="records")


@app.get("/api/health")
def health():
    missing = [d for d in DATASETS if not os.path.exists(parquet_path(d))]
    if missing:
        raise HTTPException(status_code=503, detail=f"datasets not loaded: {missing}")
    return {"status": "ok"}


# Language codes match the frontend's AI Application Writer page exactly
# (bn/en/hi) -- kept as a small closed set rather than a free-text field so
# a prompt-injection attempt in the user's own text can't also smuggle in
# an instruction to answer in some other language.
LANGUAGE_NAMES = {"bn": "Bengali", "en": "English", "hi": "Hindi"}


class GenerateApplicationRequest(BaseModel):
    prompt: str
    language: str = "bn"
    category: str | None = None


@app.post("/api/generate-application")
def generate_application(body: GenerateApplicationRequest):
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")
    language_name = LANGUAGE_NAMES.get(body.language, LANGUAGE_NAMES["bn"])

    system_prompt = (
        "You write formal, ready-to-submit government application letters for "
        "Indian citizens applying to local municipal/government offices. "
        f"Write entirely in {language_name}. Use a respectful, formal tone with a "
        "clear subject line, salutation, body, and closing. Where a specific "
        "detail (name, address, date, etc.) is not given in the request, leave "
        "a bracketed placeholder like [Your Name] instead of inventing one. "
        "Output only the letter itself -- no commentary before or after it."
    )
    user_prompt = prompt
    if body.category:
        user_prompt = f"Application type: {body.category}\n\n{prompt}"

    client = get_ai_client("deepseek")
    try:
        completion = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")

    text = (completion.choices[0].message.content or "").strip()
    if not text:
        raise HTTPException(status_code=502, detail="AI generation returned no content")
    return {"application": text}


class SuggestPromptRequest(BaseModel):
    text: str
    language: str = "bn"
    category: str | None = None


@app.post("/api/suggest-prompt")
def suggest_prompt(body: SuggestPromptRequest):
    text = body.text
    # Debounced-while-typing from the frontend -- too little to work with
    # yet, and not worth a Groq call for.
    if len(text.strip()) < 3:
        return {"suggestion": ""}
    language_name = LANGUAGE_NAMES.get(body.language, LANGUAGE_NAMES["bn"])

    system_prompt = (
        "You are an inline autocomplete engine for a textarea where a user "
        "describes a government application letter they want written. Given "
        "the user's text so far (which may end mid-word or mid-sentence), "
        f"suggest ONLY the continuation text to append -- in {language_name} -- "
        "so that concatenating [text so far] + [your output] reads as a "
        "natural, more complete request (e.g. adding what details to "
        "include, like name/address/date/reason). Do not repeat any of the "
        "text so far. Keep it short: a few words to one short sentence. "
        "Output only the continuation, no quotes, no commentary. If the "
        "text is already a complete, detailed request, output nothing."
    )
    user_prompt = text
    if body.category:
        user_prompt = f"Application type: {body.category}\n\nText so far: {text}"

    client = get_ai_client("groq")
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    try:
        # Most of Groq's current free models (including gpt-oss) are
        # reasoning models -- message.content and message.reasoning are
        # properly separate fields, but reasoning tokens still count
        # against max_tokens, so a low-latency endpoint like this needs
        # reasoning kept short or it burns the whole budget "thinking" and
        # never gets to writing the actual continuation. Not every model
        # supports the param though (a 400 if it doesn't), so retry
        # without it for a plain chat model configured as GROQ_MODEL.
        try:
            completion = client.chat.completions.create(
                model=GROQ_MODEL, messages=messages, max_tokens=200, temperature=0.4, reasoning_effort="low"
            )
        except BadRequestError:
            completion = client.chat.completions.create(
                model=GROQ_MODEL, messages=messages, max_tokens=60, temperature=0.4
            )
    except Exception:
        # Auto-suggest is a nice-to-have that fires constantly while
        # typing -- fail quietly (empty suggestion) instead of surfacing
        # an error for something this non-critical.
        return {"suggestion": ""}

    # rstrip only, not a full strip -- a leading space from the model is
    # meaningful here (it's concatenated directly onto `text` client-side),
    # and blindly stripping it was exactly why "ami ekta" + "সরকারি..."
    # rendered as one run-on word with no gap. Only add/remove a boundary
    # space ourselves when the model's own choice would otherwise double up
    # or omit it entirely.
    suggestion = (completion.choices[0].message.content or "").rstrip()
    if suggestion:
        if text[-1:].isspace():
            suggestion = suggestion.lstrip()
        elif not suggestion[0].isspace() and suggestion[0] not in ".,!?;:)]}'\"।":
            suggestion = " " + suggestion
    return {"suggestion": suggestion}
