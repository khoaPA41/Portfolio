/* ==========================================================================
   Acts  ·  Vacuum deck
   Each section is a full-screen act. Scrolling sucks the current act into
   the center void and pulls the next act in from both sides.
   Desktop only (>= 1024px). Mobile / reduced-motion keeps normal scroll.
   ========================================================================== */
(function initActs() {
  "use strict";

  if (typeof window.gsap === "undefined") return;
  if (typeof window.ScrollTrigger === "undefined") return;

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;

  var mq = window.matchMedia("(min-width: 1024px) and (min-height: 660px)");
  var forceActs = /[?&]acts=1/.test(window.location.search);
  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  var acts = [
    document.getElementById("intro"),
    document.getElementById("projects-section"),
    document.getElementById("thanks")
  ];
  var spacer = document.getElementById("scroll-space");
  var ring = document.querySelector(".void-ring");

  var enabled = false;
  var tl = null;
  var reveal = { projects: { p: 100 }, closing: { p: 100 } };
  var SETTLED = [0, 0.33, 0.76];
  var NAV_IDS = ["intro", "projects-section", "thanks"];

  function ready() {
    return (
      (mq.matches || forceActs) &&
      !reduceQuery.matches &&
      acts[0] && acts[1] && acts[2] && spacer
    );
  }

  function setNav(id) {
    document.querySelectorAll("nav a[data-spy]").forEach(function (a) {
      var on = a.getAttribute("data-spy") === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  function applyReveal(key, el) {
    var p = reveal[key].p;
    el.style.setProperty("--reveal", p.toFixed(2) + "%");
  }

  function setInteractive(el, on) {
    el.style.pointerEvents = on ? "auto" : "none";
    el.inert = !on;
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    document.body.classList.add("has-acts");
    syncHeader();
    if (window.__destroyLenis) window.__destroyLenis();
    gsap.registerPlugin(ScrollTrigger);
    window.addEventListener("scroll", function () { ScrollTrigger.update(); }, { passive: true });

    /* Initial act states: hero live, others folded away. */
    gsap.set(acts[0], {
      opacity: 1,
      scale: 1,
      rotateX: 0,
      filter: "blur(0px) brightness(1)",
      "--reveal": "100%",
      pointerEvents: "auto"
    });
    gsap.set([acts[1], acts[2]], {
      opacity: 0,
      scale: 1,
      rotateX: 0,
      filter: "blur(0px) brightness(1)",
      "--reveal": "0%",
      pointerEvents: "none"
    });
    reveal.projects.p = 0;
    reveal.closing.p = 0;
    applyReveal("projects", acts[1]);
    applyReveal("closing", acts[2]);
    setInteractive(acts[0], true);
    setInteractive(acts[1], false);
    setInteractive(acts[2], false);

    tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: "#scroll-space",
        start: "top top",
        end: "bottom bottom",
        scrub: 0.9,
        invalidateOnRefresh: true,
        snap: {
          snapTo: SETTLED,
          duration: { min: 0.4, max: 0.85 },
          delay: 0.05,
          ease: "power3.inOut"
        },
        onUpdate: function (self) {
          var p = self.progress;
          var best = 0;
          var dist = Infinity;
          for (var i = 0; i < SETTLED.length; i++) {
            var d = Math.abs(p - SETTLED[i]);
            if (d < dist) { dist = d; best = i; }
          }
          setNav(NAV_IDS[best]);
          /* Safety: never leave the last act masked at the end of the deck. */
          if (p > 0.9) {
            acts[2].style.setProperty("--reveal", "100%");
            gsap.set(acts[2], { opacity: 1 });
          }
          if (best !== 1 && typeof window.__pauseVideos === "function") {
            if (p < SETTLED[1] - 0.12 || p > SETTLED[1] + 0.12) window.__pauseVideos();
          }
        }
      }
    });

    /* --- HERO → PROJECTS : suck hero into the void --- */
    tl.to(acts[0], {
      scale: 0.3,
      opacity: 0,
      rotateX: 14,
      filter: "blur(18px) brightness(0.4)",
      transformOrigin: "50% 48%",
      duration: 1.0,
      ease: "power2.in"
    }, 1.1);
    tl.set(acts[0], { pointerEvents: "none" }, 1.1);

    pulseRing(1.15);

    /* --- PROJECTS in: two sides pull toward center --- */
    tl.fromTo(acts[1],
      { "--reveal": "0%", opacity: 0 },
      { "--reveal": "100%", opacity: 1, duration: 1.15, ease: "power2.out" },
      1.18
    );
    tl.set(acts[1], { pointerEvents: "auto", inert: false }, 2.33);

    /* Hold on projects */
    tl.to({}, { duration: 1.9 }, 2.33);

    /* --- PROJECTS → CLOSING --- */
    tl.to(acts[1], {
      scale: 0.3,
      opacity: 0,
      filter: "blur(16px) brightness(0.45)",
      transformOrigin: "50% 48%",
      duration: 1.0,
      ease: "power2.in"
    }, 4.23);
    tl.set(acts[1], { pointerEvents: "none", inert: true }, 4.23);
    if (typeof window.__pauseVideos === "function") {
      tl.call(function () { window.__pauseVideos(); }, null, 4.23);
    }

    pulseRing(4.3);

    tl.fromTo(acts[2],
      { "--reveal": "0%", opacity: 0 },
      { "--reveal": "100%", opacity: 1, duration: 1.15, ease: "power2.out" },
      4.28
    );
    tl.set(acts[2], { pointerEvents: "auto", inert: false }, 5.43);

    /* Hold on closing */
    tl.to({}, { duration: 1.57 }, 5.43);
    tl.set(acts[2], { "--reveal": "100%", opacity: 1 }, 5.5);

    /* Anchor mapping for the fixed stage. */
    window.__actsScrollTo = function (sel) {
      var map = { "#intro": 0, "#projects-section": 1, "#thanks": 2 };
      var i = map[sel];
      if (i == null) return false;
      goToAct(i);
      return true;
    };

    ScrollTrigger.refresh();
  }

  function pulseRing(at) {
    if (!ring) return;
    tl.fromTo(ring,
      { scale: 0.12, opacity: 0 },
      { scale: 1, opacity: 0.5, duration: 0.45, ease: "power2.out" },
      at
    ).to(ring,
      { scale: 2.15, opacity: 0, duration: 0.55, ease: "power2.in" },
      at + 0.45
    );
  }

  function syncHeader() {
    var header = document.getElementById("site-header");
    if (!header) return;
    document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
  }
  window.addEventListener("resize", function () {
    if (enabled) syncHeader();
  }, { passive: true });

  function goToAct(i) {
    var maxY = spacer.offsetHeight - window.innerHeight;
    if (maxY <= 0) return;
    var y = SETTLED[i] * maxY;
    if (window.__lenis) {
      window.__lenis.scrollTo(y, { duration: 1.25 });
    } else {
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  function disable() {
    if (!enabled) return;
    enabled = false;
    document.body.classList.remove("has-acts");
    document.documentElement.style.setProperty("--header-h", "68px");
    if (window.__initLenis) window.__initLenis();
    if (tl) {
      if (tl.scrollTrigger) tl.scrollTrigger.kill(false);
      tl.kill();
      tl = null;
    }
    window.__actsScrollTo = null;
    gsap.set(acts, {
      clearProps: "transform,opacity,filter,visibility,pointerEvents,inert",
      opacity: 1,
      scale: 1,
      rotateX: 0,
      filter: "none"
    });
    acts.forEach(function (el) {
      if (!el) return;
      el.style.setProperty("--reveal", "100%");
      el.style.pointerEvents = "";
      el.inert = false;
    });
    if (ring) gsap.set(ring, { opacity: 0, scale: 1 });
    setNav("intro");
    ScrollTrigger.refresh();
  }

  /* Capture-phase anchor handler: the fixed stage has no in-flow offsets. */
  document.addEventListener("click", function (e) {
    if (!enabled) return;
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var map = { "#intro": 0, "#projects-section": 1, "#thanks": 2 };
    var i = map[a.getAttribute("href")];
    if (i == null) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    goToAct(i);
  }, true);

  function onMq() {
    if (ready()) enable();
    else disable();
  }

  if (mq.addEventListener) mq.addEventListener("change", onMq);
  else if (mq.addListener) mq.addListener(onMq);
  if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", onMq);
  else if (reduceQuery.addListener) reduceQuery.addListener(onMq);

  function boot() {
    if (ready()) enable();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
