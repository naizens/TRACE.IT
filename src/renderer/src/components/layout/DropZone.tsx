import { useRef, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';

export function DropZone() {
  const addSessions   = useStore((s) => s.addSessions);
  const setBoundaries = useStore((s) => s.setBoundaries);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  async function handleOpenFiles() {
    const results = await window.electronAPI.openIbtFiles();
    if (results) {
      addSessions(results);
      const trackId = results[0]?.meta?.track_id;
      if (trackId != null) {
        const b = await window.electronAPI.boundaries.load(trackId);
        setBoundaries(b as import('../../types/session').TrackBoundaries | null);
      }
    }
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith('.ibt')
    );
    if (files.length === 0) return;

    const fileData = await Promise.all(
      files.map(async (f) => ({ name: f.name, data: await f.arrayBuffer() }))
    );

    const results = await window.electronAPI.parseIbtBuffers(fileData);
    if (results) {
      addSessions(results);
      const trackId = results[0]?.meta?.track_id;
      if (trackId != null) {
        const b = await window.electronAPI.boundaries.load(trackId);
        setBoundaries(b as import('../../types/session').TrackBoundaries | null);
      }
    }
  }, [addSessions, setBoundaries]);

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center cursor-pointer select-none bg-bg transition-colors duration-150 ${
        isDragging ? 'bg-accent/5' : ''
      }`}
      onClick={handleOpenFiles}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={`flex flex-col items-center gap-5 px-20 py-16 rounded-2xl border-2 border-dashed transition-all duration-150 pointer-events-none ${
          isDragging ? 'border-accent' : 'border-border'
        }`}
      >
        <ArrowUpTrayIcon
          className={`w-12 h-12 transition-colors duration-150 ${isDragging ? 'text-accent' : 'text-muted'}`}
        />

        <div className="text-center">
          <p className={`font-medium mb-1 transition-colors duration-150 ${isDragging ? 'text-accent' : 'text-text'}`}>
            {isDragging ? 'Release to load' : 'Drop IBT files here'}
          </p>
          <p className="text-muted text-sm">or click to browse</p>
        </div>

        <p className="text-[10px] text-muted uppercase tracking-widest">
          .ibt · iRacing telemetry
        </p>
      </div>
    </div>
  );
}
