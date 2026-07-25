LINGUALAB - one-page showcase site (for GOOGLE SITES)
=====================================================

File you need:
  index.html   ->  the whole website in one self-contained file
                   (all CSS + JS inline, no external images; only
                   Google Fonts load over the web).

This is a standalone marketing page. It is NOT part of the Firebase
app in y/.


PUT IT ON GOOGLE SITES
----------------------
Google Sites shows custom HTML through an "Embed code" block.

1. Open your site at https://sites.google.com  and edit the page.

2. Right sidebar:  Insert  ->  Embed  ->  choose the "Embed code" tab.

3. Open index.html in a text editor, copy ALL of it, and paste it into
   the Embed-code box.  Click NEXT, then INSERT.

4. IMPORTANT - size the block to ABOUT ONE SCREEN, not the whole page.
   Drag it to full width, and set the height to roughly 700px (about the
   height of one screen). The landing page then scrolls INSIDE the block.

   Why one screen and not tall: Google Sites shows the page in a fixed-size
   iframe. If you drag it very tall, the Google Sites page is what scrolls,
   so the sticky top menu scrolls out of view and anything past the bottom
   edge gets cut off. At about one screen the page scrolls itself, the top
   menu stays pinned, and the menu links jump to the right sections.

5. Publish (top-right).  Done.

WHITE SHOWING AROUND THE BLOCK?  (read this)
--------------------------------------------
The embed is a fixed-size box sitting on the Google Sites page. Google
Sites pages are WHITE by default, so you see white above, below and beside
the dark block. That white is the Sites page - it cannot be fixed from
inside index.html, because the HTML only controls the inside of the box.

Fix it on the Google Sites side:

  A) Set the SECTION background to dark.
     Hover over the section that holds the embed -> click the paint-roller
     ("Background") icon on the left -> Image -> Upload ->
     choose  sites-background.png  (included in this folder: a solid
     #070b14 image that matches the site exactly).
     Do this for every section that shows white.

  B) Remove the extra sections.
     Delete any empty sections above/below the embed so the page is just
     the embed, then the white strip disappears with them.

  C) Optional - a dark site theme.
     Themes -> pick a dark theme (or Custom -> dark background) so the
     whole Sites page, including the header area, is dark.

Inside the embed itself there is nothing white: the page pins its own
background to #070b14 and forces a DARK scrollbar (color-scheme: dark).
Without that, the browser draws a light grey scrollbar down the right edge
of the embed, which also reads as a white stripe.


Tip - cleaner layout: if you would rather use Google Sites' own spacing
between sections, you can split the page: each block in index.html is
marked "COMPONENT N" in the code. You can paste sections into separate
Embed blocks and arrange them with Google Sites sections in between.
For most people, one full embed (steps above) is simplest.


THE 10+ COMPONENTS (all custom-built, no external libraries)
------------------------------------------------------------
  1  Aurora + dot-grid animated background
  2  Glass sticky nav with a shine-swept logo
  3  Hero with an animated word-rotator headline + shine CTA button
  4  3D tilt + cursor spotlight on the app mock-up
  5  Infinite marquee (the games ticker)
  6  Count-up statistics band
  7  Bento feature grid with cursor-spotlight tiles
  8  Animated rotating gradient-border showcase card (Writing AI)
  9  Tabbed panel (For students / For teachers)
 10  "How it works" steps with an animated light beam
 11  Value / testimonial cards with hover lift
 12  Accordion FAQ
 13  Shine CTA + mailto contact


EDITING
-------
- Contact button emails akabiriaslifar@fsm.edu.tr. To change it, search
  index.html for "akabiriaslifar" and replace both spots.
- The testimonial section (COMPONENT 11) uses illustrative copy - swap in
  real quotes when you have them (search for "COMPONENT 11").
- Do NOT add a <base target="_top"> tag. Inside the Google Sites iframe it
  makes every "#section" menu link try to move the parent page, so the top
  menu stops working. The page scrolls itself with a click handler instead,
  and the email links carry their own target="_top".

PREVIEW LOCALLY
---------------
Just open index.html in any browser to see exactly how it will look.
