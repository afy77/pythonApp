import React, { useState, useEffect } from 'react';
import {
  Check,
  Edit2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { ItemEntity } from '../types';

const API_BASE = 'http://localhost:8000';

export const CrudPlayground: React.FC = () => {
  const [items, setItems] = useState<ItemEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState<number>(100000);
  const [formStock, setFormStock] = useState<number>(10);

  // Status log
  const [lastApiLog, setLastApiLog] = useState<{
    method: string;
    url: string;
    status: number;
    timeMs: number;
    payload?: string;
  }>({
    method: 'GET',
    url: '/items?skip=0&limit=100',
    status: 200,
    timeMs: 0,
  });

  const fetchItems = async () => {
    setLoading(true);
    const t0 = performance.now();
    try {
      const res = await fetch(`${API_BASE}/items?skip=0&limit=100`);
      const elapsed = Math.round(performance.now() - t0);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        setLastApiLog({
          method: 'GET',
          url: '/items?skip=0&limit=100',
          status: res.status,
          timeMs: elapsed,
        });
      } else {
        setLastApiLog({
          method: 'GET',
          url: '/items?skip=0&limit=100',
          status: res.status,
          timeMs: elapsed,
        });
      }
    } catch (e: any) {
      console.error('Failed to fetch from backend', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormPrice(100000);
    setFormStock(10);
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const payload = {
      name: formName.trim(),
      description: formDesc.trim() || null,
      price: Number(formPrice),
      stock: Number(formStock),
    };

    const t0 = performance.now();
    try {
      const res = await fetch(`${API_BASE}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const elapsed = Math.round(performance.now() - t0);
      if (res.ok) {
        const data = await res.json();
        setItems((prev) => [data, ...prev]);
        setLastApiLog({
          method: 'POST',
          url: '/items',
          status: res.status,
          timeMs: elapsed,
          payload: JSON.stringify(payload, null, 2),
        });
      }
    } catch (err: any) {
      console.error('Error creating item', err);
    }
    resetForm();
  };

  const handleStartEdit = (item: ItemEntity) => {
    setEditingId(item.id);
    setFormName(item.name);
    setFormDesc(item.description || '');
    setFormPrice(item.price);
    setFormStock(item.stock);
    setShowAddForm(false);
  };

  const handleUpdate = async (id: number) => {
    const payload = {
      name: formName.trim() || undefined,
      description: formDesc.trim() || null,
      price: Number(formPrice),
      stock: Number(formStock),
    };

    const t0 = performance.now();
    try {
      const res = await fetch(`${API_BASE}/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const elapsed = Math.round(performance.now() - t0);
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
        setLastApiLog({
          method: 'PUT',
          url: `/items/${id}`,
          status: res.status,
          timeMs: elapsed,
          payload: JSON.stringify(payload, null, 2),
        });
      }
    } catch (err: any) {
      console.error('Error updating item', err);
    }
    resetForm();
  };

  const handleDelete = async (id: number) => {
    const t0 = performance.now();
    try {
      const res = await fetch(`${API_BASE}/items/${id}`, {
        method: 'DELETE',
      });
      const elapsed = Math.round(performance.now() - t0);
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setLastApiLog({
          method: 'DELETE',
          url: `/items/${id}`,
          status: res.status,
          timeMs: elapsed,
        });
      }
    } catch (err: any) {
      console.error('Error deleting item', err);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div id="crud-playground-root" className="flex flex-col gap-6 w-full">
      {/* Playground Header & API Logger */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-base text-white">FastAPI CRUD Live Sandbox</h3>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Simulasi interaktif REST API endpoint <code className="text-cyan-300 font-mono">/items</code> yang terhubung ke SQLite database.
            </p>
          </div>

          <button
            id="btn-open-create-item"
            onClick={() => {
              setShowAddForm(true);
              setEditingId(null);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Item Baru (POST /items)</span>
          </button>
        </div>

        {/* Live HTTP Activity Banner */}
        <div className="mt-4 p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Last REST Call:</span>
            <span
              className={`px-2 py-0.5 rounded font-bold ${
                lastApiLog.method === 'POST'
                  ? 'bg-emerald-900 text-emerald-300'
                  : lastApiLog.method === 'PUT'
                  ? 'bg-amber-900 text-amber-300'
                  : lastApiLog.method === 'DELETE'
                  ? 'bg-rose-900 text-rose-300'
                  : 'bg-blue-900 text-blue-300'
              }`}
            >
              {lastApiLog.method}
            </span>
            <span className="text-white font-medium">{lastApiLog.url}</span>
          </div>

          <div className="flex items-center gap-3 text-slate-300">
            <span className="text-emerald-400 font-semibold">{lastApiLog.status} OK</span>
            <span>•</span>
            <span className="text-cyan-300">{lastApiLog.timeMs} ms</span>
          </div>
        </div>
      </div>

      {/* Add Item Modal / Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-blue-200 rounded-xl p-5 shadow-md flex flex-col gap-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>POST /items - Tambah Item Baru</span>
            </h4>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-700 hover:text-slate-900 font-medium"
            >
              Batal
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Item <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Keyboard Mechanical RGB"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Harga (IDR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                required
                value={formPrice}
                onChange={(e) => setFormPrice(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Deskripsi Lengkap
              </label>
              <textarea
                rows={2}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Spesifikasi atau rincian item..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Jumlah Stok <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={formStock}
                onChange={(e) => setFormStock(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={resetForm}
              className="px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Simpan Item (201 Created)
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-xl shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari item dalam database SQLite..."
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="text-xs text-slate-700 flex items-center gap-2">
          <span>Menampilkan {filteredItems.length} dari {items.length} data item</span>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4 w-16">ID</th>
                <th className="py-3 px-4">Nama Item</th>
                <th className="py-3 px-4">Deskripsi</th>
                <th className="py-3 px-4 text-right">Harga (IDR)</th>
                <th className="py-3 px-4 text-center">Stok</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">#{item.id}</td>

                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="w-full text-xs px-2 py-1 border border-blue-400 rounded"
                        />
                      ) : (
                        <span className="font-semibold text-slate-900">{item.name}</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                      {isEditing ? (
                        <input
                          type="text"
                          value={formDesc}
                          onChange={(e) => setFormDesc(e.target.value)}
                          className="w-full text-xs px-2 py-1 border border-blue-400 rounded"
                        />
                      ) : (
                        item.description || <span className="text-slate-600 italic">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                      {isEditing ? (
                        <input
                          type="number"
                          value={formPrice}
                          onChange={(e) => setFormPrice(Number(e.target.value))}
                          className="w-28 text-right text-xs px-2 py-1 border border-blue-400 rounded"
                        />
                      ) : (
                        `Rp ${item.price.toLocaleString('id-ID')}`
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={formStock}
                          onChange={(e) => setFormStock(Number(e.target.value))}
                          className="w-16 text-center text-xs px-2 py-1 border border-blue-400 rounded"
                        />
                      ) : (
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-mono font-medium ${
                            item.stock > 10
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.stock > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.stock} pcs
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleUpdate(item.id)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                            title="Simpan Perubahan"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={resetForm}
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                            title="Batal"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Item (PUT)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Item (DELETE)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
