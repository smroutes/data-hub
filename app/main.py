import glob
import os

import duckdb
from fastapi import FastAPI, HTTPException, Query

DATA_DIR = os.environ.get("DATA_DIR", "/data")
CACHE_DIR = os.environ.get("CACHE_DIR", "/app/cache")
PARQUET_PATH = os.path.join(CACHE_DIR, "report.parquet")

R2_BUCKET = os.environ.get("R2_BUCKET")
R2_OBJECT_KEY = os.environ.get("R2_OBJECT_KEY")
R2_ENDPOINT = os.environ.get("R2_ENDPOINT")  # https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")

SEARCH_COLUMNS = ["ApplicationNo.", "Mobile", "Applicant Name"]

app = FastAPI(title="Annapurna Scheme Search")


def find_local_csv() -> str:
    candidates = sorted(glob.glob(os.path.join(DATA_DIR, "*report*.csv"))) or sorted(
        glob.glob(os.path.join(DATA_DIR, "*.csv"))
    )
    if not candidates:
        raise FileNotFoundError(f"No CSV file found in {DATA_DIR}")
    return candidates[0]


def configure_r2(con: duckdb.DuckDBPyConnection) -> None:
    if not R2_ENDPOINT or not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY:
        raise RuntimeError(
            "R2_BUCKET/R2_OBJECT_KEY set but R2_ENDPOINT, R2_ACCESS_KEY_ID, "
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


def write_parquet(con: duckdb.DuckDBPyConnection, csv_source: str) -> None:
    source_escaped = csv_source.replace("'", "''")
    parquet_escaped = PARQUET_PATH.replace("'", "''")
    con.execute(
        f"COPY (SELECT * FROM read_csv_auto('{source_escaped}', ALL_VARCHAR=TRUE)) "
        f"TO '{parquet_escaped}' (FORMAT PARQUET)"
    )


def ensure_parquet() -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)

    if R2_BUCKET and R2_OBJECT_KEY:
        con = duckdb.connect()
        try:
            configure_r2(con)
            write_parquet(con, f"s3://{R2_BUCKET}/{R2_OBJECT_KEY}")
        finally:
            con.close()
        return PARQUET_PATH

    csv_path = find_local_csv()
    if not os.path.exists(PARQUET_PATH) or os.path.getmtime(csv_path) > os.path.getmtime(PARQUET_PATH):
        con = duckdb.connect()
        try:
            write_parquet(con, csv_path)
        finally:
            con.close()
    return PARQUET_PATH


@app.on_event("startup")
def startup() -> None:
    ensure_parquet()


@app.get("/api/search")
def search(q: str = Query(..., min_length=1), limit: int = 50):
    term = f"%{q.strip()}%"
    where_clause = " OR ".join(f'"{col}" ILIKE ?' for col in SEARCH_COLUMNS)
    con = duckdb.connect()
    try:
        rows = con.execute(
            f'SELECT * FROM read_parquet(?) WHERE {where_clause} LIMIT ?',
            [PARQUET_PATH, *([term] * len(SEARCH_COLUMNS)), limit],
        ).fetchdf()
    finally:
        con.close()
    return rows.to_dict(orient="records")


@app.get("/api/health")
def health():
    if not os.path.exists(PARQUET_PATH):
        raise HTTPException(status_code=503, detail="data not loaded")
    return {"status": "ok"}
