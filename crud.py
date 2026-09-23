"""
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
    """Memperbarui kolom item yang terisi pada payload update.

    Hanya kolom yang tidak None yang akan di-update.
    """
    db_item = get_item(db, item_id)
    if not db_item:
        return None

    # Update hanya field yang disediakan di request
    update_data = item_update.model_dump(exclude_unset=True) if hasattr(item_update, "model_dump") else item_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(db_item, field, value)

    db.commit()
    db.refresh(db_item)
    return db_item


def delete_item(db: Session, item_id: int) -> bool:
    """Menghapus data item berdasarkan item_id.

    Mengembalikan True jika berhasil dihapus, False jika item tidak ditemukan.
    """
    db_item = get_item(db, item_id)
    if not db_item:
        return False

    db.delete(db_item)
    db.commit()
    return True
