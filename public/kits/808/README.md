# 808 Sample Kit

The drum machine works **out of the box** using the built-in synthesized
voices (Kit → "Synth 808"). To use real 808 samples instead, drop eight
WAVs named exactly as below into this directory:

```
kick.wav
snare.wav
clap.wav
c-hat.wav
o-hat.wav
low-tom.wav
mid-tom.wav
hi-tom.wav
```

Then pick **"TR-808 (samples)"** in the drum machine's kit picker.

Any missing file falls back to the synth voice automatically (see
`lib/audio/drum-engine.ts` → `loadKit`), so partial kits work too.

## Suggested CC0 / free sources

- [BPB Cassette 808](https://bedroomproducersblog.com/2016/10/26/free-808-samples/) (CC0)
- [BVKER Free 909 Samples](https://bvker.com/free-909-samples/) (for a 909 variant)
- [808TK SFZ repository](https://github.com/sourc3array/genAudio_808TK_SFZ)

None of these are redistributed in this repo — download directly from the
source and comply with each project's license before committing.
