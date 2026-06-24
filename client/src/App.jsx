import React, { useState, useEffect, useRef } from 'react';

const STYLES = [
  { name: 'Neon-Noir', desc: 'Dark streets, rain, neon glows.' },
  { name: 'Retro-Futurism', desc: '80s synthwave, grid horizons, chrome.' },
  { name: 'Biomechanical', desc: 'Cybernetic wires, metal plates, HR Giger.' },
  { name: 'Mech-Design', desc: 'Heavy battle mechs, hangars, decals.' },
  { name: 'Megacity-Interior', desc: 'Dystopian apartments, holo displays, wires.' }
];

export default function App() {
  // Config state
  const [prompt, setPrompt] = useState('Cybernetic mercenary standing in a rain-slicked neon alleyway');
  const [style, setStyle] = useState('Neon-Noir');
  const [seed, setSeed] = useState('');
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);

  // App running states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationLogs, setGenerationLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [activeImage, setActiveImage] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [terminalStatus, setTerminalStatus] = useState('SYSTEM READY');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const eventSourceRef = useRef(null);
  const logFeedEndRef = useRef(null);
  const promptInputRef = useRef(null);

  // Fetch gallery on startup
  useEffect(() => {
    fetchGallery();
  }, []);

  // Auto scroll terminal logs
  useEffect(() => {
    if (logFeedEndRef.current) {
      logFeedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [generationLogs]);

  const fetchGallery = async () => {
    try {
      const res = await fetch('/api/gallery');
      const json = await res.json();
      if (json.success) {
        setGallery(json.data);
      }
    } catch (err) {
      console.error('Failed to load gallery:', err);
      addTerminalLog('SYSTEM', 'Failure connecting to local storage archive.', 'error');
    }
  };

  const addTerminalLog = (stage, message, status = 'info') => {
    const timeStr = new Date().toLocaleTimeString();
    setGenerationLogs((prev) => [
      ...prev,
      { id: Math.random().toString(), time: timeStr, stage, message, status }
    ]);
  };

  // Convert db filepath (e.g. server/data/images/...) to static server endpoint (/uploads/...)
  const getImageUrl = (filepath) => {
    if (!filepath) return '';
    return filepath.replace('server/data/images/', '/uploads/');
  };

  const handleGenerate = (e) => {
    if (e) e.preventDefault();

    if (!prompt.trim() || prompt.trim().length < 3) {
      setErrorMsg('Prompt too short: Enter at least 3 characters.');
      setTerminalStatus('TERMINAL ERROR');
      addTerminalLog('ALIGNMENT', 'Prompt length check failed. Input denied.', 'error');
      return;
    }

    // Reset states
    setIsGenerating(true);
    setErrorMsg('');
    setProgress(0);
    setTerminalStatus('CONNECTING');
    setGenerationLogs([]);

    addTerminalLog('ALIGNMENT', 'Initiating generator uplink protocol...', 'info');

    // Build URL query string
    const queryParams = new URLSearchParams({
      prompt,
      style,
      width,
      height,
      seed: seed.trim()
    });

    // Open connection
    const eventSource = new EventSource(`/api/generate?${queryParams.toString()}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.status === 'success') {
          // Finish generation
          setActiveImage(data.data);
          fetchGallery(); // Refresh gallery state from database
          setIsGenerating(false);
          setTerminalStatus('SYNTHESIS COMPLETE');
          addTerminalLog('SYSTEM', 'Image sync complete. Saved in gallery.', 'success');
          eventSource.close();
        } else if (data.status === 'error') {
          // Process error
          setErrorMsg(data.message);
          setIsGenerating(false);
          setTerminalStatus('TERMINAL ERROR');
          addTerminalLog('SYSTEM', `Core error: ${data.message}`, 'error');
          eventSource.close();
        } else {
          // Progress step log
          setProgress(data.progress || 0);
          setTerminalStatus(data.stage || 'PROCESSING');
          addTerminalLog(data.stage, data.message, data.status);
        }
      } catch (err) {
        console.error('SSE JSON parse error:', err);
        setErrorMsg('Uplink payload corrupted.');
        setIsGenerating(false);
        setTerminalStatus('TERMINAL ERROR');
        addTerminalLog('PARSING', 'Payload format mismatch: JSON decode failed.', 'error');
        eventSource.close();
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource connection error:', err);
      setErrorMsg('EventSource connection collapsed. Check backend server.');
      setIsGenerating(false);
      setTerminalStatus('TERMINAL ERROR');
      addTerminalLog('UPLINK', 'Uplink sockets severed unexpectedly.', 'error');
      eventSource.close();
    };
  };

  const handleCancel = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      addTerminalLog('CLIENT', 'Generation process aborted by operator.', 'error');
      setTerminalStatus('UPLINK SEVERED');
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleDelete = (id, e) => {
    if (e) e.stopPropagation(); // Avoid triggering card loading
    setConfirmDeleteId(id);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);

    try {
      const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setGallery((prev) => prev.filter((item) => item && item.id !== id));
        addTerminalLog('VAULT', 'Artifact purged from filesystem database.', 'info');
        if (activeImage && activeImage.id === id) {
          setActiveImage(null);
        }
      } else {
        addTerminalLog('VAULT', `Purge protocol failed: ${json.error}`, 'error');
      }
    } catch (err) {
      console.error('Delete fetch error:', err);
      addTerminalLog('VAULT', `Purge protocol breakdown: ${err.message}`, 'error');
    }
  };

  const handleTweak = (item) => {
    if (!item) return;
    setPrompt(item.prompt || '');
    setStyle(item.style || 'Neon-Noir');
    setSeed(item.seed ? item.seed.toString() : '');
    setWidth(item.width || 512);
    setHeight(item.height || 512);
    setActiveImage(item);
    addTerminalLog('TERMINAL', `Loaded parameter frame of artifact [${item.id.slice(0, 8)}] into console.`, 'info');
    
    // Focus the prompt textarea (preventing default jump)
    if (promptInputRef.current) {
      promptInputRef.current.focus({ preventScroll: true });
      // Only scroll to the top of the page if the user is scrolled down (e.g. viewing the gallery)
      if (window.scrollY > 300) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <div>
      <div className="scanlines"></div>

      {/* Top Banner HUD */}
      <header className="app-header">
        <div className="brand">
          <h1>NEURAL <span>CANVAS</span></h1>
          <div className="tagline">UPLINK ACTIVE // v1.0.4</div>
        </div>
        <div className="system-status">
          <div className="status-indicator">
            <div className="status-dot"></div>
            <span>{isGenerating ? 'UPLINK SYNCHRONIZING...' : 'CORE ONLINE'}</span>
          </div>
          <div>VAULT COGNITION: {gallery.length} UNITS</div>
        </div>
      </header>

      <main className="main-wrapper">
        <div className="workspace-grid">
          
          {/* Left panel: Prompt parameters */}
          <section className="cyber-panel">
            <div className="panel-header">
              <span className="panel-title">Neural Input Deck</span>
              <span className="panel-subtitle">COGNITIVE PARAMETERS</span>
            </div>

            <form onSubmit={handleGenerate} className="cyber-panel" style={{ padding: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>
              {/* Prompt Text area */}
              <div className="form-group">
                <label className="form-label">Stylistic Semantic Base</label>
                <textarea
                  ref={promptInputRef}
                  className="cyber-textarea"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your design vision in detail (e.g. humanoid tactical drone)..."
                  disabled={isGenerating}
                />
              </div>

              {/* Styles picker */}
              <div className="form-group">
                <label className="form-label">Style Matrix Filters</label>
                <div className="style-grid">
                  {STYLES.map((s) => (
                    <div
                      key={s.name}
                      className={`style-card ${style === s.name ? 'active' : ''}`}
                      onClick={() => !isGenerating && setStyle(s.name)}
                    >
                      <span className="style-name">{s.name}</span>
                      <span className="style-desc">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seed and Dimensions parameters */}
              <div className="parameter-row">
                <div className="form-group">
                  <label className="form-label">Dimension Width</label>
                  <select
                    className="cyber-input"
                    value={width}
                    onChange={(e) => setWidth(parseInt(e.target.value))}
                    disabled={isGenerating}
                  >
                    <option value="256">256 px (Fast)</option>
                    <option value="512">512 px (Balanced)</option>
                    <option value="768">768 px (High-Res)</option>
                    <option value="1024">1024 px (Full)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Dimension Height</label>
                  <select
                    className="cyber-input"
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value))}
                    disabled={isGenerating}
                  >
                    <option value="256">256 px</option>
                    <option value="512">512 px</option>
                    <option value="768">768 px</option>
                    <option value="1024">1024 px</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Seeding Layer (Numeric Key)</label>
                <input
                  type="text"
                  className="cyber-input"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))}
                  placeholder="Random Layer"
                  disabled={isGenerating}
                />
              </div>

              {/* Buttons */}
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                {!isGenerating ? (
                  <button type="submit" className="cyber-button">
                    <span>⚡ SYNTHESIZE ARTIFACT</span>
                  </button>
                ) : (
                  <button type="button" className="cyber-button secondary" onClick={handleCancel}>
                    <span>🔴 TERMINATE UPLINK</span>
                  </button>
                )}
              </div>
            </form>

            {/* Retro Monitor Log (SSE Stream output) */}
            <div className="form-group">
              <label className="form-label">Generator Terminal Logger</label>
              <div className="terminal-wrapper">
                <div className="terminal-header">
                  <span>LOG STREAM: {terminalStatus}</span>
                  <span>SYS_LOG_ACTIVE</span>
                </div>
                <div className="terminal-log-feed">
                  {generationLogs.length === 0 && (
                    <div className="log-line info">
                      <span className="timestamp">[{new Date().toLocaleTimeString()}]</span>
                      <span>SYSTEM: Waiting for uplink deployment...</span>
                    </div>
                  )}
                  {generationLogs.map((log) => (
                    <div key={log.id} className={`log-line ${log.status}`}>
                      <span className="timestamp">[{log.time}]</span>
                      <span>{log.stage ? `${log.stage}: ` : ''}{log.message}</span>
                    </div>
                  ))}
                  <div ref={logFeedEndRef} />
                </div>
                <div className="terminal-input-row">
                  <span>&gt; {isGenerating ? 'SYNTHESIZING_SEQUENCE_PENDING' : 'OPERATOR_AWAITING_INPUT'}</span>
                  <span className="cursor-blink"></span>
                </div>
              </div>
            </div>
          </section>

          {/* Right panel: Active generation canvas */}
          <section className="cyber-panel magenta">
            <div className="panel-header">
              <span className="panel-title">Holographic Output Canvas</span>
              <span className="panel-subtitle">ACTIVE PREVIEW</span>
            </div>

            <div className="canvas-wrapper">
              {!activeImage && !isGenerating && (
                <div className="canvas-placeholder">
                  <div className="placeholder-icon">📐</div>
                  <div className="placeholder-text">
                    <h3>Canvas Vacant</h3>
                    <p>Load an artifact prompt parameters into the deck or initiate a synthesis cycle to view preview graphics.</p>
                  </div>
                </div>
              )}

              {/* Active Image container */}
              {(activeImage || isGenerating) && (
                <div className="active-image-container">
                  {activeImage && !isGenerating && (
                    <img
                      src={getImageUrl(activeImage?.filepath)}
                      alt={activeImage?.prompt || 'Generated art'}
                      className="active-image"
                    />
                  )}

                  {isGenerating && (
                    <div className="canvas-loading-overlay">
                      <div className="spinner-container">
                        <div className="spinner-ring"></div>
                        <div className="spinner-ring"></div>
                        <div className="spinner-ring"></div>
                        <div className="spinner-ring"></div>
                      </div>
                      <div className="canvas-loading-text">COGNITIVE FLUX ACTIVE: {progress}%</div>
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Image HUD controls */}
              {activeImage && !isGenerating && (
                <div className="image-hud">
                  <a
                    href={getImageUrl(activeImage?.filepath)}
                    download={`neural-canvas-${activeImage?.id || 'export'}.jpg`}
                    target="_blank"
                    rel="noreferrer"
                    className="cyber-button"
                    style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', textDecoration: 'none' }}
                  >
                    💾 EXPORT DATA
                  </a>
                  <button
                    className="cyber-button secondary"
                    onClick={() => handleTweak(activeImage)}
                    style={{ padding: '0.6rem 1rem', fontSize: '0.8rem' }}
                  >
                    ⚙️ TWEAK PROMPT
                  </button>
                </div>
              )}
            </div>
          </section>

        </div>

        {/* Gallery bottom grid */}
        <section className="gallery-section">
          <div className="panel-header">
            <span className="panel-title">Server Storage Vault (Gallery)</span>
            <span className="panel-subtitle">SAVED GENERATIONS</span>
          </div>

          <div className="gallery-grid">
            {gallery.length === 0 ? (
              <div className="gallery-empty">
                VAULT EMPTY. Synthesized creations are preserved server-side automatically here.
              </div>
            ) : (
              gallery.filter(Boolean).map((item) => (
                <div
                  key={item?.id || Math.random().toString()}
                  className="gallery-item"
                  onClick={() => handleTweak(item)}
                >
                  <img
                    src={getImageUrl(item?.filepath)}
                    alt={item?.prompt || 'Gallery artwork'}
                    className="gallery-thumbnail"
                  />
                  <div className="gallery-overlay">
                    <div className="gallery-details">
                      <p className="gallery-prompt">{item?.prompt}</p>
                      <div className="gallery-meta">
                        <span className="badge style">{item?.style || 'Custom'}</span>
                        <span className="badge seed">S: {item?.seed}</span>
                        <span className="badge dimensions">{item?.width}x{item?.height}</span>
                      </div>
                      <div className="gallery-actions">
                        <button
                          className="action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTweak(item);
                          }}
                        >
                          Tweak
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={(e) => handleDelete(item?.id, e)}
                        >
                          Purge
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Cyber modal overlay for purge protocol confirmation */}
      {confirmDeleteId && (
        <div className="cyber-modal-overlay">
          <div className="cyber-modal">
            <div className="panel-header">
              <span className="panel-title text-error">⚠️ SECURITY PROTOCOL: PURGE VAULT</span>
            </div>
            <p className="modal-text">
              Are you sure you want to permanently de-synchronize and purge artifact 
              <span className="text-highlight"> [{confirmDeleteId.slice(0, 8)}] </span> 
              from the server storage vault? This action cannot be reversed.
            </p>
            <div className="modal-actions">
              <button 
                type="button"
                className="cyber-button secondary" 
                onClick={() => setConfirmDeleteId(null)}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
              >
                CANCEL
              </button>
              <button 
                type="button"
                className="cyber-button error-btn" 
                onClick={executeDelete}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
              >
                CONFIRM PURGE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
