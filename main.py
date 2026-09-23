"""
main.py
Aplikasi FastAPI CRUD dengan integrasi SQLite dan endpoint pengujian
khusus untuk monitoring kinerja menggunakan JENNIFER APM.
"""

import time
from typing import List, Optional
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import crud
import models
import schemas
from database import engine, get_db

# Buat tabel SQLite jika belum ada di file app.db
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FastAPI CRUD & JENNIFER APM Test Suite",
    description=(
        "Aplikasi REST API CRUD Items menggunakan FastAPI dan SQLite, "
        "dilengkapi endpoint uji performa Slow Transaction dan Exception Alert "
        "untuk monitoring JENNIFER APM."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Middleware CORS agar dapat diakses dari frontend web client jika diperlukan
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Root & Health Check Endpoints
# ============================================================================
@app.get("/", tags=["General"])
def root_info():
    """Informasi status aplikasi dan panduan endpoint."""
    return {
        "app": "FastAPI CRUD & JENNIFER APM Test Suite",
        "status": "online",
        "database": "SQLite (app.db)",
        "docs": "/docs",
        "apm_testing_endpoints": {
            "slow_transaction": "/api/test/slow?delay=3.0&queries=5",
            "unhandled_exception": "/api/test/error?error_type=unhandled",
            "http_500_error": "/api/test/error?error_type=http_500",
        },
    }


@app.get("/health", tags=["General"])
def health_check(db: Session = Depends(get_db)):
    """Memverifikasi koneksi database dan status server."""
    try:
        # Simple test query
        db.execute(models.func.now())
        db_status = "connected"
    except Exception as exc:
        db_status = f"error: {str(exc)}"

    return {
        "status": "healthy",
        "database": db_status,
        "timestamp": time.time(),
    }


# ============================================================================
# CRUD Endpoints: Items
# ============================================================================
@app.post(
    "/items",
    response_model=schemas.ItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Items CRUD"],
    summary="Buat item baru",
)
def create_item_endpoint(item: schemas.ItemCreate, db: Session = Depends(get_db)):
    """Menambahkan entitas item baru ke database."""
    return crud.create_item(db=db, item=item)


@app.get(
    "/items",
    response_model=List[schemas.ItemResponse],
    tags=["Items CRUD"],
    summary="Ambil seluruh item (dengan pagination)",
)
def read_items_endpoint(
    skip: int = Query(0, ge=0, description="Offset data"),
    limit: int = Query(100, ge=1, le=500, description="Jumlah maksimal data"),
    db: Session = Depends(get_db),
):
    """Mengambil daftar item yang tersimpan di database."""
    return crud.get_items(db=db, skip=skip, limit=limit)


@app.get(
    "/items/{item_id}",
    response_model=schemas.ItemResponse,
    tags=["Items CRUD"],
    summary="Ambil item berdasarkan ID",
)
def read_item_endpoint(item_id: int, db: Session = Depends(get_db)):
    """Mencari item spesifik berdasarkan ID."""
    db_item = crud.get_item(db=db, item_id=item_id)
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item dengan ID {item_id} tidak ditemukan",
        )
    return db_item


@app.put(
    "/items/{item_id}",
    response_model=schemas.ItemResponse,
    tags=["Items CRUD"],
    summary="Perbarui data item",
)
def update_item_endpoint(
    item_id: int,
    item_update: schemas.ItemUpdate,
    db: Session = Depends(get_db),
):
    """Memperbarui kolom item yang ada di database."""
    updated = crud.update_item(db=db, item_id=item_id, item_update=item_update)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item dengan ID {item_id} tidak ditemukan untuk diperbarui",
        )
    return updated


@app.delete(
    "/items/{item_id}",
    response_model=schemas.MessageResponse,
    tags=["Items CRUD"],
    summary="Hapus item berdasarkan ID",
)
def delete_item_endpoint(item_id: int, db: Session = Depends(get_db)):
    """Menghapus item dari database."""
    success = crud.delete_item(db=db, item_id=item_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item dengan ID {item_id} tidak ditemukan untuk dihapus",
        )
    return {"detail": f"Item dengan ID {item_id} berhasil dihapus"}


