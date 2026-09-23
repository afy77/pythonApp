"""
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
    """Dependency generator untuk menyediakan session database per request.

    Memastikan session ditutup secara otomatis setelah request selesai
    sehingga tidak terjadi kebocoran koneksi (connection leak).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
