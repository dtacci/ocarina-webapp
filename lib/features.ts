/**
 * Feature flags — config-driven toggles for progressive feature rollout.
 * Features behind flags can be developed and deployed without being visible.
 */
export const features = {
  /** v0.1 features — enabled */
  sampleBrowser: true,
  aiSearch: true,
  aiKitBuilder: true,
  kitBrowser: true,
  deviceRegistration: true,
  syncApi: true,
  activityTimeline: true,
  embeddablePlayer: true,

  /** v0.2 features — disabled until ready */
  looperDashboard: false,
  looperDA: true,
  realtimeBridge: false,
  configManager: true,
  recordingLibrary: true,
  sampleEditor: true,
  mp3Transcoding: false,
  piSyncAgent: false,
  analyticsDashboard: true,
  diagnostics: true,
  liveConsole: true,
  karaokeBrowser: true,

  /** v0.3 features — disabled */
  looperWaveforms: false,
  quantizationControls: false,
  sampleDragDrop: false,
  drumPatternEditor: true,
  karaokeDisplay: false,
  lyricsEditor: false,
  shareLinks: false,
  userProfiles: false,
  subscriptionTiers: false,
  pwa: false,
} as const;

export type FeatureFlag = keyof typeof features;

export function isEnabled(flag: FeatureFlag): boolean {
  return features[flag];
}