# ============================================================================
# Khusus APM Testing: Slow Transaction & Error Simulation
# ============================================================================
@app.get(
    "/api/test/slow",
    response_model=schemas.SlowTestResponse,
    tags=["APM Testing"],
    summary="Simulasi Transaksi Lambat (Slow Transaction untuk X-View JENNIFER)",
)
def simulate_slow_transaction(
    delay: float = Query(
        3.0,
        ge=0.5,
        le=30.0,
        description="Durasi time.sleep dalam detik (default: 3 detik sesuai kriteria slow)",
    ),
    queries: int = Query(
        5,
        ge=1,
        le=100,
        description="Jumlah query database berulang untuk memicu DB profiling trace",
    ),
    db: Session = Depends(get_db),
):
    """Endpoint ini sengaja mengeksekusi sleep dan query database berulang.

    Tujuan APM:
    1. Memperlambat response time (> 3000 ms) agar muncul sebagai dot di atas
       garis threshold Slow Transaction pada grafik JENNIFER X-View.
    2. Menghasilkan multiple SQL Profiling Traces di JENNIFER APM Profile tab
       sehingga administrator dapat menginspeksi rincian SQL & waktu eksekusi.
    """
    start_time = time.perf_counter()

    # 1. Eksekusi query berulang untuk menghasilkan jejak SQL di JENNIFER APM Profiler
    executed_queries_count = 0
    for i in range(queries):
        # Query agregasi count dan query fetch items
        _ = db.query(models.Item).count()
        _ = db.query(models.Item).offset(0).limit(5).all()
        executed_queries_count += 2

    # 2. Eksekusi sleep() untuk mensimulasikan latensi backend / external service delay
    time.sleep(delay)

    elapsed_time = round(time.perf_counter() - start_time, 4)

    return schemas.SlowTestResponse(
        status="completed",
        message="Simulasi slow transaction berhasil dijalankan.",
        delay_seconds=delay,
        database_queries_executed=executed_queries_count,
        elapsed_time_seconds=elapsed_time,
        apm_notes={
            "expected_xview_location": f"Y-Axis latency sekitar {elapsed_time}s (di atas slow threshold 3s)",
            "sql_traces_count": executed_queries_count,
            "instruction": "Buka Dashboard JENNIFER APM -> Menu X-View -> Drag / klik titik yang muncul untuk melihat Method & SQL Trace.",
        },
    )


@app.get(
    "/api/test/error",
    tags=["APM Testing"],
    summary="Simulasi Error & Exception Alert untuk JENNIFER APM",
)
def simulate_error_endpoint(
    error_type: str = Query(
        "unhandled",
        description="Tipe error yang disimulasikan: 'unhandled' (ValueError unhandled) atau 'http_500' (HTTPException 500)",
        examples=["unhandled", "http_500"],
    )
):
    """Endpoint ini sengaja melempar exception untuk memverifikasi pendeteksian error oleh JENNIFER APM.

    Tipe error:
    - 'unhandled': Melempar unhandled ValueError yang menyebabkan crash pada level request handler.
                   Pada JENNIFER X-View, transaksi ini ditandai sebagai titik merah (Exception / Error dot).
    - 'http_500': Melempar HTTPException dengan status code 500 internal server error.
    """
    if error_type == "http_500":
        # Simulasi HTTP 500 yang di-handle oleh FastAPI
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="[JENNIFER APM TEST] Sengaja melempar HTTPException(500) untuk pengujian alert error HTTP.",
        )
    elif error_type == "unhandled":
        # Simulasi Unhandled Exception murni untuk menguji panel exception alert di JENNIFER
        raise ValueError(
            "[JENNIFER APM TEST] Sengaja melempar Unhandled ValueError! "
            "Exception ini akan ditangkap oleh agen JENNIFER dan dicatat pada panel Exception Alert."
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipe error tidak dikenal: '{error_type}'. Gunakan 'unhandled' atau 'http_500'.",
        )
