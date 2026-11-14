/* ==========================================================================
   App  ·  Portfolio interactions
   Lenis + GSAP + slide deck + YouTube embedder
   ========================================================================== */
(function () {
  "use strict";

  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var isReduced = reduceQuery.matches;

  var hasGSAP = typeof window.gsap !== "undefined";
  var hasST = hasGSAP && typeof window.ScrollTrigger !== "undefined";
  var hasLenis = typeof window.Lenis !== "undefined";

  var lenis = null;

  /* ------------------------------------------------------------------
     Smooth scroll
  ------------------------------------------------------------------ */
  function initSmoothScroll() {
    if (isReduced || !hasLenis) return;
    if (document.body.classList.contains("has-acts")) return;
    lenis = new window.Lenis({
      duration: 1.05,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      },
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1.4
    });

    if (hasGSAP) {
      lenis.on("scroll", function () {
        if (hasST) window.ScrollTrigger.update();
      });
      window.gsap.ticker.add(function (time) {
        if (lenis) lenis.raf(time * 1000);
      });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }
  }

  function scrollToTarget(sel) {
    if (typeof window.__actsScrollTo === "function" && window.__actsScrollTo(sel)) return;
    var el = document.querySelector(sel);
    if (!el) return;
    var offset = -(parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h"), 10) || 68) - 12;
    if (lenis) {
      lenis.scrollTo(el, { offset: offset, duration: 1.1 });
    } else {
      var y = el.getBoundingClientRect().top + window.pageYOffset + offset;
      window.scrollTo({ top: y, behavior: isReduced ? "auto" : "smooth" });
    }
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var hash = link.getAttribute("href");
    if (!hash || hash === "#") return;
    var target = document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    scrollToTarget(hash);
    if (history.replaceState) history.replaceState(null, "", hash);
  });

  /* ------------------------------------------------------------------
     Header + progress
  ------------------------------------------------------------------ */
  var header = document.getElementById("site-header");
  var progressBar = document.getElementById("scroll-progress-bar");
  var lastProgress = -1;

  function updateChrome() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (header) header.classList.toggle("is-scrolled", y > 12);

    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var pct = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    var rounded = Math.round(pct * 100);
    if (progressBar && rounded !== lastProgress) {
      progressBar.style.width = rounded + "%";
      lastProgress = rounded;
    }

    /* Bottom of page always highlights the closing section. */
    if (typeof computeSpy === "function") computeSpy();
    else if (max > 0 && y >= max - 48) setActiveSpy("thanks");
  }

  if (hasLenis && lenis) {
    lenis.on("scroll", updateChrome);
  } else if (hasST) {
    window.ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: updateChrome
    });
    window.addEventListener("resize", updateChrome, { passive: true });
  } else {
    /* Fallback: IntersectionObserver cannot give continuous %, use rAF throttle on scroll */
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        updateChrome();
        ticking = false;
      });
    }, { passive: true });
    window.addEventListener("resize", updateChrome, { passive: true });
  }
  updateChrome();

  /* ------------------------------------------------------------------
     Scrollspy
  ------------------------------------------------------------------ */
  var spyLinks = document.querySelectorAll("nav a[data-spy]");
  var sections = document.querySelectorAll("section[id]");

  function setActiveSpy(id) {
    spyLinks.forEach(function (a) {
      var on = a.getAttribute("data-spy") === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      if (document.body.classList.contains("has-acts")) return;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActiveSpy(entry.target.id);
      });
    }, { rootMargin: "-38% 0px -55% 0px", threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }
  setActiveSpy("intro");

  function computeSpy() {
    if (document.body.classList.contains("has-acts")) return;
    if (!spyLinks || !spyLinks.length || !sections || !sections.length) return;
    var vh = window.innerHeight;
    var bandTop = vh * 0.38;
    var bandBottom = vh * 0.45;
    var current = "intro";
    sections.forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.top < bandBottom && r.bottom > bandTop) current = s.id;
    });
    if (window.pageYOffset + vh >= document.documentElement.scrollHeight - 48) current = "thanks";
    setActiveSpy(current);
  }

  /* Native scroll safety net (Lenis still emits native scroll). */
  window.addEventListener("scroll", updateChrome, { passive: true });
  window.addEventListener("resize", updateChrome, { passive: true });

  /* ------------------------------------------------------------------
     Spotlight follows the pointer (CSS vars, rAF-throttled)
  ------------------------------------------------------------------ */
  function initSpotlight() {
    if (isReduced) return;
    var pending = false;
    var px = "50vw";
    var py = "32vh";
    window.addEventListener("pointermove", function (e) {
      px = e.clientX + "px";
      py = e.clientY + "px";
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        var root = document.documentElement;
        root.style.setProperty("--mx", px);
        root.style.setProperty("--my", py);
      });
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Hero title split
  ------------------------------------------------------------------ */
  function splitTitle() {
    var el = document.getElementById("hero-title");
    if (!el || el.dataset.split === "1") return;
    var text = el.textContent.trim();
    el.textContent = "";
    Array.prototype.forEach.call(text, function (ch) {
      var span = document.createElement("span");
      span.className = "char";
      span.textContent = ch === " " ? "\u00A0" : ch;
      el.appendChild(span);
    });
    el.dataset.split = "1";
  }

  /* ------------------------------------------------------------------
     Magnetic buttons
  ------------------------------------------------------------------ */
  function initMagnetic() {
    if (isReduced || !hasGSAP) return;
    var items = document.querySelectorAll(".btn, .nav-arrow, .nav-cta");
    items.forEach(function (el) {
      var xTo = window.gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
      var yTo = window.gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var relX = e.clientX - (r.left + r.width / 2);
        var relY = e.clientY - (r.top + r.height / 2);
        xTo(relX * 0.22);
        yTo(relY * 0.22);
      });
      el.addEventListener("mouseleave", function () {
        xTo(0);
        yTo(0);
      });
    });
  }

  /* ------------------------------------------------------------------
     Entrance + scroll reveals
  ------------------------------------------------------------------ */
  function initMotion() {
    if (!hasGSAP) return;
    window.gsap.registerPlugin.apply(window.gsap, hasST ? [window.ScrollTrigger] : []);

    if (isReduced) {
      window.gsap.set([".hero-badge", ".hero-title", ".hero-lede", ".hero-status", ".hero-actions", ".hero-stage"], { opacity: 1, y: 0, clearProps: "all" });
      var t0 = document.getElementById("hero-title");
      if (t0) t0.style.overflow = "visible";
      return;
    }

    splitTitle();

    var tl = window.gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.eventCallback("onComplete", function () {
      var t = document.getElementById("hero-title");
      if (t) t.style.overflow = "visible";
    });
    tl.from(".hero-badge", { y: 18, opacity: 0, duration: 0.7 }, 0.05)
      .from(".hero-title .char", { yPercent: 110, opacity: 0, duration: 0.85, stagger: 0.028 }, 0.15)
      .from(".hero-lede", { y: 18, opacity: 0, duration: 0.7 }, 0.55)
      .from(".hero-status", { y: 14, opacity: 0, duration: 0.55 }, 0.62)
      .from(".hero-actions .btn", { y: 16, opacity: 0, duration: 0.55, stagger: 0.08 }, 0.7)
      .from(".hero-stage", { scale: 0.94, opacity: 0, duration: 1.05, ease: "power2.out" }, 0.25)
      .from("header", { y: -16, opacity: 0, duration: 0.7 }, 0.1);

    if (!hasST) return;

    /* Scroll reveals: IntersectionObserver + CSS is more reliable than
       gsap.from + ScrollTrigger when the user jumps via anchors. */
    var revealSel = ".section-head, .deck-bar, .qa-row, .contact-grid, .closing-lede, .closing h2, .tech-strip";
    var revealEls = window.gsap.utils.toArray(revealSel);
    revealEls.forEach(function (el) { el.classList.add("reveal-init"); });

    if ("IntersectionObserver" in window) {
      var revealIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          el.classList.add("is-in");
          revealIo.unobserve(el);
        });
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
      revealEls.forEach(function (el) { revealIo.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add("is-in"); });
    }

    /* Subtle nebula parallax */
    var nebula = document.querySelector(".nebula");
    if (nebula && !isReduced) {
      window.gsap.to(nebula, {
        yPercent: 8,
        ease: "none",
        scrollTrigger: {
          start: 0,
          end: "max",
          scrub: 1
        }
      });
    }
  }

  /* ------------------------------------------------------------------
     Slide deck
  ------------------------------------------------------------------ */
  var slideItems = document.querySelectorAll(".project-slide");
  var tabButtons = document.querySelectorAll(".tab-btn");
  var prevBtn = document.getElementById("prev-slide-btn");
  var nextBtn = document.getElementById("next-slide-btn");
  var counterEl = document.getElementById("slide-counter");
  var viewport = document.getElementById("deck-viewport");
  var current = 0;
  var total = slideItems.length;

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function pauseAllYouTube() {
    document.querySelectorAll(".video-frame iframe").forEach(function (iframe) {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
            "*"
          );
        }
      } catch (err) {
        /* cross-origin */
      }
    });
  }
  window.__pauseVideos = pauseAllYouTube;
  window.__destroyLenis = function () {
    if (lenis) { lenis.destroy(); lenis = null; }
    if (hasST) window.ScrollTrigger.update();
  };
  window.__initLenis = function () {
    if (!lenis && hasLenis && !isReduced && !document.body.classList.contains("has-acts")) initSmoothScroll();
  };

  function maybeScrollDeckIntoView() {
    if (window.innerWidth > 980) return;
    var sec = document.getElementById("projects-section");
    if (!sec) return;
    var rect = sec.getBoundingClientRect();
    if (rect.top < -80 || rect.top > 220) {
      scrollToTarget("#projects-section");
    }
  }

  function goToSlide(index, isUser, shouldScroll) {
    if (index < 0) index = total - 1;
    if (index >= total) index = 0;
    pauseAllYouTube();
    var prev = current;
    current = index;
    slideItems.forEach(function (slide, i) {
      var active = i === current;
      slide.classList.toggle("is-active", active);
      if (active) slide.removeAttribute("aria-hidden");
      else slide.setAttribute("aria-hidden", "true");
      slide.inert = !active;
    });

    tabButtons.forEach(function (tab, i) {
      var active = i === current;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.setAttribute("tabindex", active ? "0" : "-1");
    });

    if (tabButtons[current]) {
      try {
        tabButtons[current].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      } catch (err) { /* ignore */ }
    }

    if (counterEl) {
      counterEl.textContent = pad2(current + 1) + " / " + pad2(total);
      if (prev !== current) {
        counterEl.classList.remove("tick");
        void counterEl.offsetWidth;
        counterEl.classList.add("tick");
      }
    }

    if (hasGSAP && !isReduced && prev !== current) {
      var incoming = slideItems[current];
      window.gsap.fromTo(
        incoming,
        { opacity: 0, y: 22, scale: 0.988 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out", overwrite: true }
      );
      window.gsap.fromTo(
        incoming.querySelectorAll(".project-media, .project-heading, .panel"),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power3.out", overwrite: true, clearProps: "opacity,transform" }
      );
    }

    if (isUser && shouldScroll) maybeScrollDeckIntoView();

    /* Promote the incoming slide's thumbnail to a real embed. */
    if (prev !== current) {
      var pid = slideItems[current] && slideItems[current].getAttribute("data-project-id");
      if (pid && videoIds[pid]) renderVideoBox(pid, videoIds[pid], false);
    }
  }

  tabButtons.forEach(function (btn, i) {
    btn.addEventListener("click", function () {
      goToSlide(parseInt(btn.getAttribute("data-index"), 10) || i, true, true);
    });
    btn.addEventListener("keydown", function (e) {
      var target = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") target = (i + 1) % total;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") target = (i - 1 + total) % total;
      else if (e.key === "Home") target = 0;
      else if (e.key === "End") target = total - 1;
      if (target !== -1) {
        e.preventDefault();
        e.stopPropagation();
        goToSlide(target, true, true);
        if (tabButtons[target]) tabButtons[target].focus();
      }
    });
  });

  if (prevBtn) prevBtn.addEventListener("click", function () { goToSlide(current - 1, true, true); });
  if (nextBtn) nextBtn.addEventListener("click", function () { goToSlide(current + 1, true, true); });

  window.addEventListener("keydown", function (e) {
    var active = document.activeElement;
    if (active && (
      ["INPUT", "TEXTAREA", "SELECT"].indexOf(active.tagName) !== -1 ||
      active.isContentEditable ||
      active.closest(".video-config")
    )) return;

    if (e.key === "ArrowLeft") goToSlide(current - 1, true, true);
    else if (e.key === "ArrowRight") goToSlide(current + 1, true, true);
  });

  if (viewport) {
    var touchX = 0;
    var touchY = 0;
    var swiping = false;

    viewport.addEventListener("touchstart", function (e) {
      if (e.touches.length > 1) { swiping = false; return; }
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
      swiping = true;
    }, { passive: true });

    viewport.addEventListener("touchcancel", function () { swiping = false; }, { passive: true });

    viewport.addEventListener("touchend", function (e) {
      if (!swiping) return;
      swiping = false;
      if (e.target.closest("input, textarea, button, [role=\"button\"], summary, a")) return;
      if (!e.changedTouches || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - touchX;
      var dy = e.changedTouches[0].clientY - touchY;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (dx < 0) goToSlide(current + 1, true, false);
        else goToSlide(current - 1, true, false);
      }
    }, { passive: true });
  }

  document.querySelectorAll("[data-goto-slide]").forEach(function (link) {
    link.addEventListener("click", function () {
      goToSlide(parseInt(link.getAttribute("data-goto-slide"), 10) || 0, true, false);
    });
  });

  var projectsBtn = document.getElementById("nav-projects-btn");
  if (projectsBtn) {
    projectsBtn.addEventListener("click", function () {
      goToSlide(0, true, false);
    });
  }

  /* ------------------------------------------------------------------
     YouTube parser + renderer
  ------------------------------------------------------------------ */
  var PROJECT_NAMES = {
    reend: "RE-END",
    stars: "Conquer the Stars",
    dabda: "DABDA"
  };

  var videoIds = {
    reend: "ITwK9bQ_CvQ",
    stars: "g3vkVFKuGm8",
    dabda: "3XokwoHEwiI"
  };
  var videoLoaded = {};

  function isActiveProject(project) {
    var slide = document.querySelector('.project-slide[data-project-id="' + project + '"]');
    return !!(slide && slide.classList.contains("is-active"));
  }

  function extractYouTubeId(raw) {
    if (!raw || typeof raw !== "string") return null;
    var str = raw.trim().replace(/^["']|["']$/g, "");
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
    try {
      var urlStr = /^https?:\/\//i.test(str) ? str : "https://" + str;
      var u = new URL(urlStr);
      var host = u.hostname.replace(/^www\./i, "").toLowerCase();
      if (host === "youtu.be") {
        var parts = u.pathname.split("/").filter(Boolean);
        if (parts.length && /^[a-zA-Z0-9_-]{11}$/.test(parts[0])) return parts[0];
      }
      if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].indexOf(host) !== -1) {
        if (u.searchParams.has("v")) {
          var v = u.searchParams.get("v");
          if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
        }
        var m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/i);
        if (m) return m[1];
      }
    } catch (err) { /* fall through */ }
    var match = str.match(/(?:youtu\.be\/|(?:www\.)?youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/i);
    return match ? match[1] : null;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function svgUse(href, fill) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon" + (fill ? " icon-fill" : ""));
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", href);
    svg.appendChild(use);
    return svg;
  }

  function renderVideoBox(project, videoId, forceIframe) {
    var box = document.getElementById("video-box-" + project);
    if (!box) return;

    var isLocal = window.location.protocol === "file:";
    var name = PROJECT_NAMES[project] || project.toUpperCase();
    var mayEmbed = (!isLocal || forceIframe) && (
      isActiveProject(project) || videoLoaded[project] || forceIframe
    );
    if (mayEmbed) videoLoaded[project] = true;

    if (mayEmbed) {
      box.classList.add("has-embed");
      var iframe = document.createElement("iframe");
      var isHttp = window.location.protocol.indexOf("http") === 0 && window.location.origin && window.location.origin !== "null";
      var embed = "https://www.youtube.com/embed/" + encodeURIComponent(videoId) + "?rel=0&playsinline=1&enablejsapi=1";
      if (isHttp) embed += "&origin=" + encodeURIComponent(window.location.origin);
      iframe.src = embed;
      iframe.title = "Gameplay " + name;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      iframe.setAttribute("loading", (project === "reend" || forceIframe) ? "eager" : "lazy");
      if (box.replaceChildren) box.replaceChildren(iframe);
      else {
        box.innerHTML = "";
        box.appendChild(iframe);
      }

      if (isLocal && forceIframe) {
        var revert = el("button", "revert-embed", "Quay lại ảnh xem trước");
        revert.type = "button";
        revert.addEventListener("click", function () {
          renderVideoBox(project, videoId, false);
        });
        box.appendChild(revert);
      }
      return;
    }

    /* Thumbnail preview: file:// always, and inactive slides on http. */
    box.classList.remove("has-embed");
    var thumb = "https://img.youtube.com/vi/" + encodeURIComponent(videoId) + "/hqdefault.jpg";
    var card = el("div", "video-preview");
    card.style.backgroundImage = "linear-gradient(rgba(10,10,15,0.72), rgba(10,10,15,0.9)), url('" + thumb + "')";

    var play = el("a", "play-orb");
    play.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId);
    play.target = "_blank";
    play.rel = "noopener noreferrer";
    play.title = "Xem video gameplay " + name + " trên YouTube";
    play.appendChild(svgUse("#i-play", true));
    card.appendChild(play);

    card.appendChild(el("h4", null, "Video Gameplay " + name));
    card.appendChild(el("p", null, "Bấm nút phát để mở xem trực tiếp trên YouTube"));

    if (isLocal) {
      var tip = el("div", "local-tip");
      var code = el("code", null, "file://");
      var strong = el("strong", null, "chay-web.bat");
      tip.appendChild(document.createTextNode("Đang mở bằng "));
      tip.appendChild(code);
      tip.appendChild(document.createTextNode(" (YouTube chặn nhúng). Nhấp đúp "));
      tip.appendChild(strong);
      tip.appendChild(document.createTextNode(" để xem video nhúng ngay trên trang."));
      card.appendChild(tip);
    }

    if (isLocal) {
      var tryBtn = el("button", "try-embed", "Thử phát nhúng tại đây");
      tryBtn.type = "button";
      tryBtn.addEventListener("click", function () {
        renderVideoBox(project, videoId, true);
      });
      card.appendChild(tryBtn);
    }

    if (box.replaceChildren) box.replaceChildren(card);
    else {
      box.innerHTML = "";
      box.appendChild(card);
    }
  }

  window.renderVideoBox = renderVideoBox;

  document.querySelectorAll(".yt-form").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector("input");
      var project = form.getAttribute("data-target");
      var status = form.nextElementSibling;
      var id = extractYouTubeId(input.value);
      if (!id) {
        status.textContent = "Link hoặc ID YouTube không hợp lệ (cần URL chuẩn hoặc 11 ký tự).";
        status.style.color = "#e8b4a8";
        return;
      }
      var box = document.getElementById("video-box-" + project);
      var wasIframe = !!(box && box.querySelector("iframe"));
      videoIds[project] = id;
      renderVideoBox(project, id, wasIframe);
      status.textContent = "";
      status.appendChild(document.createTextNode("Đã cập nhật video. "));
      var a = el("a", null, "Mở xem trên YouTube");
      a.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(id);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.cssText = "text-decoration:underline;text-underline-offset:3px;font-weight:600;margin-left:6px;";
      status.appendChild(a);
      status.style.color = "";
    });
  });

  /* ------------------------------------------------------------------
     Reduced-motion listener
  ------------------------------------------------------------------ */
  function onReduce(e) {
    isReduced = e.matches;
    if (isReduced && lenis) {
      lenis.destroy();
      lenis = null;
    }
  }
  if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", onReduce);
  else if (reduceQuery.addListener) reduceQuery.addListener(onReduce);

  /* ------------------------------------------------------------------
     Boot
  ------------------------------------------------------------------ */
  function boot() {
    initSmoothScroll();
    initMotion();
    initMagnetic();
    initSpotlight();
    renderVideoBox("reend", videoIds.reend, false);
    renderVideoBox("stars", videoIds.stars, false);
    renderVideoBox("dabda", videoIds.dabda, false);
    goToSlide(0, false, false);

    /* Expose for tests only (no production dependency) */
    window.__lenis = lenis;

    if (hasST) {
      window.ScrollTrigger.refresh();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
