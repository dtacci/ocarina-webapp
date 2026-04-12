/**
 * Default Ocarina config structure matching pi/config.yaml.
 * Used as template for the config manager UI.
 */

export interface ConfigField {
  key: string;
  label: string;
  description: string;
  type: "string" | "number" | "boolean" | "select";
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

export interface ConfigSection {
  id: string;
  label: string;
  description: string;
  fields: ConfigField[];
}

export const configSections: ConfigSection[] = [
  {
    id: "voice",
    label: "Voice Input",
    description: "How voice commands are triggered and processed",
    fields: [
      { key: "voice.input_mode", label: "Input Mode", description: "How voice commands are triggered", type: "select", options: ["always_on", "push_to_talk", "wake_word"] },
      { key: "voice.wake_word", label: "Wake Word", description: "Trigger phrase (when input_mode = wake_word)", type: "string" },
      { key: "voice.concurrent_speech", label: "Concurrent Speech", description: "Allow voice commands while music is playing", type: "boolean" },
      { key: "voice.vad_pause_during_synthesis", label: "Pause VAD During Synthesis", description: "Prevent false triggers from speaker bleed", type: "boolean" },
    ],
  },
  {
    id: "whisper",
    label: "Speech Recognition",
    description: "Whisper model and inference settings",
    fields: [
      { key: "whisper.model", label: "Model", description: "Bigger = more accurate but slower", type: "select", options: ["tiny.en", "base.en", "distil-small.en", "small.en", "distil-medium.en"] },
      { key: "whisper.compute_type", label: "Compute Type", description: "Quantization for faster-whisper", type: "select", options: ["int8", "float32"] },
    ],
  },
  {
    id: "vad",
    label: "Voice Activity Detection",
    description: "Sensitivity and timing for speech detection",
    fields: [
      { key: "vad.aggressiveness", label: "Aggressiveness", description: "0 = least aggressive, 3 = most aggressive", type: "number", min: 0, max: 3, step: 1 },
      { key: "vad.silence_duration", label: "Silence Duration (s)", description: "Seconds of silence before processing", type: "number", min: 0.1, max: 3.0, step: 0.1 },
      { key: "vad.min_speech_duration", label: "Min Speech Duration (s)", description: "Filters clicks, pops, bumps", type: "number", min: 0.1, max: 2.0, step: 0.1 },
      { key: "vad.max_speech_duration", label: "Max Speech Duration (s)", description: "Safety cutoff", type: "number", min: 5.0, max: 30.0, step: 1.0 },
      { key: "vad.frame_ms", label: "Frame Size (ms)", description: "VAD frame size", type: "select", options: ["10", "20", "30"] },
    ],
  },
  {
    id: "tts",
    label: "Text-to-Speech",
    description: "Voice feedback settings",
    fields: [
      { key: "tts.enabled", label: "Enabled", description: "Enable/disable TTS responses", type: "boolean" },
      { key: "tts.backend", label: "Backend", description: "TTS engine", type: "select", options: ["piper", "kokoro", "elevenlabs"] },
      { key: "tts.piper_voice", label: "Piper Voice", description: "Voice model for Piper backend", type: "string" },
      { key: "tts.cache_common", label: "Cache Common Phrases", description: "Pre-generate common phrases on startup", type: "boolean" },
      { key: "tts.ducking.enabled", label: "Audio Ducking", description: "Lower music volume during TTS", type: "boolean" },
      { key: "tts.ducking.duck_level", label: "Duck Level", description: "Music volume during TTS (0.0-1.0)", type: "number", min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: "llm",
    label: "LLM Fallback",
    description: "AI model for intent extraction when fuzzy match fails",
    fields: [
      { key: "llm.enabled", label: "Enabled", description: "Enable LLM fallback", type: "boolean" },
      { key: "llm.model", label: "Model", description: "Ollama model for intent extraction", type: "select", options: ["qwen3:4b", "qwen2.5:3b", "phi3:3.8b", "gemma2:2b", "llama3.2:3b"] },
      { key: "llm.thermal.warning", label: "Thermal Warning (°C)", description: "Log warning threshold", type: "number", min: 50, max: 90, step: 1 },
      { key: "llm.thermal.critical", label: "Thermal Critical (°C)", description: "Skip inference threshold", type: "number", min: 60, max: 95, step: 1 },
    ],
  },
  {
    id: "audio",
    label: "Audio Hardware",
    description: "Microphone and audio feedback settings",
    fields: [
      { key: "audio.input_device", label: "Input Device", description: "ALSA device for microphone", type: "string" },
      { key: "audio.sample_rate", label: "Sample Rate (Hz)", description: "Voice capture sample rate", type: "select", options: ["8000", "16000", "22050", "44100"] },
      { key: "audio.channels", label: "Channels", description: "Audio channels", type: "select", options: ["1", "2"] },
      { key: "audio.ding.enabled", label: "Ding Feedback", description: "Audio feedback on speech detection", type: "boolean" },
      { key: "audio.ding.frequency", label: "Ding Frequency (Hz)", description: "Ding tone frequency", type: "number", min: 220, max: 2000, step: 10 },
      { key: "audio.ding.duration_ms", label: "Ding Duration (ms)", description: "Ding tone length", type: "number", min: 50, max: 500, step: 10 },
    ],
  },
  {
    id: "serial",
    label: "Serial Communication",
    description: "Teensy USB connection settings",
    fields: [
      { key: "serial.port", label: "USB Port", description: "Serial port for Teensy", type: "string" },
      { key: "serial.baudrate", label: "Baud Rate", description: "Communication speed", type: "select", options: ["9600", "57600", "115200"] },
      { key: "serial.reconnect_interval", label: "Reconnect Interval (s)", description: "Auto-reconnect delay", type: "number", min: 1, max: 30, step: 1 },
    ],
  },
  {
    id: "karaoke",
    label: "Karaoke Mode",
    description: "Song catalog, pitch, and vocal guide settings",
    fields: [
      { key: "karaoke.enabled", label: "Enabled", description: "Enable karaoke mode", type: "boolean" },
      { key: "karaoke.default_pitch_offset", label: "Default Pitch Offset", description: "Semitones from original key", type: "number", min: -6, max: 6, step: 1 },
      { key: "karaoke.voice_passthrough", label: "Voice Pass-through", description: "Route voice through Teensy during karaoke", type: "boolean" },
      { key: "karaoke.voice_mode", label: "Voice FX Mode", description: "Voice effect during karaoke", type: "select", options: ["dry", "harmony", "distort"] },
      { key: "karaoke.suggestion_count", label: "Suggestion Count", description: "Songs to suggest at a time", type: "number", min: 1, max: 10, step: 1 },
      { key: "karaoke.guide.enabled", label: "Vocal Guide", description: "Enable vocal guide by default", type: "boolean" },
      { key: "karaoke.guide.volume", label: "Guide Volume", description: "Guide volume relative to backing", type: "number", min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: "navigation",
    label: "Navigation",
    description: "Browsing and instrument cycling behavior",
    fields: [
      { key: "navigation.announce_on_browse", label: "Announce on Browse", description: "TTS announces name when cycling instruments", type: "boolean" },
      { key: "navigation.suggest_filter_threshold", label: "Filter Suggestion Threshold", description: "After N consecutive presses, hint to use voice filtering", type: "number", min: 3, max: 20, step: 1 },
    ],
  },
  {
    id: "madlibs",
    label: "Mad Libs",
    description: "Voice-assisted word game settings",
    fields: [
      { key: "madlibs.enabled", label: "Enabled", description: "Enable Mad Libs mode", type: "boolean" },
      { key: "madlibs.llm_stories", label: "LLM Stories", description: "Allow AI-generated stories", type: "boolean" },
      { key: "madlibs.require_confirmation", label: "Require Confirmation", description: "Yes/no after each answer (recommended for kids)", type: "boolean" },
    ],
  },
  {
    id: "logging",
    label: "Logging",
    description: "Debug and diagnostic settings",
    fields: [
      { key: "logging.level", label: "Log Level", description: "Minimum log level", type: "select", options: ["DEBUG", "INFO", "WARNING", "ERROR"] },
    ],
  },
];

/** Default config values matching pi/config.yaml defaults */
export const defaultConfig: Record<string, unknown> = {
  "voice.input_mode": "always_on",
  "voice.wake_word": "hey ola",
  "voice.concurrent_speech": true,
  "voice.vad_pause_during_synthesis": false,
  "whisper.model": "base.en",
  "whisper.compute_type": "int8",
  "vad.aggressiveness": 2,
  "vad.silence_duration": 0.6,
  "vad.min_speech_duration": 0.3,
  "vad.max_speech_duration": 15.0,
  "vad.frame_ms": "30",
  "tts.enabled": true,
  "tts.backend": "piper",
  "tts.piper_voice": "en_US-libritts_r-medium",
  "tts.cache_common": true,
  "tts.ducking.enabled": true,
  "tts.ducking.duck_level": 0.3,
  "llm.enabled": true,
  "llm.model": "qwen3:4b",
  "llm.thermal.warning": 70.0,
  "llm.thermal.critical": 80.0,
  "audio.input_device": "plughw:CARD=Lite,DEV=0",
  "audio.sample_rate": "16000",
  "audio.channels": "1",
  "audio.ding.enabled": true,
  "audio.ding.frequency": 880,
  "audio.ding.duration_ms": 100,
  "serial.port": "/dev/ttyACM0",
  "serial.baudrate": "115200",
  "serial.reconnect_interval": 5,
  "karaoke.enabled": true,
  "karaoke.default_pitch_offset": 0,
  "karaoke.voice_passthrough": true,
  "karaoke.voice_mode": "dry",
  "karaoke.suggestion_count": 5,
  "karaoke.guide.enabled": false,
  "karaoke.guide.volume": 0.3,
  "navigation.announce_on_browse": true,
  "navigation.suggest_filter_threshold": 5,
  "madlibs.enabled": true,
  "madlibs.llm_stories": true,
  "madlibs.require_confirmation": true,
  "logging.level": "INFO",
};

/** Convert flat dot-notation config to nested YAML-compatible object */
export function toNestedConfig(flat: Record<string, unknown>): Record<string, unknown> {
  const nested: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let current: Record<string, unknown> = nested;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) current[parts[i]] = {};
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
  return nested;
}
