const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure the images folder exists
const IMAGES_DIR = path.join(__dirname, 'data', 'images');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Serve static uploaded images
app.use('/uploads', express.static(IMAGES_DIR));

// Serve React client frontend in production
app.use(express.static(path.join(__dirname, '../client/dist')));

// Helper to embellish prompt based on cyberpunk style
function embellishPrompt(prompt, style) {
  const stylePrompts = {
    'Neon-Noir': 'cyberpunk neon-noir style, dark cinematic alley, rainy night with glowing neon signage, reflection on wet ground, highly detailed, 8k resolution',
    'Retro-Futurism': 'retro-futurism sci-fi design, 1980s synthwave aesthetic, analog computer screens, chrome surfaces, grid sunset, highly detailed, conceptual art',
    'Biomechanical': 'biomechanical cybernetic fusion, HR Giger inspired, organic wires and metal plates, glowing cybernetic eyes, dark industrial environment, intricate textures',
    'Mech-Design': 'futuristic mech design, heavy armored warfare, tactical mech unit, decals and wear, sci-fi military hangar, cinematic lighting, conceptual blueprint style',
    'Megacity-Interior': 'megacity cyber-apartment interior, high tech low life, holographic displays, cluttered electronic parts, window overlooking neon skyscrapers'
  };

  const suffix = stylePrompts[style] || 'cyberpunk style, futuristic, concept art, highly detailed';
  return `${prompt}, ${suffix}`;
}

// GET all gallery items
app.get('/api/gallery', async (req, res) => {
  try {
    const images = await db.getAllGenerations();
    res.json({ success: true, data: images });
  } catch (error) {
    console.error('Database fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch gallery.' });
  }
});

// DELETE a gallery item
app.delete('/api/gallery/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const record = await db.getGenerationById(id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }

    // Delete database record
    await db.deleteGeneration(id);

    // Delete image file from disk
    const fileName = path.basename(record.filepath);
    const fullPath = path.join(IMAGES_DIR, fileName);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    res.json({ success: true, message: 'Item deleted successfully.' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete item.' });
  }
});

