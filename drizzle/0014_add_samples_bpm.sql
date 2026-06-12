-- Samples gain a bpm tag so loops polished in the sample editor keep their
-- tempo: the DJ deck beat-loop buttons and the browser's bpm readout work on
-- edited samples exactly like on recordings. Nullable — one-shots stay null.
ALTER TABLE samples ADD COLUMN IF NOT EXISTS bpm integer;
