import { ProjectFile } from '../types';

export const PROJECT_FILES: ProjectFile[] = [
  {
    name: 'main.py',
    path: 'main.py',
    language: 'python',
    badge: 'FastAPI Entry & APM',
    description: 'Inisialisasi FastAPI, routing CRUD Item, dan endpoint pengujian APM (/api/test/slow, /api/test/error)',
    content: `"""
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
    """
    Endpoint ini sengaja mengeksekusi sleep dan query database berulang.
    Tujuan APM:
    1. Memperlambat response time (> 3000 ms) agar muncul sebagai dot di atas
       garis threshold Slow Transaction pada grafik JENNIFER X-View.
    2. Menghasilkan multiple SQL Profiling Traces di JENNIFER APM Profile tab.
    """
    start_time = time.perf_counter()

    # 1. Eksekusi query berulang untuk menghasilkan jejak SQL di JENNIFER APM Profiler
    executed_queries_count = 0
    for i in range(queries):
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
        description="Tipe error: 'unhandled' (ValueError) atau 'http_500' (HTTPException 500)",
        examples=["unhandled", "http_500"],
    )
):
    """
    Endpoint ini sengaja melempar exception untuk memverifikasi pendeteksian error oleh JENNIFER APM.
    - 'unhandled': Melempar unhandled ValueError (titik merah pada X-View & alert panel).
    - 'http_500': Melempar HTTPException status 500 internal server error.
    """
    if error_type == "http_500":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="[JENNIFER APM TEST] Sengaja melempar HTTPException(500) untuk pengujian alert error HTTP.",
        )
    elif error_type == "unhandled":
        raise ValueError(
            "[JENNIFER APM TEST] Sengaja melempar Unhandled ValueError! "
            "Exception ini akan ditangkap oleh agen JENNIFER dan dicatat pada panel Exception Alert."
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipe error tidak dikenal: '{error_type}'. Gunakan 'unhandled' atau 'http_500'.",
        )`
  },
  {
    name: 'jennifer.conf',
    path: 'jennifer.conf',
    language: 'ini',
    badge: 'JENNIFER Config',
    description: 'Konfigurasi IP Data Server, port, domain_id, inst_id, threshold slow transaction, SQL profiling',
    content: `# ==============================================================================
# JENNIFER APM Python Agent Configuration File (jennifer.conf)
# ==============================================================================
# File ini digunakan oleh Agen JENNIFER APM Python untuk menghubungkan aplikasi
# FastAPI ke JENNIFER Data Server lokal atau remote.
#
# Cara eksekusi:
#   jennifer run -c ./jennifer.conf uvicorn main:app --host 0.0.0.0 --port 8000
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Konfigurasi Koneksi Data Server JENNIFER
# ------------------------------------------------------------------------------
# Alamat IP atau hostname dari JENNIFER Data Server yang aktif
server_address = 127.0.0.1

# Port komunikasi data server JENNIFER (default port data server biasanya 5000 / 5001)
server_port = 5000

# ------------------------------------------------------------------------------
# 2. Identitas Domain dan Instance Agen
# ------------------------------------------------------------------------------
# ID Domain JENNIFER (Domain ID yang telah didaftarkan di Data Server JENNIFER)
domain_id = 1001

# ID Instance Agen (harus bernilai angka integer unik untuk setiap instance aplikasi)
# Contoh: 10011 untuk instance pertama aplikasi FastAPI
inst_id = 10011

# Nama display / alias instance yang akan tampil di dashboard JENNIFER
inst_name = fastapi_sqlite_app

# ------------------------------------------------------------------------------
# 3. Konfigurasi Logging & Diagnostik Agen
# ------------------------------------------------------------------------------
# Direktori tempat file log agen JENNIFER disimpan
log_dir = ./logs/jennifer

# Level logging agen: DEBUG, INFO, WARN, ERROR (default: INFO)
log_level = INFO

# Rotasi ukuran maksimal log file dalam MB
log_rotation_size = 10

# ------------------------------------------------------------------------------
# 4. Konfigurasi Profiling Transaksi & X-View
# ------------------------------------------------------------------------------
# Ambang batas waktu respon untuk kategori Transaksi Lambat (dalam milidetik).
# Transaksi di atas nilai ini akan masuk kategori Slow Transaction di grafik X-View.
# Default di bawah diset 3000 ms (3 detik) agar sesuai dengan endpoint /api/test/slow.
slow_threshold = 3000

# Ambang batas Very Slow Transaction (dalam milidetik)
very_slow_threshold = 8000

# Mengaktifkan profiling SQL query yang dieksekusi oleh SQLAlchemy / SQLite
profile_sql = true

# Menyimpan parameter query SQL (bind variables) dalam profiling trace
profile_sql_param = true

# Mengaktifkan profiling internal method call stack
profile_method = true

# ------------------------------------------------------------------------------
# 5. Konfigurasi Exception & Error Alert
# ------------------------------------------------------------------------------
# Tangkap exception yang tidak tertangani (Unhandled Exception) dan kirim sebagai alert
trace_unhandled_exception = true

# Daftar status HTTP error yang dianggap sebagai exception di JENNIFER
# Status 500 akan memicu alert dan muncul sebagai titik merah (error dot) di X-View
error_http_status = 500,502,503,504`
  },
  {
    name: 'database.py',
    path: 'database.py',
    language: 'python',
    badge: 'SQLite Connection',
    description: 'Koneksi SQLite lokal app.db, create_engine, SessionLocal, dan dependency get_db',
    content: `"""
database.py
Konfigurasi database SQLite lokal (app.db) menggunakan SQLAlchemy.
Menyediakan engine, SessionLocal, declarative Base, dan dependency get_db.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# URL koneksi SQLite lokal ke file app.db pada root direktori
SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"

# connect_args={"check_same_thread": False} wajib untuk SQLite di FastAPI
# karena FastAPI memproses request dalam multiple worker threads.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,  # Ubah ke True jika ingin melihat raw SQL query di terminal
)

# Factory pembuat sesi database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class untuk definisi model ORM
Base = declarative_base()


def get_db():
    """
    Dependency generator untuk menyediakan session database per request.
    Memastikan session ditutup secara otomatis setelah request selesai
    sehingga tidak terjadi kebocoran koneksi (connection leak).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()`
  },
  {
    name: 'models.py',
    path: 'models.py',
    language: 'python',
    badge: 'SQLAlchemy Model',
    description: 'Model tabel Item (id, name, description, price, stock, created_at)',
    content: `"""
models.py
Definisi Model SQLAlchemy ORM untuk tabel 'items'.
"""

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from database import Base


class Item(Base):
    """
    Model representasi entitas Item di dalam database SQLite.
    """

    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    stock = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Item(id={self.id}, name='{self.name}', price={self.price}, stock={self.stock})>"`
  },
  {
    name: 'schemas.py',
    path: 'schemas.py',
    language: 'python',
    badge: 'Pydantic Schemas',
    description: 'Validasi data request & serialisasi response (ItemBase, ItemCreate, ItemUpdate, ItemResponse)',
    content: `"""
schemas.py
Skema Pydantic untuk validasi data request dan serialisasi response.
Mendukung kompatibilitas Pydantic V2 dan V1 (from_attributes / orm_mode).
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ItemBase(BaseModel):
    """Atribut dasar yang dimiliki oleh sebuah Item."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Nama item/barang",
        examples=["Laptop Gaming Asus ROG"],
    )
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Deskripsi lengkap mengenai item",
        examples=["Laptop spek tinggi dengan RAM 32GB dan RTX 4080"],
    )
    price: float = Field(
        ...,
        ge=0.0,
        description="Harga satuan item (tidak boleh negatif)",
        examples=[25000000.0],
    )
    stock: int = Field(
        ...,
        ge=0,
        description="Jumlah stok barang yang tersedia (minimal 0)",
        examples=[15],
    )


class ItemCreate(ItemBase):
    """Payload skema untuk pembuatan data baru (POST /items)."""
    pass


class ItemUpdate(BaseModel):
    """Payload skema untuk pembaruan data parsial atau penuh (PUT /items/{id})."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    price: Optional[float] = Field(None, ge=0.0)
    stock: Optional[int] = Field(None, ge=0)


class ItemResponse(ItemBase):
    """Skema response data item lengkap dengan metadata database (id dan created_at)."""
    id: int
    created_at: datetime

    # Konfigurasi Pydantic V2 (from_attributes)
    model_config = ConfigDict(from_attributes=True)


class SlowTestResponse(BaseModel):
    status: str
    message: str
    delay_seconds: float
    database_queries_executed: int
    elapsed_time_seconds: float
    apm_notes: Dict[str, Any]


class MessageResponse(BaseModel):
    detail: str`
  },
  {
    name: 'crud.py',
    path: 'crud.py',
    language: 'python',
    badge: 'SQLAlchemy CRUD',
    description: 'Operasi query database get_items, get_item, create_item, update_item, delete_item',
    content: `"""
crud.py
Operasi Query Database (Create, Read, Update, Delete) menggunakan SQLAlchemy Session.
"""

from typing import List, Optional
from sqlalchemy.orm import Session

import models
import schemas


def get_items(db: Session, skip: int = 0, limit: int = 100) -> List[models.Item]:
    """Mengambil daftar items dari database dengan pagination (offset/limit)."""
    return db.query(models.Item).offset(skip).limit(limit).all()


def get_item(db: Session, item_id: int) -> Optional[models.Item]:
    """Mencari satu item berdasarkan Primary Key (id)."""
    return db.query(models.Item).filter(models.Item.id == item_id).first()


def create_item(db: Session, item: schemas.ItemCreate) -> models.Item:
    """Menyimpan entitas item baru ke dalam database SQLite."""
    db_item = models.Item(
        name=item.name,
        description=item.description,
        price=item.price,
        stock=item.stock,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def update_item(
    db: Session, item_id: int, item_update: schemas.ItemUpdate
) -> Optional[models.Item]:
    """Memperbarui kolom item yang terisi pada payload update."""
    db_item = get_item(db, item_id)
    if not db_item:
        return None

    update_data = (
        item_update.model_dump(exclude_unset=True)
        if hasattr(item_update, "model_dump")
        else item_update.dict(exclude_unset=True)
    )
    for field, value in update_data.items():
        if value is not None:
            setattr(db_item, field, value)

    db.commit()
    db.refresh(db_item)
    return db_item


def delete_item(db: Session, item_id: int) -> bool:
    """Menghapus data item berdasarkan item_id."""
    db_item = get_item(db, item_id)
    if not db_item:
        return False

    db.delete(db_item)
    db.commit()
    return True`
  },
  {
    name: 'requirements.txt',
    path: 'requirements.txt',
    language: 'text',
    badge: 'Dependencies',
    description: 'Daftar dependensi Python: FastAPI, Uvicorn, SQLAlchemy, Pydantic',
    content: `fastapi>=0.110.0,<1.0.0
uvicorn[standard]>=0.28.0,<1.0.0
sqlalchemy>=2.0.0,<3.0.0
pydantic>=2.5.0,<3.0.0`
  },
  {
    name: 'load_tester.py',
    path: 'load_tester.py',
    language: 'python',
    badge: 'Traffic Generator',
    description: 'Skrip otomatisasi pengiriman transaksi kontinu (cepat, lambat, campur) untuk stress test JENNIFER APM',
    content: `"""
load_tester.py
Skrip generator transaksi otomatis (Traffic / Load Generator) untuk menguji
performa aplikasi FastAPI dan monitoring JENNIFER APM.

Dibuat menggunakan modul bawaan Python (urllib) sehingga tidak memerlukan
pustaka tambahan (zero-dependency).

Contoh penggunaan:
    python load_tester.py --mode mixed --duration 30 --rate 2
    python load_tester.py --mode fast --duration 60
    python load_tester.py --mode slow --duration 20
"""

import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.request

DEFAULT_BASE_URL = "http://localhost:8000"


def send_request(url: str, method: str = "GET", data: dict = None) -> dict:
    """Mengirim request HTTP dan mengukur waktu respon (latency)."""
    start = time.perf_counter()
    headers = {"User-Agent": "Jennifer-LoadTester/1.0"}
    encoded_data = None

    if data:
        encoded_data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(
        url, data=encoded_data, headers=headers, method=method
    )

    status_code = 0
    error_msg = None

    try:
        with urllib.request.urlopen(req, timeout=35) as resp:
            status_code = resp.status
    except urllib.error.HTTPError as http_err:
        status_code = http_err.code
        error_msg = f"HTTP {http_err.code}"
    except urllib.error.URLError as url_err:
        status_code = 0
        error_msg = f"Connection failed: {url_err.reason}"
    except Exception as exc:
        status_code = 0
        error_msg = str(exc)

    latency_ms = round((time.perf_counter() - start) * 1000, 2)
    return {
        "status_code": status_code,
        "latency_ms": latency_ms,
        "error": error_msg,
    }


def main():
    parser = argparse.ArgumentParser(
        description="JENNIFER APM Traffic Generator for FastAPI Test Suite"
    )
    parser.add_argument(
        "--url",
        type=str,
        default=DEFAULT_BASE_URL,
        help="Base URL server FastAPI (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--mode",
        choices=["fast", "slow", "mixed"],
        default="mixed",
        help="Profil transaksi: 'fast' (cepat), 'slow' (lambat >3s), 'mixed' (campuran realistis)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=30,
        help="Durasi generator berjalan dalam detik (default: 30 detik; 0 untuk tanpa batas)",
    )
    parser.add_argument(
        "--rate",
        type=float,
        default=1.5,
        help="Target pengiriman request per detik (default: 1.5 req/s)",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("🚀 JENNIFER APM Traffic Generator")
    print(f"Target Server : {args.url}")
    print(f"Mode          : {args.mode.upper()}")
    print(
        f"Durasi        : {args.duration} detik"
        if args.duration > 0
        else "Durasi        : Berjalan terus (Tekan Ctrl+C untuk stop)"
    )
    print(f"Target Rate   : {args.rate} request/detik")
    print("=" * 70)

    start_time = time.time()
    total_sent = 0
    normal_count = 0
    slow_count = 0
    error_count = 0

    endpoints_fast = [
        ("GET", "/items?skip=0&limit=10"),
        ("GET", "/health"),
        (
            "POST",
            "/items",
            {"name": "Random Item", "price": 150000.0, "stock": 10},
        ),
    ]

    try:
        while True:
            elapsed = time.time() - start_time
            if args.duration > 0 and elapsed >= args.duration:
                print("\\n⏱️ Durasi yang ditentukan telah selesai.")
                break

            if args.mode == "fast":
                choice = "fast"
            elif args.mode == "slow":
                choice = "slow"
            else:
                rnd = random.random()
                if rnd < 0.70:
                    choice = "fast"
                elif rnd < 0.90:
                    choice = "slow"
                else:
                    choice = "error"

            if choice == "fast":
                method, path, *extra = random.choice(endpoints_fast)
                payload = extra[0] if extra else None
                url = f"{args.url}{path}"
            elif choice == "slow":
                method = "GET"
                delay = round(random.uniform(3.0, 4.2), 2)
                url = f"{args.url}/api/test/slow?delay={delay}&queries=4"
                payload = None
            else:
                method = "GET"
                err_type = random.choice(["unhandled", "http_500"])
                url = f"{args.url}/api/test/error?error_type={err_type}"
                payload = None

            total_sent += 1
            res = send_request(url, method=method, data=payload)

            if res["status_code"] in [200, 201]:
                if res["latency_ms"] >= 3000:
                    slow_count += 1
                    status_tag = "🟡 [SLOW]"
                else:
                    normal_count += 1
                    status_tag = "🟢 [NORMAL]"
            else:
                error_count += 1
                status_tag = "🔴 [ERROR]"

            timestamp = time.strftime("%H:%M:%S")
            print(
                f"[{timestamp}] #{total_sent:03d} {status_tag} {method:<4} {url:<45} "
                f"-> Status: {res['status_code']} | Latency: {res['latency_ms']} ms"
            )

            interval = 1.0 / max(args.rate, 0.1)
            time.sleep(interval)

    except KeyboardInterrupt:
        print("\\n\\n🛑 Dihentikan oleh pengguna (Ctrl+C).")

    total_time = round(time.time() - start_time, 2)
    tps = round(total_sent / total_time, 2) if total_time > 0 else 0

    print("=" * 70)
    print("📊 Ringkasan Hasil Pengujian:")
    print(f"Total Request Terkirim : {total_sent}")
    print(f"Total Waktu Berjalan   : {total_time} detik ({tps} req/detik)")
    print(f"Transaksi Normal (<3s) : {normal_count}")
    print(f"Slow Transaction (>3s) : {slow_count}  -> Terbaca di zona lambat X-View")
    print(f"Exception / Error      : {error_count}  -> Terbaca di panel alert JENNIFER")
    print("=" * 70)


if __name__ == "__main__":
    main()`
  },
  {
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    badge: 'Dokumentasi',
    description: 'Panduan lengkap: instalasi venv, pip install, konfigurasi jennifer.conf, run CLI, dan testing',
    content: `# FastAPI CRUD & JENNIFER APM Test Suite

Aplikasi REST API CRUD sederhana berbasis **Python FastAPI** dan **SQLite (\`app.db\`)** yang dirancang khusus untuk diuji dan dimonitoring secara lokal menggunakan **JENNIFER APM (Application Performance Monitoring)**.

Aplikasi ini dilengkapi dengan endpoint transaksi standar dan endpoint pengujian khusus untuk menguji grafik **X-View**, **Slow Transaction**, **SQL Trace Profiling**, serta **Exception Alert**.

---

## 📁 Struktur Direktori

\`\`\`text
.
├── requirements.txt   # Dependensi: FastAPI, Uvicorn, SQLAlchemy, Pydantic
├── database.py        # Konfigurasi koneksi SQLite lokal (app.db) & session generator
├── models.py          # Model SQLAlchemy tabel 'items' (id, name, description, price, stock, created_at)
├── schemas.py         # Skema Pydantic validasi request & response
├── crud.py            # Operasi query database (get, create, update, delete)
├── main.py            # Routing FastAPI CRUD & endpoint pengujian APM (/api/test/slow, /api/test/error)
├── jennifer.conf      # File konfigurasi agen JENNIFER APM Python
└── README.md          # Panduan instalasi dan pengujian lengkap
\`\`\`

---

## ⚙️ Persyaratan Sistem

- Python 3.8, 3.9, 3.10, atau 3.11+
- Virtual Environment (\`venv\` atau \`conda\`)
- Paket agen JENNIFER APM untuk Python

---

## 🚀 Panduan Instalasi & Persiapan Lingkungan

### 1. Buat dan Aktifkan Virtual Environment
\`\`\`bash
# Linux / macOS
python3 -m venv venv
source venv/bin/activate

# Windows (PowerShell)
python -m venv venv
.\\venv\\Scripts\\Activate.ps1
\`\`\`

### 2. Install Dependensi Aplikasi
\`\`\`bash
pip install --upgrade pip
pip install -r requirements.txt
\`\`\`

### 3. Install Agen JENNIFER APM
\`\`\`bash
pip install jennifer
\`\`\`

---

## ▶️ Cara Menjalankan Aplikasi dengan Agen JENNIFER

\`\`\`bash
jennifer run -c ./jennifer.conf uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
\`\`\`

---

## 🧪 Endpoint Pengujian APM

1. **Slow Transaction (X-View Outlier)**:
\`\`\`bash
curl -X GET "http://localhost:8000/api/test/slow?delay=3.0&queries=5"
\`\`\`

2. **Exception Alert (Unhandled ValueError)**:
\`\`\`bash
curl -X GET "http://localhost:8000/api/test/error?error_type=unhandled"
\`\`\`

3. **HTTP 500 Error**:
\`\`\`bash
curl -X GET "http://localhost:8000/api/test/error?error_type=http_500"
\`\`\``
  }
];
