// ======================================================
// Storyline video controls LOCK / UNLOCK via boolean
// Variabelen:
//   videoObjectId (Tekst)
//   videoLocked   (True/False)
// + korte developer alert bij ongeldige ID
//
// Review-proof update:
// - In Articulate Review draait content vaak in (cross-origin) iframes.
// - Daarom starten we ALTIJD met het huidige document (document) en proberen
//   top/parent/iframe contentDocument alleen als dat same-origin toegankelijk is.
// ======================================================

(function () {

  const VAR_VIDEO_ID = "videoObjectId";
  const VAR_LOCKED   = "videoLocked";
  const ALERT_DELAY  = 3000;

  // ----------------------------
  // Storyline variabelen uitlezen (nieuw/legacy fallback)
  // ----------------------------
  function slGetVar(name) {
    try { if (typeof window.getVar === "function") return window.getVar(name); } catch {}
    try { if (window.Storyline?.getVar) return window.Storyline.getVar(name); } catch {}
    try { return GetPlayer().GetVar(name); } catch {}
    return null;
  }

  const VIDEO_ID = String(slGetVar(VAR_VIDEO_ID) || "").trim();
  const LOCKED   = !!slGetVar(VAR_LOCKED);

  // ----------------------------
  // State per video-id
  // ----------------------------
  const KEY = "__slVideoLock_" + (VIDEO_ID || "__noid__");
  window[KEY] = window[KEY] || {};
  const G = window[KEY];

  const safe = f => { try { return f(); } catch { return null; } };

  // ----------------------------
  // Developer alert (1x)
  // ----------------------------
  function devAlert() {
    if (G.alertShown) return;
    G.alertShown = true;
    alert("Storyline video script: videoObjectId niet gevonden:\n" + (VIDEO_ID || "(leeg)"));
  }

  // ----------------------------
  // Review-proof docs verzamelen
  // - Altijd: huidige document
  // - Optioneel: parent/top als same-origin
  // - Optioneel: iframe.contentDocument als same-origin
  // ----------------------------
  function collectDocs() {
    const docs = new Set([document]); // ✅ werkt altijd, ook in Review

    // probeer top doc (kan cross-origin zijn → safe() maakt dan null)
    const topDoc = safe(() => window.top.document);
    if (topDoc) docs.add(topDoc);

    // probeer parent-chain docs (same-origin only)
    let w = window;
    for (let i = 0; i < 10 && w; i++) {
      const d = safe(() => w.document);
      if (d) docs.add(d);
      const p = safe(() => w.parent);
      if (!p || p === w) break;
      w = p;
    }

    // voeg same-origin iframe docs toe
    for (const d of Array.from(docs)) {
      const iframes = safe(() => Array.from(d.querySelectorAll("iframe"))) || [];
      for (const f of iframes) {
        const fd = safe(() => f.contentDocument);
        if (fd) docs.add(fd);
      }
    }

    return Array.from(docs);
  }

  // ----------------------------
  // Video vinden: container op ID → <video> erbinnen
  // ----------------------------
  function findVideo() {
    if (!VIDEO_ID) return {};

    for (const d of collectDocs()) {

      const c =
        d.querySelector?.(`[data-model-id='${VIDEO_ID}']`) ||
        d.querySelector?.(`[data-acc-id='${VIDEO_ID}']`) ||
        d.getElementById?.(VIDEO_ID);

      const v = c?.querySelector?.("video");

      if (v) return { video: v, doc: d };
    }

    return {};
  }

  // ----------------------------
  // CSS inject/remove (UI)
  // ----------------------------
  function injectCss(doc) {
    const id = "slVideoLockStyle_" + VIDEO_ID;
    if (doc.getElementById(id)) return;

    const style = doc.createElement("style");
    style.id = id;
    style.textContent = `
      .video-playback-speed{display:none!important}
      .video-seekbar,.video-seekbar-hitarea,.video-seekbar-track,
      .video-seekbar-bar,.video-seekbar-seek-thumb{
        pointer-events:none!important
      }
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  function removeCss(doc) {
    const el = doc.getElementById("slVideoLockStyle_" + VIDEO_ID);
    if (el) el.remove();
  }

  // ----------------------------
  // Seeking blokkeren op <video> (functioneel)
  // ----------------------------
  function lockVideo(video) {
    if (video.__locked) return;

    video.__locked = true;

    let last = video.currentTime || 0;
    const tol = 0.25;

    const tu = () => {
      if (!video.seeking && !video.paused && video.currentTime > last)
        last = video.currentTime;
    };

    const clamp = () => {
      if (Math.abs(video.currentTime - last) > tol)
        video.currentTime = last;
    };

    video.addEventListener("timeupdate", tu);
    video.addEventListener("seeking", clamp);
    video.addEventListener("seeked", clamp);

    video.__handlers = { tu, clamp };
  }

  function unlockVideo(video) {
    if (!video.__locked) return;

    const h = video.__handlers;
    if (h) {
      video.removeEventListener("timeupdate", h.tu);
      video.removeEventListener("seeking", h.clamp);
      video.removeEventListener("seeked", h.clamp);
    }

    delete video.__handlers;
    delete video.__locked;
  }

  // ----------------------------
  // Apply: lock/unlock + alert logic
  // ----------------------------
  function apply() {

    if (!VIDEO_ID) {
      devAlert();
      return;
    }

    const { video, doc } = findVideo();

    // Niet gevonden → na delay 1x alert (layers/late init respecteren)
    if (!video || !doc) {
      if (!G.alertTimer) {
        G.alertTimer = setTimeout(() => {
          if (!findVideo().video) devAlert();
          G.alertTimer = null;
        }, ALERT_DELAY);
      }
      return;
    }

    // Wel gevonden → reset alert flag (zodat latere echte fout weer kan melden)
    G.alertShown = false;

    if (LOCKED) {
      injectCss(doc);
      lockVideo(video);
    } else {
      removeCss(doc);
      unlockVideo(video);
      cleanup();
    }
  }

  // ----------------------------
  // Cleanup: observers/timers stoppen
  // ----------------------------
  function cleanup() {
    if (G.mo) G.mo.disconnect();
    if (G.iv) clearInterval(G.iv);

    delete G.mo;
    delete G.iv;

    if (G.alertTimer) clearTimeout(G.alertTimer);
    delete G.alertTimer;
  }

  // ----------------------------
  // Start
  // ----------------------------
  apply();

  if (LOCKED) {
    // Blijf toepassen: DOM kan later veranderen (hover/layers/late init)
    G.mo = new MutationObserver(apply);
    G.mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

    // Extra back-up polling
    G.iv = setInterval(apply, 300);
  }

})();
