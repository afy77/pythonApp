import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Flame,
  Info,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  StopCircle,
  Timer,
  X,
  Zap,
} from 'lucide-react';
import { ApmTransaction, TraceStep, TransactionStatus } from '../types';

export type TrafficMode = 'fast' | 'slow' | 'mixed';

export const ApmSimulator: React.FC = () => {
  const [transactions, setTransactions] = useState<ApmTransaction[]>([
    {
      id: 'TXN-9021',
      timestamp: Date.now() - 24000,
      timeStr: new Date(Date.now() - 24000).toLocaleTimeString(),
      method: 'GET',
      endpoint: '/items',
      statusCode: 200,
      responseTimeMs: 42,
      status: 'normal',
      sqlCount: 1,
      traceSteps: [
        { name: 'main:read_items_endpoint', type: 'method', durationMs: 42 },
        { name: 'crud:get_items', type: 'method', durationMs: 38 },
        { name: 'SELECT items.* FROM items LIMIT 100', type: 'sql', durationMs: 28 },
      ],
    },
    {
      id: 'TXN-9022',
      timestamp: Date.now() - 16000,
      timeStr: new Date(Date.now() - 16000).toLocaleTimeString(),
      method: 'POST',
      endpoint: '/items',
      statusCode: 201,
      responseTimeMs: 65,
      status: 'normal',
      sqlCount: 2,
      traceSteps: [
        { name: 'main:create_item_endpoint', type: 'method', durationMs: 65 },
        { name: 'crud:create_item', type: 'method', durationMs: 61 },
        { name: 'INSERT INTO items (name, price, stock) VALUES (...)', type: 'sql', durationMs: 35 },
        { name: 'SELECT items.* FROM items WHERE id = ?', type: 'sql', durationMs: 18 },
      ],
    },
    {
      id: 'TXN-9023',
      timestamp: Date.now() - 8000,
      timeStr: new Date(Date.now() - 8000).toLocaleTimeString(),
      method: 'GET',
      endpoint: '/api/test/slow?delay=3.0&queries=5',
      statusCode: 200,
      responseTimeMs: 3120,
      status: 'slow',
      sqlCount: 10,
      traceSteps: [
        { name: 'main:simulate_slow_transaction', type: 'method', durationMs: 3120 },
        { name: 'SELECT count(*) FROM items', type: 'sql', durationMs: 14, details: 'Iterasi loop query #1' },
        { name: 'SELECT * FROM items LIMIT 5', type: 'sql', durationMs: 16, details: 'Iterasi loop query #2' },
        { name: 'SELECT count(*) FROM items', type: 'sql', durationMs: 12, details: 'Iterasi loop query #3' },
        { name: 'SELECT * FROM items LIMIT 5', type: 'sql', durationMs: 15, details: 'Iterasi loop query #4' },
        { name: 'time.sleep(3.0)', type: 'sleep', durationMs: 3010, details: 'Simulasi delay IO / microservice latency' },
      ],
    },
  ]);

  const [activeRunning, setActiveRunning] = useState<string | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<ApmTransaction | null>(null);
  const [activeServicesCount, setActiveServicesCount] = useState<number>(0);

  // =========================================================================
  // Continuous Traffic Generator States
  // =========================================================================
  const [isGeneratorRunning, setIsGeneratorRunning] = useState<boolean>(false);
  const [trafficMode, setTrafficMode] = useState<TrafficMode>('mixed');
  const [durationSeconds, setDurationSeconds] = useState<number>(30); // 0 = unlimited
  const [trafficRate, setTrafficRate] = useState<number>(1.5); // req per second
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [generatorCompleted, setGeneratorCompleted] = useState<boolean>(false);

  const generatorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to spawn a single simulated transaction according to mode & dispatch real HTTP call
  const spawnTransaction = async (mode: TrafficMode) => {
    let chosenType: 'normal' | 'slow' | 'error' = 'normal';

    if (mode === 'fast') {
      chosenType = 'normal';
    } else if (mode === 'slow') {
      chosenType = 'slow';
    } else {
      // Mixed: 70% normal, 20% slow, 10% error
      const rnd = Math.random();
      if (rnd < 0.70) {
        chosenType = 'normal';
      } else if (rnd < 0.90) {
        chosenType = 'slow';
      } else {
        chosenType = 'error';
      }
    }

    const txnId = `TXN-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString();

    if (chosenType === 'normal') {
      const endpoints = [
        { method: 'GET', url: '/items?skip=0&limit=10' },
        { method: 'GET', url: '/items/1' },
        { method: 'GET', url: '/' },
        { method: 'POST', url: '/items' },
      ];
      const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
      const responseTime = Math.floor(28 + Math.random() * 55);

      // Real fetch to backend
      try {
        if (ep.method === 'POST') {
          fetch('http://localhost:8000/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `Random Item ${Math.floor(Math.random() * 1000)}`,
              price: 50000 + Math.floor(Math.random() * 200000),
              stock: Math.floor(Math.random() * 50),
            }),
          }).catch(() => {});
        } else {
          fetch(`http://localhost:8000${ep.url}`).catch(() => {});
        }
      } catch (err) {}

      const txn: ApmTransaction = {
        id: txnId,
        timestamp: now,
        timeStr,
        method: ep.method,
        endpoint: ep.url,
        statusCode: ep.method === 'POST' ? 201 : 200,
        responseTimeMs: responseTime,
        status: 'normal',
        sqlCount: ep.method === 'POST' ? 2 : 1,
        traceSteps: [
          { name: `fastapi_endpoint:${ep.url}`, type: 'method', durationMs: responseTime },
          { name: 'crud:query_execution', type: 'method', durationMs: responseTime - 8 },
          { name: 'SELECT items.* FROM items LIMIT 10', type: 'sql', durationMs: responseTime - 14 },
        ],
      };
      setTransactions((prev) => [...prev.slice(-35), txn]);
    } else if (chosenType === 'slow') {
      // Slow transaction (>3000ms)
      const sleepTime = 3000;
      const queryTime = Math.floor(80 + Math.random() * 150);
      const totalTime = sleepTime + queryTime;

      // Real fetch to slow endpoint
      fetch('http://localhost:8000/api/test/slow?delay=3.0&queries=5').catch(() => {});

      const txn: ApmTransaction = {
        id: txnId,
        timestamp: now,
        timeStr,
        method: 'GET',
        endpoint: '/api/test/slow?delay=3.0&queries=5',
        statusCode: 200,
        responseTimeMs: totalTime,
        status: 'slow',
        sqlCount: 10,
        traceSteps: [
          { name: 'main:simulate_slow_transaction', type: 'method', durationMs: totalTime },
          { name: 'SELECT count(*) FROM items', type: 'sql', durationMs: 16, details: 'Iterasi query SQLite #1' },
          { name: 'SELECT items.* FROM items LIMIT 5', type: 'sql', durationMs: 20, details: 'Iterasi query SQLite #2' },
          { name: 'SELECT count(*) FROM items', type: 'sql', durationMs: 14, details: 'Iterasi query SQLite #3' },
          { name: 'SELECT items.* FROM items LIMIT 5', type: 'sql', durationMs: 19, details: 'Iterasi query SQLite #4' },
          { name: 'time.sleep(3.0)', type: 'sleep', durationMs: 3005, details: 'Simulasi slow microservice/IO latency' },
        ],
      };
      setTransactions((prev) => [...prev.slice(-35), txn]);
    } else {
      // Error / Exception
      const isUnhandled = Math.random() > 0.5;
      const responseTime = Math.floor(22 + Math.random() * 30);
      const errorUrl = `/api/test/error?error_type=${isUnhandled ? 'unhandled' : 'http_500'}`;

      // Real fetch to error endpoint
      fetch(`http://localhost:8000${errorUrl}`).catch(() => {});

      const txn: ApmTransaction = {
        id: txnId,
        timestamp: now,
        timeStr,
        method: 'GET',
        endpoint: errorUrl,
        statusCode: 500,
        responseTimeMs: responseTime,
        status: 'error',
        sqlCount: 0,
        errorDetail: isUnhandled
          ? 'ValueError: [JENNIFER APM TEST] Sengaja melempar Unhandled ValueError! Tertangkap di panel Exception Alert.'
          : 'HTTPException(500): [JENNIFER APM TEST] Sengaja melempar HTTPException(500) untuk pengujian alert error HTTP.',
        traceSteps: [
          { name: 'main:simulate_error_endpoint', type: 'method', durationMs: responseTime },
          {
            name: isUnhandled ? 'raise ValueError(...)' : 'raise HTTPException(500)',
            type: 'exception',
            durationMs: responseTime,
            details: isUnhandled
              ? 'File "main.py", line 183\nValueError: [JENNIFER APM TEST] Sengaja melempar Unhandled ValueError!'
              : 'File "main.py", line 177\nHTTPException: 500 Internal Server Error',
          },
        ],
      };
      setTransactions((prev) => [...prev.slice(-35), txn]);
    }
  };

  // Start continuous traffic generator
  const handleStartGenerator = () => {
    setIsGeneratorRunning(true);
    setGeneratorCompleted(false);
    setElapsedSeconds(0);
    setActiveServicesCount(trafficMode === 'slow' ? 3 : 1);

    // Initial immediate burst
    spawnTransaction(trafficMode);
  };

  // Stop continuous traffic generator
  const handleStopGenerator = () => {
    setIsGeneratorRunning(false);
    setActiveServicesCount(0);
    if (generatorTimerRef.current) clearInterval(generatorTimerRef.current);
    if (requestIntervalRef.current) clearInterval(requestIntervalRef.current);
  };

  // Effect for generator countdown and dispatching requests
  useEffect(() => {
    if (isGeneratorRunning) {
      // Timer countdown
      generatorTimerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          if (durationSeconds > 0 && next >= durationSeconds) {
            handleStopGenerator();
            setGeneratorCompleted(true);
            return durationSeconds;
          }
          return next;
        });
      }, 1000);

      // Request dispatcher interval
      const intervalMs = Math.max(300, Math.floor(1000 / trafficRate));
      requestIntervalRef.current = setInterval(() => {
        spawnTransaction(trafficMode);
      }, intervalMs);
    } else {
      if (generatorTimerRef.current) clearInterval(generatorTimerRef.current);
      if (requestIntervalRef.current) clearInterval(requestIntervalRef.current);
    }

    return () => {
      if (generatorTimerRef.current) clearInterval(generatorTimerRef.current);
      if (requestIntervalRef.current) clearInterval(requestIntervalRef.current);
    };
  }, [isGeneratorRunning, trafficMode, durationSeconds, trafficRate]);

  // Single manual execution handlers
  const executeSingleNormal = () => {
    spawnTransaction('fast');
  };

  const executeSingleSlow = () => {
    setActiveRunning('GET /api/test/slow');
    setActiveServicesCount((c) => c + 1);
    fetch('http://localhost:8000/api/test/slow?delay=3.0&queries=5').catch(() => {});
    setTimeout(() => {
      spawnTransaction('slow');
      setActiveRunning(null);
      setActiveServicesCount((c) => Math.max(0, c - 1));
    }, 3100);
  };

  const executeSingleError = () => {
    fetch('http://localhost:8000/api/test/error?error_type=unhandled').catch(() => {});
    const txn: ApmTransaction = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: Date.now(),
      timeStr: new Date().toLocaleTimeString(),
      method: 'GET',
      endpoint: '/api/test/error?error_type=unhandled',
      statusCode: 500,
      responseTimeMs: 35,
      status: 'error',
      sqlCount: 0,
      errorDetail: 'ValueError: [JENNIFER APM TEST] Sengaja melempar Unhandled ValueError!',
      traceSteps: [
        { name: 'main:simulate_error_endpoint', type: 'method', durationMs: 35 },
        { name: 'raise ValueError(...)', type: 'exception', durationMs: 35 },
      ],
    };
    setTransactions((prev) => [...prev.slice(-35), txn]);
  };

  const handleClear = () => {
    handleStopGenerator();
    setTransactions([]);
    setSelectedTxn(null);
    setElapsedSeconds(0);
    setGeneratorCompleted(false);
  };

  // Metrics calculation
  const totalCount = transactions.length;
  const slowCount = transactions.filter((t) => t.status === 'slow').length;
  const errorCount = transactions.filter((t) => t.status === 'error').length;
  const normalCount = transactions.filter((t) => t.status === 'normal').length;
  const avgTime =
    totalCount > 0
      ? Math.round(transactions.reduce((acc, t) => acc + t.responseTimeMs, 0) / totalCount)
      : 0;

  // Max scale for X-View Y-axis is 4000ms
  const maxY = 4000;

  return (
    <div id="apm-simulator-root" className="flex flex-col gap-6 w-full">
      {/* ========================================================================= */}
      {/* Continuous Traffic Generator Control Panel                                */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-inner transition-colors ${
              isGeneratorRunning ? 'bg-amber-600 animate-pulse' : 'bg-blue-600'
            }`}>
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-white tracking-wide">
                  Continuous Traffic & Load Generator (Uji Kinerja APM)
                </h3>
                {isGeneratorRunning ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded animate-pulse font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    TRAFFIC AKTIF
                  </span>
                ) : (
                  <span className="text-[11px] font-mono bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded">
                    STANDBY
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Kirim data transaksi secara terus-menerus ke APM dengan pilihan profil kecepatan, durasi waktu, dan laju request.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-clear-apm"
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset X-View</span>
            </button>
          </div>
        </div>

        {/* Generator Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* 1. Traffic Mode Selection */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>1. Profil Transaksi:</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                id="btn-mode-fast"
                disabled={isGeneratorRunning}
                onClick={() => setTrafficMode('fast')}
                className={`py-2 px-2 text-center rounded-lg text-xs font-medium transition-all ${
                  trafficMode === 'fast'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                } disabled:opacity-60`}
              >
                <div className="text-[11px]">🚀 Cepat Saja</div>
                <div className="text-[9px] opacity-80 mt-0.5">&lt;100 ms</div>
              </button>

              <button
                type="button"
                id="btn-mode-slow"
                disabled={isGeneratorRunning}
                onClick={() => setTrafficMode('slow')}
                className={`py-2 px-2 text-center rounded-lg text-xs font-medium transition-all ${
                  trafficMode === 'slow'
                    ? 'bg-amber-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                } disabled:opacity-60`}
              >
                <div className="text-[11px]">⏱️ Lambat Saja</div>
                <div className="text-[9px] opacity-80 mt-0.5">&gt;3000 ms</div>
              </button>

              <button
                type="button"
                id="btn-mode-mixed"
                disabled={isGeneratorRunning}
                onClick={() => setTrafficMode('mixed')}
                className={`py-2 px-2 text-center rounded-lg text-xs font-medium transition-all ${
                  trafficMode === 'mixed'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                } disabled:opacity-60`}
              >
                <div className="text-[11px]">🔀 Campur</div>
                <div className="text-[9px] opacity-80 mt-0.5">Real-World</div>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {trafficMode === 'fast' && 'Hanya transaksi cepat (GET /items, /health, POST). Titik berkumpul di bawah threshold.'}
              {trafficMode === 'slow' && 'Hanya transaksi lambat (sleep 3 detik + query berulang). Titik berkumpul di atas Slow Threshold 3000ms.'}
              {trafficMode === 'mixed' && 'Simulasi produksi: 70% Cepat (<100ms), 20% Lambat (>3000ms), dan 10% Exception Alert.'}
            </p>
          </div>

          {/* 2. Duration Selection */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-amber-400" />
              <span>2. Durasi Berjalan:</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {[
                { label: '15s', val: 15 },
                { label: '30s', val: 30 },
                { label: '60s', val: 60 },
                { label: 'Unlimited', val: 0 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  id={`btn-duration-${opt.val}`}
                  disabled={isGeneratorRunning}
                  onClick={() => setDurationSeconds(opt.val)}
                  className={`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all ${
                    durationSeconds === opt.val
                      ? 'bg-amber-600 text-white font-semibold shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  } disabled:opacity-60`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
              <span>Target Durasi:</span>
              <span className="font-mono text-slate-200 font-semibold">
                {durationSeconds > 0 ? `${durationSeconds} detik` : 'Sampai distop manual'}
              </span>
            </div>
          </div>

          {/* 3. Traffic Rate & Main Action Button */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3. Kecepatan (Rate):</span>
                </span>
                <span className="font-mono text-emerald-400 text-xs font-bold">
                  {trafficRate} req/detik
                </span>
              </label>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.5"
                disabled={isGeneratorRunning}
                value={trafficRate}
                onChange={(e) => setTrafficRate(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0.5 req/s (Santai)</span>
                <span>3.0 req/s (Padat)</span>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="mt-3">
              {isGeneratorRunning ? (
                <button
                  type="button"
                  id="btn-stop-traffic"
                  onClick={handleStopGenerator}
                  className="w-full py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md animate-pulse"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Hentikan Transaksi Sekarang</span>
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-start-traffic"
                  onClick={handleStartGenerator}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Mulai Kirim Transaksi Kontinu</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Traffic Running Progress Bar */}
        {isGeneratorRunning && (
          <div className="p-3.5 bg-blue-950/80 border border-blue-700/60 rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-blue-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span className="font-semibold text-white">Generator Sedang Aktif:</span>
                <span className="text-cyan-300 uppercase">Mode {trafficMode}</span>
                <span>• {trafficRate} req/s</span>
              </div>
              <div className="text-amber-300 font-semibold">
                {durationSeconds > 0
                  ? `Sisa Waktu: ${Math.max(0, durationSeconds - elapsedSeconds)}s / ${durationSeconds}s`
                  : `Waktu Berjalan: ${elapsedSeconds}s (Tanpa Batas)`}
              </div>
            </div>

            {/* Progress bar line */}
            {durationSeconds > 0 && (
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 transition-all duration-300 ease-linear rounded-full"
                  style={{ width: `${Math.min(100, (elapsedSeconds / durationSeconds) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Completed notification banner */}
        {generatorCompleted && !isGeneratorRunning && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-xl flex items-center justify-between text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Pengiriman transaksi kontinu selama <strong className="text-white">{durationSeconds} detik</strong> telah selesai.
                Seluruh titik transaksi telah diplotkan pada grafik X-View di bawah.
              </span>
            </div>
            <button
              onClick={() => setGeneratorCompleted(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Manual Single Triggers */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 font-medium">Uji Cepat (Kirim 1 Transaksi Tunggal):</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-single-normal"
              onClick={executeSingleNormal}
              disabled={isGeneratorRunning}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-medium transition-colors border border-slate-700 disabled:opacity-50"
            >
              +1 Normal (~45ms)
            </button>
            <button
              type="button"
              id="btn-single-slow"
              onClick={executeSingleSlow}
              disabled={isGeneratorRunning || !!activeRunning}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-medium transition-colors border border-slate-700 disabled:opacity-50"
            >
              +1 Slow (~3s)
            </button>
            <button
              type="button"
              id="btn-single-error"
              onClick={executeSingleError}
              disabled={isGeneratorRunning}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 font-medium transition-colors border border-slate-700 disabled:opacity-50"
            >
              +1 Exception Alert
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Live Metrics Row                                                          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-xs text-slate-700 font-medium">Total Transaksi</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Tercatat di X-View</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-xs text-slate-700 font-medium">Normal (&lt;1s)</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">{normalCount}</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Respon cepat optimal</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-xs text-slate-700 font-medium">Slow Trans. (&gt;3s)</div>
          <div className="text-2xl font-bold font-mono text-amber-600 mt-1">{slowCount}</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Zona Slow di X-View</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-xs text-slate-700 font-medium">Exception Alert</div>
          <div className="text-2xl font-bold font-mono text-rose-600 mt-1">{errorCount}</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Titik merah di X-View</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-700 font-medium">Rata-rata Respon</div>
          <div className="text-2xl font-bold font-mono text-blue-600 mt-1">
            {avgTime} <span className="text-xs font-normal text-slate-700">ms</span>
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5">Seluruh request</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* JENNIFER X-View Scatter Plot                                              */}
      {/* ========================================================================= */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-semibold text-slate-100 tracking-wide">
              JENNIFER APM X-View (Real-Time Transaction Scatter Plot)
            </h4>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Normal (&lt;1s)
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              Slow (&gt;3s)
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-400/40" />
              Exception Alert
            </span>
          </div>
        </div>

        {/* Interactive Chart Canvas */}
        <div className="relative w-full h-80 bg-slate-900/90 rounded-lg border border-slate-800 overflow-hidden select-none">
          {/* 3000ms Slow Threshold line */}
          <div
            className="absolute left-0 right-0 border-b border-dashed border-amber-500/80 flex items-center justify-between px-3 z-10 pointer-events-none"
            style={{ bottom: `${(3000 / maxY) * 100}%` }}
          >
            <span className="text-[10px] font-mono text-amber-400 font-semibold bg-slate-950/80 px-1.5 py-0.5 rounded">
              ▲ SLOW THRESHOLD: 3,000 ms (jennifer.conf slow_threshold)
            </span>
            <span className="text-[10px] font-mono text-amber-400/80">3.0s</span>
          </div>

          {/* 2000ms guide line */}
          <div
            className="absolute left-0 right-0 border-b border-slate-800/60 flex items-center justify-between px-3 z-10 pointer-events-none"
            style={{ bottom: `${(2000 / maxY) * 100}%` }}
          >
            <span className="text-[10px] font-mono text-slate-300">2,000 ms</span>
            <span className="text-[10px] font-mono text-slate-300">2.0s</span>
          </div>

          {/* 1000ms Normal guide line */}
          <div
            className="absolute left-0 right-0 border-b border-slate-800 flex items-center justify-between px-3 z-10 pointer-events-none"
            style={{ bottom: `${(1000 / maxY) * 100}%` }}
          >
            <span className="text-[10px] font-mono text-slate-300">1,000 ms</span>
            <span className="text-[10px] font-mono text-slate-300">1.0s</span>
          </div>

          {/* Scatter Points */}
          <div className="absolute inset-0 p-6">
            {transactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 text-xs">
                <Info className="w-6 h-6 mb-2 text-slate-300" />
                <span>Belum ada transaksi di grafik X-View.</span>
                <span className="text-slate-400 text-[11px] mt-0.5">
                  Gunakan tombol &quot;Mulai Kirim Transaksi Kontinu&quot; di atas untuk mengisi grafik.
                </span>
              </div>
            ) : (
              transactions.map((txn, index) => {
                // calculate horizontal position
                const leftPercent =
                  transactions.length === 1
                    ? 50
                    : Math.max(4, Math.min(96, 4 + (index / (transactions.length - 1)) * 92));
                // calculate vertical position based on responseTime
                const clampedTime = Math.min(txn.responseTimeMs, maxY);
                const bottomPercent = Math.max(3, Math.min(95, (clampedTime / maxY) * 100));

                let dotColor = 'bg-emerald-400 border-emerald-200 hover:scale-125';
                if (txn.status === 'slow') {
                  dotColor = 'bg-amber-400 border-amber-200 ring-4 ring-amber-500/30 hover:scale-125';
                } else if (txn.status === 'error') {
                  dotColor = 'bg-rose-500 border-rose-300 ring-4 ring-rose-500/40 animate-pulse hover:scale-125';
                }

                return (
                  <button
                    key={txn.id}
                    id={`xview-dot-${txn.id}`}
                    onClick={() => setSelectedTxn(txn)}
                    style={{ left: `${leftPercent}%`, bottom: `${bottomPercent}%` }}
                    className={`absolute -translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all cursor-pointer ${dotColor} ${
                      selectedTxn?.id === txn.id ? 'scale-150 ring-4 ring-cyan-400' : ''
                    }`}
                    title={`${txn.method} ${txn.endpoint} (${txn.responseTimeMs}ms) - Klik untuk inspect Profiling Trace`}
                  />
                );
              })
            )}
          </div>

          {/* Bottom X-axis label */}
          <div className="absolute bottom-2 left-4 text-[10px] font-mono text-slate-300 flex items-center gap-1.5">
            <span>Waktu Transaksi (Timeline)</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-200">Klik titik manapun pada grafik untuk melihat Call Tree &amp; SQL Trace</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Transaction Profile Modal / Detail View                                   */}
      {/* ========================================================================= */}
      {selectedTxn && (
        <div
          id="jennifer-profile-modal"
          className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xl"
        >
          {/* Header */}
          <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                  selectedTxn.status === 'slow'
                    ? 'bg-amber-500 text-slate-950'
                    : selectedTxn.status === 'error'
                    ? 'bg-rose-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {selectedTxn.statusCode} {selectedTxn.status.toUpperCase()}
              </span>
              <div>
                <div className="font-mono text-sm font-semibold flex items-center gap-2">
                  <span>
                    {selectedTxn.method} {selectedTxn.endpoint}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                  <span>ID: {selectedTxn.id}</span>
                  <span>Waktu: {selectedTxn.timeStr}</span>
                  <span className="text-cyan-400 font-semibold">
                    Durasi: {selectedTxn.responseTimeMs} ms
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedTxn(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 flex flex-col gap-5">
            {/* Alert banner if error */}
            {selectedTxn.status === 'error' && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 leading-relaxed">
                  <div className="font-semibold text-sm text-rose-950 mb-1">
                    JENNIFER APM Exception Alert Terpicu!
                  </div>
                  <pre className="font-mono text-[11px] whitespace-pre-wrap bg-rose-100/70 p-2.5 rounded-lg border border-rose-200 text-rose-950 mt-1">
                    {selectedTxn.errorDetail}
                  </pre>
                </div>
              </div>
            )}

            {/* Alert banner if slow */}
            {selectedTxn.status === 'slow' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <div className="font-semibold text-sm text-amber-950 mb-0.5">
                    Slow Transaction Terdeteksi (&gt; 3,000 ms)
                  </div>
                  <div>
                    Transaksi memakan waktu{' '}
                    <span className="font-bold font-mono">{selectedTxn.responseTimeMs} ms</span>,
                    melebihi batas{' '}
                    <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">
                      slow_threshold = 3000
                    </code>{' '}
                    pada <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">jennifer.conf</code>.
                  </div>
                </div>
              </div>
            )}

            {/* Call Tree / Method Profiling Breakdown */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span>JENNIFER Method &amp; SQL Profiling Call Tree</span>
                </div>
                <span className="text-xs font-mono text-slate-700">
                  {selectedTxn.traceSteps.length} layer dicatat
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 divide-y divide-slate-200">
                {selectedTxn.traceSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 flex items-start justify-between gap-3 text-xs font-mono hover:bg-slate-100/70"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {step.type === 'sql' ? (
                        <Database className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : step.type === 'sleep' ? (
                        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      ) : step.type === 'exception' ? (
                        <Flame className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 break-words">
                          {step.name}
                        </div>
                        {step.details && (
                          <div className="text-[11px] text-slate-700 font-sans mt-0.5 whitespace-pre-wrap">
                            {step.details}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`font-semibold ${
                          step.durationMs > 1000
                            ? 'text-amber-600 font-bold'
                            : step.durationMs > 100
                            ? 'text-blue-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {step.durationMs} ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
