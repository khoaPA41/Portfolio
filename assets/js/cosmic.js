/* ==========================================================================
   Cosmic starfield  ·  Bone-on-void  ·  Deep Space Observatory
   Layered parallax stardust, drifting nebula glows, constellation links
   around the cursor, diffraction flares and shooting stars.
   ========================================================================== */
(function initCosmos() {
  "use strict";

  var canvas = document.getElementById("cosmos");
  if (!canvas) return;

  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var isReduced = motionQuery.matches;

  var width = 0;
  var height = 0;
  var dpr = 1;
  var particles = [];
  var meteors = [];
  var rafId = null;
  var lastTime = 0;
  var meteorTimer = 0;
  var timeAcc = 0;

  var mouseX = 0;
  var mouseY = 0;
  var targetX = 0;
  var targetY = 0;
  var cursorX = -9999;
  var cursorY = -9999;
  var pointerActive = false;
  var scrollY = 0;

  /* Bone / champagne / warm dust palette */
  var PALETTE = [
    { rgb: "240, 234, 220", weight: 0.44 }, /* bone bright */
    { rgb: "212, 203, 184", weight: 0.30 }, /* bone mid */
    { rgb: "148, 139, 122", weight: 0.14 }, /* bone dim */
    { rgb: "247, 243, 234", weight: 0.07 }, /* hot pearl */
    { rgb: "217, 176, 108", weight: 0.05 }  /* solar gold */
  ];

  /* Meteor tints: mostly bone, occasionally ice or gold */
  var METEOR_TINTS = [
    { rgb: "247, 243, 234", weight: 0.6 },
    { rgb: "159, 182, 232", weight: 0.22 },
    { rgb: "217, 176, 108", weight: 0.18 }
  ];

  /* Deep-space nebula glows drawn beneath the stars (very subtle) */
  var NEBULAS = [
    { rgb: "88, 108, 176", base: 0.075, rx: 0.34, ry: 0.3,  x: 0.2,  y: 0.24, drift: 0.9,  speed: 0.05 },
    { rgb: "196, 150, 92",  base: 0.06,  rx: 0.3,  ry: 0.26, x: 0.82, y: 0.16, drift: -1.2, speed: 0.04 },
    { rgb: "118, 142, 186", base: 0.05,  rx: 0.26, ry: 0.22, x: 0.55, y: 0.62, drift: 1.6,  speed: 0.035 }
  ];

  var glowSprites = PALETTE.map(function (p) {
    var size = 64;
    var off = document.createElement("canvas");
    off.width = size;
    off.height = size;
    var c = off.getContext("2d");
    if (c) {
      var half = size / 2;
      var g = c.createRadialGradient(half, half, 0, half, half, half);
      g.addColorStop(0, "rgba(" + p.rgb + ", 1)");
      g.addColorStop(0.35, "rgba(" + p.rgb + ", 0.35)");
      g.addColorStop(1, "rgba(" + p.rgb + ", 0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(half, half, half, 0, Math.PI * 2);
      c.fill();
    }
    return off;
  });

  /* Pre-rendered nebula glows: avoids allocating 3 radial gradients every frame. */
  var nebulaSprites = NEBULAS.map(function (n) {
    var size = 256;
    var off = document.createElement("canvas");
    off.width = size;
    off.height = size;
    var c = off.getContext("2d");
    if (c) {
      var g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, "rgba(" + n.rgb + ", " + n.base + ")");
      g.addColorStop(0.55, "rgba(" + n.rgb + ", " + (n.base * 0.4) + ")");
      g.addColorStop(1, "rgba(" + n.rgb + ", 0)");
      c.fillStyle = g;
      c.fillRect(0, 0, size, size);
    }
    return off;
  });

  function pickWeighted(list) {
    var r = Math.random();
    var acc = 0;
    for (var i = 0; i < list.length; i++) {
      acc += list[i].weight;
      if (r < acc) return list[i];
    }
    return list[0];
  }

  function pickPalette() {
    return PALETTE.indexOf(pickWeighted(PALETTE));
  }

  function countFor(w) {
    if (w < 480) return 42;
    if (w < 768) return 54;
    if (w < 1200) return 74;
    if (w < 1600) return 84;
    return 96;
  }

  function makeStar(w, h, layer, scatter) {
    var spec;
    if (layer === 0) {
      spec = {
        radius: 0.7 + Math.random() * 0.35,
        baseAlpha: 0.14 + Math.random() * 0.08,
        vx: (Math.random() - 0.5) * 0.05,
        vy: -0.05 - Math.random() * 0.07,
        twSpeed: 0.01 + Math.random() * 0.015,
        twAmp: 0.02 + Math.random() * 0.03,
        parallax: 0.014,
        repel: 0.22
      };
    } else if (layer === 1) {
      spec = {
        radius: 1.15 + Math.random() * 0.4,
        baseAlpha: 0.22 + Math.random() * 0.08,
        vx: (Math.random() - 0.5) * 0.11,
        vy: -0.1 - Math.random() * 0.12,
        twSpeed: 0.018 + Math.random() * 0.02,
        twAmp: 0.03 + Math.random() * 0.04,
        parallax: 0.03,
        repel: 0.55
      };
    } else {
      spec = {
        radius: 1.7 + Math.random() * 0.5,
        baseAlpha: 0.3 + Math.random() * 0.08,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.15 - Math.random() * 0.15,
        twSpeed: 0.026 + Math.random() * 0.024,
        twAmp: 0.04 + Math.random() * 0.05,
        parallax: 0.052,
        repel: 1
      };
    }

    var pal = pickPalette();
    return {
      x: Math.random() * (w || 1),
      y: scatter ? Math.random() * (h || 1) : (h + 16 + Math.random() * 24),
      layer: layer,
      radius: spec.radius,
      baseAlpha: spec.baseAlpha,
      vx: spec.vx,
      vy: spec.vy,
      twPhase: Math.random() * Math.PI * 2,
      twSpeed: spec.twSpeed,
      twAmp: spec.twAmp,
      parallax: spec.parallax,
      repel: spec.repel,
      repelX: 0,
      repelY: 0,
      pal: pal,
      flare: layer === 2 && Math.random() < 0.2,
      fill: "rgb(" + PALETTE[pal].rgb + ")"
    };
  }

  function seed() {
    if (!width || !height) return;
    var total = countFor(width);
    var far = Math.round(total * 0.36);
    var mid = Math.round(total * 0.4);
    var near = total - far - mid;
    particles = [];
    var i;
    for (i = 0; i < far; i++) particles.push(makeStar(width, height, 0, true));
    for (i = 0; i < mid; i++) particles.push(makeStar(width, height, 1, true));
    for (i = 0; i < near; i++) particles.push(makeStar(width, height, 2, true));
  }

  function spawnMeteor() {
    var fromTop = Math.random() > 0.4;
    var tint = pickWeighted(METEOR_TINTS);
    var x = fromTop
      ? Math.random() * width * 0.8 + width * 0.1
      : -40;
    var y = fromTop ? -20 : Math.random() * height * 0.4;
    var speed = 5.5 + Math.random() * 3.5;
    var angle = fromTop
      ? Math.PI * (0.72 + Math.random() * 0.16)
      : Math.PI * (0.12 + Math.random() * 0.12);
    meteors.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.abs(Math.sin(angle)) * speed * 0.55,
      life: 1,
      decay: 0.012 + Math.random() * 0.008,
      len: 90 + Math.random() * 70,
      tint: tint.rgb
    });
  }

  function drawNebulas() {
    var t = timeAcc;
    for (var i = 0; i < NEBULAS.length; i++) {
      var n = NEBULAS[i];
      var cx = width * n.x + Math.sin(t * n.speed) * 40 * n.drift + mouseX * 0.02;
      var cy = height * n.y + Math.cos(t * n.speed * 0.8) * 30 * n.drift + mouseY * 0.02 - scrollY * 0.04;
      var rx = width * n.rx;
      var ry = height * n.ry;
      ctx.globalAlpha = 1;
      ctx.drawImage(nebulaSprites[i], cx - rx, cy - ry, rx * 2, ry * 2);
    }
  }

  function drawFlare(x, y, r, alpha) {
    var len = r * 5.5;
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = "rgba(247, 243, 234, 1)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x - len, y);
    ctx.lineTo(x + len, y);
    ctx.moveTo(x, y - len);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  }

  function drawConstellations(list) {
    if (width < 768) return;
    var maxD = 132;
    var maxD2 = maxD * maxD;
    var i, j, dx, dy, d2, a;
    for (i = 0; i < list.length; i++) {
      for (j = i + 1; j < list.length; j++) {
        dx = list[i].rx - list[j].rx;
        dy = list[i].ry - list[j].ry;
        d2 = dx * dx + dy * dy;
        if (d2 < maxD2 && d2 > 4) {
          a = (1 - Math.sqrt(d2) / maxD) * 0.12;
          ctx.globalAlpha = a;
          ctx.strokeStyle = "rgba(230, 222, 206, 1)";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(list[i].rx, list[i].ry);
          ctx.lineTo(list[j].rx, list[j].ry);
          ctx.stroke();
        }
      }
      /* Link bright stars toward the cursor */
      if (pointerActive && cursorX > -1000) {
        dx = list[i].rx - cursorX;
        dy = list[i].ry - cursorY;
        d2 = dx * dx + dy * dy;
        var curMax = 168;
        if (d2 < curMax * curMax && d2 > 4) {
          a = (1 - Math.sqrt(d2) / curMax) * 0.2;
          ctx.globalAlpha = a;
          ctx.strokeStyle = "rgba(247, 243, 234, 1)";
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(list[i].rx, list[i].ry);
          ctx.lineTo(cursorX, cursorY);
          ctx.stroke();
        }
      }
    }
  }

  function resize() {
    var w = Math.round(window.innerWidth || document.documentElement.clientWidth || 1200);
    var h = Math.round(window.innerHeight || document.documentElement.clientHeight || 800);
    var d = Math.min(window.devicePixelRatio || 1, 2);
    if (w <= 0 || h <= 0) return;
    if (w === width && h === height && d === dpr) return;

    var prevW = width;
    var prevH = height;
    dpr = d;
    width = w;
    height = h;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!particles.length || !prevW) {
      seed();
    } else {
      var target = countFor(width);
      var sx = width / prevW;
      var sy = height / prevH;
      particles.forEach(function (p) {
        p.x *= sx;
        p.y *= sy;
      });
      var far = Math.round(target * 0.36);
      var mid = Math.round(target * 0.4);
      var near = target - far - mid;
      var want = [far, mid, near];
      var by = [[], [], []];
      particles.forEach(function (p) {
        if (by[p.layer]) by[p.layer].push(p);
      });
      var out = [];
      for (var l = 0; l < 3; l++) {
        var list = by[l];
        while (list.length > want[l]) list.pop();
        while (list.length < want[l]) list.push(makeStar(width, height, l, true));
        out = out.concat(list);
      }
      particles = out;
    }
    draw(0, true);
  }

  function onPointer(x, y) {
    if (typeof x !== "number" || typeof y !== "number") return;
    pointerActive = true;
    cursorX = x;
    cursorY = y;
    targetX = x - width * 0.5;
    targetY = y - height * 0.5;
  }

  function resetPointer() {
    pointerActive = false;
    targetX = 0;
    targetY = 0;
    cursorX = -9999;
    cursorY = -9999;
  }

  function onScroll() {
    scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  function draw(dt, isStatic) {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width + 1, height + 1);

    if (!isStatic) {
      timeAcc += dt / 60;
      var lerp = Math.min(1, 0.05 * dt);
      mouseX += (targetX - mouseX) * lerp;
      mouseY += (targetY - mouseY) * lerp;

      meteorTimer -= dt;
      if (meteorTimer <= 0 && meteors.length < 2) {
        spawnMeteor();
        meteorTimer = 220 + Math.random() * 300;
      }
    } else {
      mouseX = 0;
      mouseY = 0;
    }

    drawNebulas();

    var repR = 110;
    var repR2 = repR * repR;
    var margin = 80;
    var pad = 42;
    var nearPoints = [];

    var i, p;
    for (i = 0; i < particles.length; i++) {
      p = particles[i];

      if (!isStatic) {
        p.x += (p.vx + Math.sin(p.twPhase * 0.7) * 0.04) * dt;
        p.y += p.vy * dt;
        p.twPhase += p.twSpeed * dt;

        if (pointerActive && cursorX > -1000) {
          var cx = p.x + mouseX * p.parallax + p.repelX;
          var cy = p.y + mouseY * p.parallax + p.repelY - scrollY * p.parallax * 0.12;
          var dx = cx - cursorX;
          var dy = cy - cursorY;
          var d2 = dx * dx + dy * dy;
          if (d2 < repR2 && d2 > 1) {
            var dist = Math.sqrt(d2);
            var force = (1 - dist / repR) * 2 * p.repel;
            p.repelX += (dx / dist) * force * dt;
            p.repelY += (dy / dist) * force * dt;
          }
        }

        var decay = Math.pow(0.92, dt);
        p.repelX *= decay;
        p.repelY *= decay;
        var mag = Math.hypot(p.repelX, p.repelY);
        if (mag > 70) {
          p.repelX = (p.repelX / mag) * 70;
          p.repelY = (p.repelY / mag) * 70;
        }

        if (p.y < -margin) { p.y = height + 70; p.x = Math.random() * width; }
        else if (p.y > height + margin) { p.y = -70; p.x = Math.random() * width; }
        if (p.x < -margin) p.x = width + 70;
        else if (p.x > width + margin) p.x = -70;
      }

      var dx2 = p.x + mouseX * p.parallax + p.repelX;
      var dy2 = p.y + mouseY * p.parallax + p.repelY - scrollY * p.parallax * 0.12;

      var edge = 1;
      if (dy2 < pad) edge = Math.min(edge, Math.max(0, dy2 / pad));
      else if (dy2 > height - pad) edge = Math.min(edge, Math.max(0, (height - dy2) / pad));
      if (dx2 < pad) edge = Math.min(edge, Math.max(0, dx2 / pad));
      else if (dx2 > width - pad) edge = Math.min(edge, Math.max(0, (width - dx2) / pad));
      if (edge <= 0.004) continue;

      var tw = isStatic ? 0 : Math.sin(p.twPhase) * p.twAmp;
      var alpha = Math.max(0.1, Math.min(0.48, p.baseAlpha + tw)) * edge;

      if (p.layer === 2) {
        var gr = p.radius * 2.6;
        ctx.globalAlpha = alpha * 0.55;
        ctx.drawImage(glowSprites[p.pal], dx2 - gr, dy2 - gr, gr * 2, gr * 2);
      } else if (p.layer === 1) {
        var gr2 = p.radius * 1.7;
        ctx.globalAlpha = alpha * 0.32;
        ctx.drawImage(glowSprites[p.pal], dx2 - gr2, dy2 - gr2, gr2 * 2, gr2 * 2);
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.fill;
      ctx.beginPath();
      ctx.arc(dx2, dy2, p.radius, 0, Math.PI * 2);
      ctx.fill();

      if (p.layer === 2) {
        ctx.globalAlpha = Math.min(0.5, alpha * 1.1);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(dx2, dy2, p.radius * 0.42, 0, Math.PI * 2);
        ctx.fill();
        if (p.flare) drawFlare(dx2, dy2, p.radius, alpha);
        nearPoints.push({ rx: dx2, ry: dy2, edge: edge });
      }
    }

    drawConstellations(nearPoints);

    /* Meteors */
    for (i = meteors.length - 1; i >= 0; i--) {
      var m = meteors[i];
      if (!isStatic) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.life -= m.decay * dt;
      }
      if (m.life <= 0 || m.x < -160 || m.x > width + 160 || m.y > height + 160) {
        meteors.splice(i, 1);
        continue;
      }
      var tailX = m.x - m.vx * (m.len / 12);
      var tailY = m.y - m.vy * (m.len / 12);
      var grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      grad.addColorStop(0, "rgba(" + m.tint + ", " + (0.75 * m.life) + ")");
      grad.addColorStop(1, "rgba(" + m.tint + ", 0)");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      var hg = m.x - m.vx * 0.6;
      var hy = m.y - m.vy * 0.6;
      ctx.globalAlpha = m.life * 0.6;
      ctx.drawImage(glowSprites[0], hg - 7, hy - 7, 14, 14);

      ctx.globalAlpha = m.life;
      ctx.fillStyle = "rgb(" + m.tint + ")";
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (document.hidden || isReduced) {
      rafId = null;
      return;
    }
    var t = (typeof now === "number" && !isNaN(now))
      ? now
      : (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (!lastTime) lastTime = t;
    var raw = (t - lastTime) / 16.667;
    var dt = Math.min(Math.max(isNaN(raw) ? 1 : raw, 0.1), 2.4);
    lastTime = t;
    draw(dt, false);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (isReduced || document.hidden) return;
    if (!rafId) {
      lastTime = 0;
      rafId = requestAnimationFrame(loop);
    }
  }

  function stop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTime = 0;
  }

  function onMotion(e) {
    isReduced = e.matches;
    if (isReduced) {
      stop();
      draw(0, true);
    } else if (!document.hidden) {
      start();
    }
  }

  window.addEventListener("mousemove", function (e) { onPointer(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener("mouseleave", resetPointer, { passive: true });
  window.addEventListener("touchstart", function (e) {
    if (e.touches && e.touches[0]) onPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    if (e.touches && e.touches[0]) onPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener("touchend", resetPointer, { passive: true });
  window.addEventListener("blur", resetPointer);
  window.addEventListener("scroll", onScroll, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (!isReduced) start();
  });

  window.addEventListener("resize", resize, { passive: true });

  if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotion);
  else if (motionQuery.addListener) motionQuery.addListener(onMotion);

  onScroll();
  resize();
  if (!isReduced && !document.hidden) start();
  else draw(0, true);
})();