// GET generate (Server-Sent Events streaming)
app.get('/api/generate', async (req, res) => {
  const { prompt, seed, width = 512, height = 512, style = 'Neon-Noir' } = req.query;

  // Set headers for Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendLog = (stage, message, status = 'processing', progress = 0) => {
    res.write(`data: ${JSON.stringify({ stage, message, status, progress })}\n\n`);
  };

  const sendSuccess = (data) => {
    res.write(`data: ${JSON.stringify({ status: 'success', data })}\n\n`);
    res.end();
  };

  const sendError = (message) => {
    res.write(`data: ${JSON.stringify({ status: 'error', message })}\n\n`);
    res.end();
  };

  // State flags for connection cancellation tracking
  let isCancelled = false;
  const activeTimers = [];
  let fetchController = null;

  req.on('close', () => {
    isCancelled = true;
    console.log('Client aborted connection. Cleaning up generation tasks.');
    activeTimers.forEach(clearTimeout);
    if (fetchController) {
      fetchController.abort();
    }
  });

  // Helper helper to wrap timeouts in cancelled checks
  const runStep = (delay, fn) => {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!isCancelled) {
          fn();
        }
        resolve();
      }, delay);
      activeTimers.push(timer);
    });
  };

  try {
    // Stage 1: Validate prompt input
    await runStep(1000, () => {
      sendLog('ALIGNMENT', 'Establishing neural uplink interface...', 'processing', 10);
    });

    if (!prompt || prompt.trim().length < 3) {
      return sendError('Neural alignment failure: Prompt must be at least 3 characters long.');
    }

    const forbiddenWords = ['nude', 'naked', 'gore', 'kill', 'nsfw'];
    const lowerPrompt = prompt.toLowerCase();
    const hasForbidden = forbiddenWords.some(w => lowerPrompt.includes(w));
    if (hasForbidden) {
      return sendError('Security protocols active: Input violates safety parameters.');
    }

    // Stage 2: Parse and embellish prompt
    await runStep(2000, () => {
      sendLog('PARSING', `Analyzing semantic tokens... applying '${style}' modifiers...`, 'processing', 30);
    });

    const styledPrompt = embellishPrompt(prompt, style);
    const finalSeed = seed && !isNaN(parseInt(seed)) ? parseInt(seed) : Math.floor(Math.random() * 999999);

    // Stage 3: Noise injection
    await runStep(2000, () => {
      sendLog('NOISE_INJECTION', `Injecting noise field with seed: ${finalSeed}...`, 'processing', 50);
    });

    // Stage 4: Call external image generator API (Pollinations.ai)
    await runStep(2500, () => {
      sendLog('DIFFUSION', 'Running U-Net denoising diffusion loop (20/20 steps)...', 'processing', 75);
    });

    if (isCancelled) return;

    fetchController = new AbortController();
    const fetchSignal = fetchController.signal;

    // Timeout external fetch after 15 seconds
    const fetchTimeout = setTimeout(() => {
      fetchController.abort();
    }, 15000);
    activeTimers.push(fetchTimeout);

    // Construct Pollinations.ai API URL
    // nologo=true avoids watermark, private=true prevents indexing
    const apiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(styledPrompt)}?width=${width}&height=${height}&seed=${finalSeed}&nologo=true&private=true`;

    let response;
    try {
      response = await fetch(apiUrl, { signal: fetchSignal });
      clearTimeout(fetchTimeout);
    } catch (fetchErr) {
      clearTimeout(fetchTimeout);
      if (fetchErr.name === 'AbortError') {
        return sendError('Neural core unresponsive: Request timed out after 15s.');
      }
      throw fetchErr;
    }

    if (!response.ok) {
      return sendError(`Neural core returned error state: Status ${response.status}`);
    }

    // Read the returned binary image buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 1000) { // Tiny files indicate corrupt/broken generation
      return sendError('Broken response from neural core: Image structure corrupted.');
    }

    // Stage 5: Save locally and db entries
    await runStep(1500, () => {
      sendLog('VAULT', 'Downloading rendering stream... saving to Server Vault...', 'processing', 90);
    });

    if (isCancelled) return;

    const id = uuidv4();
    const fileName = `${id}.jpg`;
    const relativeFilePath = path.join('data', 'images', fileName);
    const absoluteFilePath = path.join(IMAGES_DIR, fileName);

    // Save image buffer to local filesystem
    fs.writeFileSync(absoluteFilePath, buffer);

    // Save metadata record in SQLite
    const savedRecord = await db.saveGeneration({
      id,
      prompt,
      seed: finalSeed,
      width: parseInt(width),
      height: parseInt(height),
      filepath: `server/${relativeFilePath.replace(/\\/g, '/')}`, // Database relative URL format
      style
    });

    // Stage 6: Completion
    await runStep(1000, () => {
      sendLog('SUCCESS', 'Artifact synthesis complete. Synchronized with terminal cache.', 'success', 100);
    });

    if (isCancelled) return;

    sendSuccess(savedRecord);

  } catch (err) {
    console.error('Server generation error:', err);
    sendError(`Uplink broken: Internal processing fault. Details: ${err.message}`);
  }
});

// For client SPA routes (serve built client index.html if no api matches)
app.get('*', (req, res) => {
  const clientIndex = path.join(__dirname, '../client/dist/index.html');
  if (fs.existsSync(clientIndex)) {
    res.sendFile(clientIndex);
  } else {
    res.status(404).send('Vite build assets missing. Run npm run build in the client.');
  }
});

// Run server and load database
db.initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`  NEURAL CANVAS Express Backend online on port ${PORT} `);
      console.log(`  Serving uploads from: ${IMAGES_DIR} `);
      console.log(`=================================================`);
    });
  })
  .catch((err) => {
    console.error('Unable to start application server:', err);
    process.exit(1);
  });
