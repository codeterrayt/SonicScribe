import { pipeline, env, type PipelineType } from '@huggingface/transformers';

// Disable local models
env.allowLocalModels = false;
// Use the Cache API to cache models
env.useBrowserCache = true;

class PipelineSingleton {
  static task: PipelineType = 'automatic-speech-recognition';
  static instance: any = null;
  static model: string = '';
  static device: string = '';

  static async getInstance(model: string, device: string, progress_callback: any = null) {
    if (this.instance === null || this.model !== model || this.device !== device) {
      this.model = model;
      this.device = device;

      this.instance = await pipeline(this.task, model, {
        device: device as any,
        progress_callback,
        dtype: 'q4', // Use q4 for both to keep it simple/small
      });
    }
    return this.instance;
  }
}

let availableDevice = 'wasm';

self.addEventListener('message', async (event) => {
  const message = event.data;

  if (message.type === 'check_gpu') {
    try {
      if ((navigator as any).gpu) {
        const adapter = await (navigator as any).gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (adapter) {
          availableDevice = 'webgpu';
        }
      }
    } catch (e) {
      // Ignore errors, fallback to wasm
    }
    self.postMessage({ type: 'gpu_status', device: availableDevice });
  } else if (message.type === 'load') {
    try {
      // Use the requested device, or fallback to the best available
      const deviceToUse = message.device || availableDevice;
      
      await PipelineSingleton.getInstance(message.model, deviceToUse, (data: any) => {
        self.postMessage({ type: 'progress', data });
      });
      self.postMessage({ type: 'ready' });
    } catch (error: any) {
      self.postMessage({ type: 'error', error: error.message });
    }
  } else if (message.type === 'transcribe') {
    try {
      const deviceToUse = message.device || availableDevice;
      const transcriber = await PipelineSingleton.getInstance(message.model, deviceToUse);

      const output = await transcriber(message.audio, {
        return_timestamps: true,
      });

      self.postMessage({ 
        type: 'complete', 
        data: { ...output, index: message.index, offset: message.offset } 
      });
    } catch (error: any) {
      self.postMessage({ type: 'error', error: error.message });
    }
  }
});
