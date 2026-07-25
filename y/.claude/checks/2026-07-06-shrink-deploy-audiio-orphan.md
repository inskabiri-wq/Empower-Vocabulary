# 2026-07-06: shrink the Firebase Hosting deploy (storage full)

## Real cause (measured, not assumed)
User asked to "get 2 readings per level out of storage to make it deployable."
Measured the actual DEPLOYED footprint (applying firebase.json ignore):
- All 46 reading exam JSON = 744 KB total. Trimming them saves ~nothing.
- student/data/readings is 11 MB but that is the .doc/.docx SOURCE files, already
  ignored (**/*.doc, **/*.docx) - they never deployed.
- The real weight was AUDIO:
  * "Audiio Files/" (22 MB) - a MISSPELLED stray SOURCE folder holding the raw
    21 MB uncompressed listening audio + an answer-key PDF + transcript. NOT in
    the ignore list, so it shipped in every deploy. Nothing in the app references
    it (grep clean); the listening exam uses student/audio/listening-exam-1.mp3.
  * student/audio/listening-exam-1.mp3 (11 MB) - the real, compressed listening
    audio (its *-part2.mp3 is already ignored).

## Fix (firebase.json hosting.ignore, deploy-config only)
Added: "Audiio Files/**" and "**/*.pdf" (verified no PDF is served by the app;
the only PDFs are the two source answer keys inside Audiio Files).
Deployed size: ~42 MB -> 20 MB (halved). Zero app/content impact; reversible.
No JS/SW/version change needed (firebase.json is not a served asset).

## Not done (surfaced instead)
- Did NOT delete reading exams: they are 744 KB and deleting content would lose
  material for no storage gain. The user's premise (readings = the problem) is
  contradicted by the data.
- Did NOT delete the "Audiio Files" folder from disk/repo: it still holds the raw
  audio + the ONLY copy of the answer-key PDF + transcript. Offered as a
  confirmed follow-up to reclaim local/repo space.
- The 11 MB listening audio is now >half the deploy; offered to re-encode it
  smaller with the vendored ffmpeg if the deploy is still too large.

## Ritual
firebase.json valid JSON (11 ignore entries). No deploy / no push (user deploys).
