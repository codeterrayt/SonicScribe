# [SonicScribe](https://sonicscribe.rohanprajapati.dev/)

Professional-grade, **on-device transcription** for creators.

SonicScribe runs speech-to-text directly in your browser using **Transformers.js Whisper models** (CPU/WASM or **WebGPU**). Your media stays on your machine for maximum privacy.
<img width="1905" height="1174" alt="sonicscribe rohanprajapati dev_" src="https://github.com/user-attachments/assets/8b3d9e0e-aefa-4777-adb9-d957115ee71e" />


## Hosted URL
[Sonic Scribe](https://sonicscribe.rohanprajapati.dev/)

## Why SonicScribe

- **Privacy-first**
  Your audio/video is processed locally in the browser.
- **Fast on modern hardware**
  WebGPU acceleration can be significantly faster than CPU/WASM.
- **Creator-friendly output**
  Export transcripts as `.txt` and subtitles as `.srt`.
- **Built-in history**
  Quickly revisit previous transcriptions in the same session.
- **Three UI themes**
  Switch between multiple visual styles.

## What it supports

- **Media upload**
  Accepts common audio and video formats (the UI allows uploading audio/* and video/*; examples include MP3, WAV, MP4, WEBM).
- **Chunked transcription**
  Long files are processed in ~30s chunks with progress reporting.
- **Devices**
  CPU (WASM) works everywhere; WebGPU is enabled when your browser/device supports it.

## Tech stack

- **React + Vite**
- **Transformers.js** (`@huggingface/transformers`) for on-device ASR
- **Tailwind CSS** for styling

## Prerequisites

- **Node.js** (LTS recommended)
- **npm** (bundled with Node.js)

## Installation

```bash
pnpm install
```

## Configuration

No environment variables are required for basic usage.

## Run locally

```bash
pnpm run dev
```

Then open:

- `http://localhost:3000`

## Build

```bash
pnpm run build
```

## Preview production build

```bash
pnpm run preview
```

## Usage

1. Select a model and click **Load Model** (first run downloads model weights; this can be large depending on the model).
2. Upload an audio/video file.
3. Click **Transcribe**.
4. Download output as `.txt` or `.srt`.

## Performance notes

- Model downloads can be **hundreds of MB** depending on selection.
- WebGPU support depends on browser and GPU. If unavailable, SonicScribe falls back to CPU/WASM.

## Contributing

Contributions are invited and appreciated.

### Ways to help

- **Bug reports**
  Include repro steps, browser/OS, and a sample file description (avoid sharing sensitive media).
- **Feature requests**
  Share the use-case and expected output format.
- **Pull requests**
  Fix bugs, improve UX, add export formats, extend model support, or polish docs.

### Development workflow

```bash
# Run dev server
pnpm run dev

# Typecheck
pnpm run lint

# Production build
pnpm run build
```

### PR checklist

- Keep changes focused and easy to review.
- Include screenshots for UI changes.
- Ensure `pnpm run lint` passes.

## License

This project is open source. Add a `LICENSE` file to define the license for the repository.
