/* ============================================================
   CLASSROOM BACKGROUND - drifting particles
   ------------------------------------------------------------
   The classroom pages had three different backgrounds:

     classroom-teacher / classroom-student   gradient + shapes + particles
     aiquiz, bingo, scramble, tug            gradient + shapes
     heist, trust, reading, listening        nothing at all

   So the same app looked like three products depending on which
   game a teacher happened to open, which is what "the background
   for them seems different" meant. The gradient and the floating
   shapes are pure CSS and already live in classroom/css/styles.css,
   which every one of these pages loads - they only ever needed the
   markup. The particles are canvas, and the drawing code sat inside
   classroom/js/teacher.js and classroom/js/student.js where the
   other pages could not reach it. This is that code, lifted out so
   the rest of the family can load it.

   The two original pages keep their own copies and must NOT load
   this file as well, or the canvas would be animated twice.

   Behaviour is deliberately unchanged from the original: 50 dots,
   the same four palette colours, lines drawn between any pair
   closer than 120px. Three guards are added, because this now runs
   on the machine driving a projector in front of a room:

     - it stops when the tab is hidden, instead of drawing frames
       nobody is looking at
     - it honours prefers-reduced-motion by drawing one static
       frame rather than animating
     - the resize handler is throttled to a frame

   Self-starting, and silent when there is no canvas on the page.
   ============================================================ */
(function () {
  'use strict';

  function init() {
    var canvas = document.getElementById('particles-bg');
    if (!canvas || canvas.getAttribute('data-particles') === 'on') return;
    canvas.setAttribute('data-particles', 'on');

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var COUNT = 50;
    var LINK = 120;
    var COLORS = ['#3b82f6', '#2563eb', '#2563eb', '#10b981'];
    var particles = [];
    var running = false;
    var frame = null;

    function size() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function reset(p) {
      p.x = Math.random() * canvas.width;
      p.y = Math.random() * canvas.height;
      p.size = Math.random() * 3 + 1;
      p.speedX = (Math.random() - 0.5) * 0.5;
      p.speedY = (Math.random() - 0.5) * 0.5;
      p.opacity = Math.random() * 0.5 + 0.2;
      p.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      return p;
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var i, j, p, p1, p2, dx, dy, dist;

      for (i = 0; i < particles.length; i++) {
        p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) reset(p);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      for (i = 0; i < particles.length; i++) {
        p1 = particles[i];
        for (j = i + 1; j < particles.length; j++) {
          p2 = particles[j];
          dx = p1.x - p2.x;
          dy = p1.y - p2.y;
          dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba(59, 130, 246, ' + (0.1 * (1 - dist / LINK)) + ')';
            ctx.stroke();
          }
        }
      }
    }

    function loop() {
      draw();
      frame = window.requestAnimationFrame(loop);
    }

    function start() {
      if (running) return;
      running = true;
      frame = window.requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (frame) window.cancelAnimationFrame(frame);
      frame = null;
    }

    size();
    for (var k = 0; k < COUNT; k++) particles.push(reset({}));

    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      draw();
    } else {
      start();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else start();
      });
    }

    var pending = false;
    window.addEventListener('resize', function () {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(function () {
        pending = false;
        size();
        if (still) draw();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
