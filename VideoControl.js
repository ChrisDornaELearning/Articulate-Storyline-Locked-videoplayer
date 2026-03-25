// ======================================================
// Storyline video controls LOCK / UNLOCK via boolean
// Variabelen:
//   videoObjectId (Tekst)
//   videoLocked   (True/False)
//
// Masterslide-proof:
// - Geen developer popup meer bij ontbrekende object-id
// - Als geen geldige videoObjectId aanwezig is: stil stoppen
// ======================================================

(function () {

  const VAR_VIDEO_ID = "videoObjectId";
  const VAR_LOCKED   = "videoLocked";

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
  // Geen video-id? Dan stil stoppen
  // ----------------------------
  if (!VIDEO_ID) return;

  // ----------------------------
  // State per video-id
  // ----------------------------
  const KEY = "__slVideoLock_" + VIDEO_ID;
  window[KEY] = window[KEY] || {};
  const G = window[KEY];

  const safe = f => { try { return f(); } catch { return null; } };

  // ----------------------------
  // Review-proof docs verzamelen
  // ----------------------------
  function collectDocs() {
    const docs = new Set([document]);

    const topDoc = safe(() => window.top.document);
    if (topDoc) docs.add(topDoc);

    let w = window;
    for (let i = 0; i < 10 && w; i++) {
      const d = safe(() => w.document);
      if (d) docs.add(d);
      const p = safe(() => w.parent);
      if (!p || p === w) break;
      w = p;
    }

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
      if (!video.seeking && !video.paused && video.currentTime > last) {
        last = video.currentTime;
      }
    };

    const clamp = () => {
      if (Math.abs(video.currentTime - last) > tol) {
        video.currentTime = last;
      }
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
  // Cleanup
  // ----------------------------
  function cleanup() {
    if (G.mo) G.mo.disconnect();
    if (G.iv) clearInterval(G.iv);

    delete G.mo;
    delete G.iv;
  }

  // Oude watcher opruimen als script opnieuw draait
  cleanup();

  // ----------------------------
  // Apply
  // ----------------------------
  function apply() {
    const { video, doc } = findVideo();

    if (!video || !doc) return;

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
  // Start
  // ----------------------------
  apply();

  if (LOCKED) {
    G.mo = new MutationObserver(apply);
    G.mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });

    G.iv = setInterval(apply, 300);
  }

})();
