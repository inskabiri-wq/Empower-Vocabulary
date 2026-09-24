# Lingualab image slots

Every image the app can show lives in this folder, named after **where it is
used**. Nothing here is required: if a file is missing, that surface falls back
to the design it has today. So:

| you want to            | do this                                                      |
| ---------------------- | ------------------------------------------------------------ |
| **add** an image       | drop a file in with the exact base name below                 |
| **replace** an image   | overwrite the file, keep the name                             |
| **remove** an image    | delete the file - the surface reverts to its current look     |

Any of these extensions work, tried in this order:
`.webp` `.jpg` `.jpeg` `.png` `.svg`
So `skill-tile-reading.jpg` and `skill-tile-reading.webp` are both picked up.
Prefer **.webp** (same quality, roughly a third of the bytes on a phone).

After adding or removing files, run:

    node y/tools/bump.js y/img

so returning students stop getting the old cached version.

---

## skill-tiles/ - the six skill cards on the student hub

Shown behind the tile at low opacity, under a scrim, so the tile text stays
readable. These are the images students see most often.

| file                          | tile on the hub |
| ----------------------------- | --------------- |
| `skill-tile-reading.*`        | Reading         |
| `skill-tile-listening.*`      | Listening       |
| `skill-tile-writing.*`        | Writing         |
| `skill-tile-grammar.*`        | Grammar         |
| `skill-tile-speaking.*`       | Speaking        |
| `skill-tile-vocabulary.*`     | Vocabulary      |
| `skill-tile-classroom.*`      | Classroom Mode  |
| `skill-tile-placement.*`      | Placement test  |

The file name after `skill-tile-` is the skill's own id, so if a new skill is
added later its image is `skill-tile-<id>.*` with no code change.

**Recommended:** 800 x 600 or wider, landscape, under 120 KB each.
They are drawn at low opacity behind text, so pick images that are **simple and
low contrast**. A busy photo turns into noise at 14% opacity. Something with one
clear subject and open space works best.

---

## Not wired up yet

These folders are reserved. Putting a file in them does nothing until the
matching surface is wired, which has not been done:

- `hero/` - a banner behind the sign-in card on the login page
- `certificate/` - a background for the printed course certificate

Ask before relying on either.

---

## Before you use a photo

- **Student faces need written consent.** A photo of a recognisable student
  cannot go in the app without it.
- **University photos need permission** from whoever owns them.
- **Stock images need a licence** that covers a public web app. "Found on
  Google" is not a licence.
- Safest options: photographs you took yourself, or properly licensed stock.

## How the loading works

`y/js/tile-images.js` asks the browser to load each candidate file and only
applies one that actually loaded, so a missing file never leaves a broken image
on screen. The result is remembered for the session, so the check happens once
per tab rather than on every render.

A file that is absent produces one failed request in the browser console. That
is expected and harmless - it is how the fallback is detected.
