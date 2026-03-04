/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileAudio, FileVideo, Download, Settings, Loader2, CheckCircle2, AlertCircle, Play, Trash2, Cpu, Zap, RotateCcw, Clock, Sun, Moon, Github, Shield, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Theme = 'theme-light' | 'theme-dark';

const MODELS = [
  {
    id: 'Xenova/whisper-small',
    name: 'IndicWhisper-v2 (Small)',
    params: '244M',
    size: '~250MB',
    speed: { wasm: 'Slow (~2x)', webgpu: 'Fast (~15x)' },
    useCase: 'Long-form Video / Legal',
    slang: '⭐⭐⭐⭐⭐⭐',
  },
  {
    id: 'Xenova/whisper-medium',
    name: 'Oriserve Whisper-Hindi2Hinglish-Swift',
    params: '769M',
    size: '~600MB',
    speed: { wasm: 'Very Slow (~0.5x)', webgpu: 'Moderate (~5x)' },
    useCase: 'The Hinglish Specialist',
    slang: '⭐⭐⭐⭐⭐⭐⭐',
  }
];

type HistoryItem = {
  id: string;
  filename: string;
  date: Date;
  chunks: any[];
  processingTime: number;
};

export default function App() {
  const [theme, setTheme] = useState<Theme>('theme-light');
  const [file, setFile] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [device, setDevice] = useState<'wasm' | 'webgpu' | null>(null); // Available device
  const [selectedDevice, setSelectedDevice] = useState<'wasm' | 'webgpu'>('wasm'); // User selected device

  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [transcriptionStatus, setTranscriptionStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');

  const [progress, setProgress] = useState<{ file?: string; progress?: number; status?: string }>({});
  const [transcriptionChunks, setTranscriptionChunks] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const worker = useRef<Worker | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const chunksRef = useRef<any[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  // Keep chunksRef in sync with state
  useEffect(() => {
    chunksRef.current = transcriptionChunks;
  }, [transcriptionChunks]);

  useEffect(() => {
    if (transcriptionStatus === 'processing') {
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptionChunks, transcriptionStatus]);

  const totalChunksRef = useRef(0);
  const completedChunksRef = useRef(0);
  const accumulatedChunksRef = useRef<any[]>([]);
  const [progressStats, setProgressStats] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module'
      });
      worker.current.postMessage({ type: 'check_gpu' });
    }

    const onMessageReceived = (e: MessageEvent) => {
      switch (e.data.type) {
        case 'gpu_status':
          setDevice(e.data.device);
          if (e.data.device === 'webgpu') {
            setSelectedDevice('webgpu');
          }
          break;
        case 'progress':
          setProgress(e.data.data);
          break;
        case 'ready':
          setModelStatus('ready');
          break;
        case 'complete':
          // Handle chunk completion
          const { text, chunks, index, offset } = e.data.data;

          // Adjust timestamps
          const adjustedChunks = chunks ? chunks.map((c: any) => ({
            ...c,
            timestamp: [c.timestamp[0] + offset, c.timestamp[1] + offset]
          })) : [{
            text: text,
            timestamp: [offset, offset + 30] // Fallback if no chunks returned
          }];

          // Update accumulated chunks ref synchronously
          accumulatedChunksRef.current = [...accumulatedChunksRef.current, ...adjustedChunks].sort((a, b) => a.timestamp[0] - b.timestamp[0]);

          // Update UI state
          setTranscriptionChunks([...accumulatedChunksRef.current]);

          // Update progress
          completedChunksRef.current += 1;
          const currentCompleted = completedChunksRef.current;
          const currentTotal = totalChunksRef.current;

          setProgressStats({ completed: currentCompleted, total: currentTotal });

          if (currentCompleted >= currentTotal && currentTotal > 0) {
            setTranscriptionStatus('complete');
            const processingTime = (Date.now() - startTimeRef.current) / 1000;
            // Save to history using the fully accumulated ref
            setHistory(h => [{
              id: Date.now().toString(),
              filename: file?.name || 'Unknown Audio',
              date: new Date(),
              chunks: [...accumulatedChunksRef.current],
              processingTime
            }, ...h]);
          }
          break;
        case 'error':
          setTranscriptionStatus('error');
          setErrorMsg(e.data.error);
          break;
      }
    };

    worker.current.addEventListener('message', onMessageReceived);

    return () => {
      worker.current?.removeEventListener('message', onMessageReceived);
    };
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setTranscriptionChunks([]);
      setTranscriptionStatus('idle');
      setActiveHistoryId(null);
    }
  };

  const clearFile = () => {
    setFile(null);
    setTranscriptionChunks([]);
    setTranscriptionStatus('idle');
    setActiveHistoryId(null);
  };

  const clearTranscription = () => {
    setTranscriptionChunks([]);
    setTranscriptionStatus('idle');
    setActiveHistoryId(null);
  };

  const loadModel = () => {
    setModelStatus('loading');
    worker.current?.postMessage({
      type: 'load',
      model: selectedModel,
      device: selectedDevice,
    });
  };

  const [processingStage, setProcessingStage] = useState<'decoding' | 'transcribing' | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (transcriptionStatus === 'processing') {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [transcriptionStatus]);

  const transcribe = async () => {
    if (!file || modelStatus !== 'ready') return;
    setTranscriptionStatus('processing');
    setProcessingStage('decoding');
    setTranscriptionChunks([]);
    accumulatedChunksRef.current = []; // Reset accumulator
    setActiveHistoryId(null);
    startTimeRef.current = Date.now();

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      let audioData;
      if (audioBuffer.numberOfChannels === 2) {
        const SCALING_FACTOR = Math.sqrt(2);
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        audioData = new Float32Array(left.length);
        for (let i = 0; i < audioBuffer.length; ++i) {
          audioData[i] = SCALING_FACTOR * (left[i] + right[i]) / 2;
        }
      } else {
        audioData = audioBuffer.getChannelData(0);
      }

      setProcessingStage('transcribing');

      // Calculate chunks (30 seconds * 16000 samples/sec)
      const CHUNK_SIZE = 30 * 16000;
      const numChunks = Math.ceil(audioData.length / CHUNK_SIZE);

      totalChunksRef.current = numChunks;
      completedChunksRef.current = 0;
      setProgressStats({ completed: 0, total: numChunks });

      // Send all chunks to worker
      for (let i = 0; i < numChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, audioData.length);
        const chunk = audioData.slice(start, end);

        worker.current?.postMessage({
          type: 'transcribe',
          model: selectedModel,
          audio: chunk,
          device: selectedDevice,
          index: i,
          offset: i * 30 // Offset in seconds
        });
      }

    } catch (err) {
      setTranscriptionStatus('error');
      setErrorMsg('Failed to process audio file');
    }
  };

  const downloadTranscription = (format: 'txt' | 'srt', chunksToExport: any[], filename: string) => {
    if (chunksToExport.length === 0) return;

    let text = '';

    if (format === 'srt') {
      text = chunksToExport.map((chunk, i) => {
        const start = formatTimeSRT(chunk.timestamp[0]);
        const end = formatTimeSRT(chunk.timestamp[1]);
        return `${i + 1}\n${start} --> ${end}\n${chunk.text.trim()}\n`;
      }).join('\n');
    } else {
      text = chunksToExport.map((chunk) => `[${formatTime(chunk.timestamp[0])} -> ${formatTime(chunk.timestamp[1])}] ${chunk.text}`).join('\n');
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (time: number | null) => {
    if (time === null) return '...';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimeSRT = (time: number | null) => {
    if (time === null) return '00:00:00,000';
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  };

  const activeChunks = activeHistoryId
    ? history.find(h => h.id === activeHistoryId)?.chunks || []
    : transcriptionChunks;

  const activeFilename = activeHistoryId
    ? history.find(h => h.id === activeHistoryId)?.filename || 'transcription'
    : file?.name || 'transcription';

  return (
    <div className="min-h-screen w-full flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">

      {/* Theme Switcher */}
      <div className="fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => setTheme(theme === 'theme-light' ? 'theme-dark' : 'theme-light')}
          className="p-2 rounded-full border-2 border-[var(--border-color)] bg-[var(--surface-color)] hover:scale-110 transition-transform shadow-lg"
          title={theme === 'theme-light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'theme-light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-7xl space-y-8"
      >
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase">
            Sonic<span className="text-[var(--accent-color)]">Scribe</span>
          </h1>
          <p className="text-lg md:text-xl font-medium text-[var(--text-muted)] max-w-2xl mx-auto">
            Professional-grade, on-device transcription for creators. Zero server uploads. Infinite privacy.
          </p>

          {selectedDevice && (
            <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold uppercase border-2 border-[var(--border-color)] p-2 rounded w-fit mx-auto bg-[var(--surface-color)]">
              {selectedDevice === 'webgpu' ? (
                <><Zap size={14} className="text-[var(--accent-tertiary)]" /> Using WebGPU (High Performance)</>
              ) : (
                <><Cpu size={14} className="text-[var(--text-muted)]" /> Using CPU (WASM)</>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Left Column: Controls */}
          <div className="lg:col-span-1 space-y-6">
            <div className="card p-6 space-y-6">
              <h2 className="text-xl font-bold uppercase tracking-wider border-b-2 border-[var(--border-color)] pb-2">
                1. Select Model
              </h2>

              <div className="flex items-center justify-between bg-[var(--surface-color)] p-3 border-2 border-[var(--border-color)] rounded">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold uppercase">Device:</span>
                  <div className="relative">
                    <select
                      value={selectedDevice}
                      onChange={(e) => {
                        setSelectedDevice(e.target.value as 'wasm' | 'webgpu');
                        setModelStatus('idle');
                      }}
                      className="bg-transparent font-mono text-sm font-bold outline-none cursor-pointer"
                    >
                      <option value="webgpu" disabled={device !== 'webgpu'}>WebGPU {device !== 'webgpu' ? '(N/A)' : ''}</option>
                      <option value="wasm">CPU (WASM)</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <button
                    className="text-[var(--text-muted)] hover:text-[var(--accent-color)] transition-colors"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                  >
                    <AlertCircle size={16} />
                  </button>
                  <AnimatePresence>
                    {showTooltip && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full right-0 mb-2 w-56 p-3 bg-[var(--text-color)] text-[var(--bg-color)] text-xs rounded shadow-xl z-50 pointer-events-none"
                      >
                        <p className="font-bold mb-1">Why WebGPU?</p>
                        <p>WebGPU runs models directly on your graphics card, offering up to 15x faster transcription than CPU.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="space-y-3">
                {MODELS.map((m) => (
                  <label
                    key={m.id}
                    className={cn(
                      "flex flex-col p-3 border-2 cursor-pointer transition-all",
                      selectedModel === m.id
                        ? "border-[var(--accent-color)] bg-[var(--accent-color)]/10"
                        : "border-[var(--border-color)] opacity-70 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="model"
                          value={m.id}
                          checked={selectedModel === m.id}
                          onChange={(e) => {
                            setSelectedModel(e.target.value);
                            setModelStatus('idle');
                          }}
                          className="hidden"
                        />
                        <span className="font-bold text-sm">{m.name}</span>
                      </div>
                      {selectedModel === m.id && modelStatus === 'ready' && (
                        <CheckCircle2 size={18} className="text-[var(--accent-secondary)]" />
                      )}
                    </div>
                    <div className="text-xs font-mono mt-2 text-[var(--text-muted)] grid grid-cols-2 gap-1">
                      <span>Size: {m.size}</span>
                      <span>Speed: {m.speed[selectedDevice]}</span>
                    </div>
                  </label>
                ))}
              </div>

              {modelStatus === 'idle' && (
                <button
                  onClick={loadModel}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  <Download size={18} /> Load Model
                </button>
              )}

              {modelStatus === 'loading' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono font-bold">
                    <span>{progress.file || 'Loading...'}</span>
                    <span>{progress.progress ? `${Math.round(progress.progress)}%` : ''}</span>
                  </div>
                  <div className="progress-bar h-3 w-full">
                    <motion.div
                      className="progress-fill h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.progress || 0}%` }}
                    />
                  </div>
                </div>
              )}

              {modelStatus === 'ready' && (
                <div className="flex items-center gap-2 text-[var(--accent-secondary)] font-bold text-sm uppercase">
                  <CheckCircle2 size={18} /> Model Ready
                </div>
              )}
            </div>

            <div className={cn("card p-6 space-y-6 transition-opacity", modelStatus !== 'ready' ? 'opacity-50 pointer-events-none' : '')}>
              <h2 className="text-xl font-bold uppercase tracking-wider border-b-2 border-[var(--border-color)] pb-2">
                2. Upload Media
              </h2>

              {!file ? (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[var(--border-color)] cursor-pointer hover:bg-[var(--accent-color)]/5 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-[var(--text-muted)]" />
                    <p className="mb-2 text-sm font-bold"><span className="text-[var(--accent-color)]">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-[var(--text-muted)] font-mono">MP3, WAV, MP4, WEBM</p>
                  </div>
                  <input type="file" className="hidden" accept="audio/*,video/*" onChange={handleFileChange} />
                </label>
              ) : (
                <div className="flex items-center gap-3 p-3 border-2 border-[var(--border-color)] bg-[var(--surface-color)] relative group">
                  {file.type.startsWith('video') ? <FileVideo className="text-[var(--accent-secondary)] shrink-0" /> : <FileAudio className="text-[var(--accent-secondary)] shrink-0" />}
                  <div className="flex-1 min-w-0 pr-8">
                    <p className="text-sm font-bold truncate">{file.name}</p>
                    <p className="text-xs font-mono text-[var(--text-muted)]">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={clearFile}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    title="Remove file"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              <button
                onClick={transcribe}
                disabled={!file || transcriptionStatus === 'processing'}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {transcriptionStatus === 'processing' ? <><Loader2 className="animate-spin" size={18} /> Processing...</> : <><Play size={18} /> Transcribe</>}
              </button>
            </div>
          </div>

          {/* Middle Column: Output */}
          <div className="lg:col-span-2">
            <div className="card p-6 h-[600px] flex flex-col">
              <div className="flex justify-between items-center border-b-2 border-[var(--border-color)] pb-4 mb-4 shrink-0">
                <h2 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2">
                  Output
                  {activeHistoryId && <span className="text-xs bg-[var(--accent-secondary)] text-white px-2 py-1 rounded-full">History View</span>}
                </h2>
                <div className="flex gap-4">
                  {activeChunks.length > 0 && (
                    <>
                      <button
                        onClick={() => downloadTranscription('txt', activeChunks, activeFilename)}
                        className="flex items-center gap-2 text-sm font-bold text-[var(--accent-color)] hover:underline"
                      >
                        <Download size={16} /> .TXT
                      </button>
                      <button
                        onClick={() => downloadTranscription('srt', activeChunks, activeFilename)}
                        className="flex items-center gap-2 text-sm font-bold text-[var(--accent-color)] hover:underline"
                      >
                        <Download size={16} /> .SRT
                      </button>
                      {!activeHistoryId && (
                        <button
                          onClick={clearTranscription}
                          className="flex items-center gap-2 text-sm font-bold text-[var(--text-muted)] hover:text-red-500 transition-colors ml-2"
                          title="Clear Output"
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto font-mono text-sm leading-relaxed space-y-4 pr-2 custom-scrollbar">
                {transcriptionStatus === 'idle' && activeChunks.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-50">
                    <Settings size={48} className="mb-4" />
                    <p>Awaiting configuration...</p>
                  </div>
                )}

                {transcriptionStatus === 'error' && !activeHistoryId && (
                  <div className="p-4 bg-red-500/10 border-2 border-red-500 text-red-500 flex items-start gap-3">
                    <AlertCircle className="shrink-0" />
                    <p className="font-bold">{errorMsg}</p>
                  </div>
                )}

                {activeChunks.length > 0 && (
                  <div className="space-y-2 pb-4">
                    {activeChunks.map((chunk: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-4 hover:bg-[var(--border-color)]/10 p-2 rounded transition-colors"
                      >
                        <span className="text-[var(--accent-secondary)] shrink-0 w-24">
                          [{formatTime(chunk.timestamp[0])}]
                        </span>
                        <span className="text-[var(--text-color)]">{chunk.text}</span>
                      </motion.div>
                    ))}
                    <div ref={outputEndRef} />
                  </div>
                )}

                {transcriptionStatus === 'processing' && !activeHistoryId && (
                  <div className="flex flex-col items-center justify-center gap-4 text-[var(--accent-color)] mt-8 animate-pulse pb-8">
                    <Loader2 className="animate-spin" size={32} />
                    <div className="text-center space-y-1">
                      <p className="font-bold text-lg">
                        {processingStage === 'decoding' ? 'Decoding Audio...' : 'Transcribing Audio...'}
                      </p>
                      {processingStage === 'transcribing' && (
                        <p className="font-mono text-sm font-bold">
                          Chunk {progressStats.completed} / {progressStats.total}
                        </p>
                      )}
                      <p className="font-mono text-sm opacity-70">
                        Elapsed Time: {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{Math.floor(elapsedTime % 60).toString().padStart(2, '0')}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto pt-2">
                        Processing full audio file. This may take a moment depending on file length and device speed.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: History */}
          <div className="lg:col-span-1">
            <div className="card p-6 h-[600px] flex flex-col">
              <h2 className="text-xl font-bold uppercase tracking-wider border-b-2 border-[var(--border-color)] pb-4 mb-4 shrink-0 flex items-center gap-2">
                <Clock size={20} /> History
              </h2>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-50 text-center">
                    <p className="text-sm font-mono">No previous runs yet.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveHistoryId(item.id)}
                      className={cn(
                        "w-full text-left p-3 border-2 transition-all flex flex-col gap-1",
                        activeHistoryId === item.id
                          ? "border-[var(--accent-color)] bg-[var(--accent-color)]/10"
                          : "border-[var(--border-color)] opacity-70 hover:opacity-100"
                      )}
                    >
                      <span className="font-bold text-sm truncate w-full">{item.filename}</span>
                      <span className="text-xs font-mono text-[var(--text-muted)] flex justify-between">
                        {/* make it 12hr format with am pm */}
                        <span>{item.date.toLocaleString('en-US', {
                          hour: 'numeric',
                          minute: 'numeric',
                          hour12: true
                        })}</span>
                        {/* <span>{item.processingTime ? `${Math.floor(item.processingTime / 60)}m ${Math.floor(item.processingTime % 60)}s` : ''}</span> */}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {activeHistoryId && (
                <button
                  onClick={() => setActiveHistoryId(null)}
                  className="mt-4 w-full py-2 border-2 border-[var(--border-color)] font-bold text-sm hover:bg-[var(--border-color)] hover:text-[var(--bg-color)] transition-colors"
                >
                  Return to Current
                </button>
              )}
            </div>
          </div>

        </div>

        <footer className="w-full text-center pt-8 pb-4 border-t-2 border-[var(--border-color)] mt-12">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm font-bold">
            <a
              href="https://rohanprajapati.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--accent-color)] transition-colors"
            >
              Developed by Rohan Prajapati
            </a>
            <a
              href="https://github.com/codeterrayt/SonicScribe"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-[var(--accent-color)] transition-colors"
            >
              <Github size={16} /> Open Source
            </a>
            <button
              onClick={() => setShowPrivacy(true)}
              className="flex items-center gap-2 hover:text-[var(--accent-color)] transition-colors"
            >
              <Shield size={16} /> Privacy Policy
            </button>
          </div>
        </footer>
      </motion.div>

      <AnimatePresence>
        {showPrivacy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPrivacy(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--surface-color)] border-2 border-[var(--border-color)] p-8 max-w-md w-full shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowPrivacy(false)}
                className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--accent-color)]"
              >
                <X size={24} />
              </button>
              <h2 className="text-2xl font-black uppercase mb-4 flex items-center gap-2">
                <Shield className="text-[var(--accent-color)]" /> Privacy Policy
              </h2>
              <p className="font-mono text-sm leading-relaxed">
                We dont collect any data properly.
              </p>
              <p className="mt-4 text-xs text-[var(--text-muted)]">
                All processing happens locally on your device using WebAssembly and WebGPU technologies. Your audio files never leave your browser.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

