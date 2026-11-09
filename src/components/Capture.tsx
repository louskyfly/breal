import { useCallback, useEffect, useRef, useState } from "react";
import type { Moment, Post, User } from "../lib/types";
import { api, ApiError } from "../lib/api";
import { countdown, fmtTime, lateLabel } from "../lib/format";
import { Duo, LateBadge } from "./ui";
import {
  FlashIcon,
  ImageIcon,
  SwapIcon,
  TimerIcon,
  XIcon,
} from "./Icons";

type Phase = "starting" | "live" | "review" | "publishing" | "error" | "posted";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* noop */
    }
  });
}

async function grab(video: HTMLVideoElement, mirror: boolean): Promise<Blob> {
  const w = 1080;
  const h = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  if (!video.videoWidth || !video.videoHeight) throw new Error("video not ready");
  const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
  const dw = video.videoWidth * scale;
  const dh = video.videoHeight * scale;
  ctx.save();
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
  ctx.restore();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("blob"))), "image/jpeg", 0.87);
  });
}

async function normalizeFile(file: File): Promise<Blob> {
  const w = 1080;
  const h = 1440;
  let source: ImageBitmap | HTMLImageElement;
  let objectUrl: string | null = null;

  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.src = objectUrl;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(objectUrl);
      throw new Error("format");
    }
    source = img;
  }

  try {
    const sw = source instanceof ImageBitmap ? source.width : source.naturalWidth;
    const sh = source instanceof ImageBitmap ? source.height : source.naturalHeight;
    if (!sw || !sh) throw new Error("image");
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    const scale = Math.max(w / sw, h / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86),
    );
    if (!blob) throw new Error("blob");
    return blob;
  } finally {
    if (source instanceof ImageBitmap) source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function ensureReady(video: HTMLVideoElement) {
  if (video.videoWidth > 0 && video.readyState >= 2) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 2000);
    video.addEventListener(
      "loadeddata",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export default function Capture({
  me,
  moment,
  myPost,
  onClose,
  onPublished,
  onDeleted,
  onViewPost,
  notify,
}: {
  me: User;
  moment: Moment;
  myPost: Post | null;
  onClose: () => void;
  onPublished: (post: Post) => void;
  onDeleted: () => void;
  onViewPost: (post: Post) => void;
  notify: (message: string, tone?: "plain" | "flash" | "error") => void;
}) {
  const [phase, setPhase] = useState<Phase>(myPost ? "posted" : "starting");
  const [session, setSession] = useState(0);
  const [error, setError] = useState("");
  const [streams, setStreams] = useState<{ back: MediaStream | null; front: MediaStream | null }>({
    back: null,
    front: null,
  });
  const [dual, setDual] = useState(false);
  const [frontMain, setFrontMain] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [timer, setTimer] = useState<0 | 3 | 10>(0);
  const [counting, setCounting] = useState<number | null>(null);
  const [flashScreen, setFlashScreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [shots, setShots] = useState<{ back: Blob; front: Blob; backUrl: string; frontUrl: string } | null>(null);
  const [retakes, setRetakes] = useState(0);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [visibility, setVisibility] = useState<"friends" | "public">("friends");
  const [publishError, setPublishError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedBack, setSelectedBack] = useState<File | null>(null);
  const [selectedFront, setSelectedFront] = useState<File | null>(null);
  const [importMode, setImportMode] = useState(false);
  const [cameraMissing, setCameraMissing] = useState(false);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);

  const backVideoRef = useRef<HTMLVideoElement>(null);
  const frontVideoRef = useRef<HTMLVideoElement>(null);
  const backStreamRef = useRef<MediaStream | null>(null);
  const frontStreamRef = useRef<MediaStream | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isIOS =
    typeof navigator !== "undefined" &&
    (/iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  const stopAll = useCallback(() => {
    stopStream(backStreamRef.current);
    stopStream(frontStreamRef.current);
    backStreamRef.current = null;
    frontStreamRef.current = null;
    setStreams({ back: null, front: null });
  }, []);

  // start cameras whenever a new session begins
  useEffect(() => {
    if (phase === "posted") return;
    let cancelled = false;
    setPhase("starting");
    setError("");
    setDual(false);
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Ce navigateur ne donne pas accès à la caméra. Tu peux importer deux photos.");
        setPhase("error");
        return;
      }
      try {
        const back = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1440 }, height: { ideal: 1920 } },
        });
        if (cancelled) {
          stopStream(back);
          return;
        }
        backStreamRef.current = back;
        setStreams({ back, front: null });
        setCameraMissing(false);
        setPhase("live");
        if (!isIOS) {
          try {
            const front = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: { facingMode: { ideal: "user" }, width: { ideal: 1440 }, height: { ideal: 1920 } },
            });
            if (cancelled) {
              stopStream(front);
              return;
            }
            frontStreamRef.current = front;
            setStreams({ back, front });
            setDual(true);
          } catch {
            setDual(false);
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        const name = e?.name || "";
        setCameraMissing(name === "NotFoundError");
        setError(
          name === "NotAllowedError"
            ? "Tu as refusé l’accès à la caméra. Autorise-la dans ton navigateur, puis réessaie."
            : name === "NotFoundError"
              ? "Aucune caméra détectée. Tu peux importer deux photos."
              : "La caméra n’a pas voulu s’ouvrir. Réessaie, ou importe deux photos.",
        );
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    const attach = (el: HTMLVideoElement | null, stream: MediaStream | null) => {
      if (!el || !stream) return;
      if (el.srcObject !== stream) el.srcObject = stream;
      el.play().catch(() => {});
    };
    attach(backVideoRef.current, streams.back);
    attach(frontVideoRef.current, streams.front);
  }, [streams, phase]);

  useEffect(() => {
    return () => {
      stopAll();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [stopAll]);

  useEffect(() => {
    if (!flashOn) return;
    const track = backStreamRef.current?.getVideoTracks()[0];
    track?.applyConstraints({ advanced: [{ torch: true }] } as any).catch(() => {});
    return () => {
      track?.applyConstraints({ advanced: [{ torch: false }] } as any).catch(() => {});
    };
  }, [flashOn, streams.back]);

  async function take() {
    if (phase !== "live" || busy) return;
    if (timer > 0) {
      if (counting !== null) return;
      setCounting(timer);
      let left = timer;
      countdownRef.current = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setCounting(null);
          void doTake();
        } else {
          setCounting(left);
        }
      }, 1000);
      return;
    }
    await doTake();
  }

  async function flashBurst() {
    try {
      setFlashScreen(true);
      navigator.vibrate?.(18);
      await wait(140);
    } finally {
      setTimeout(() => setFlashScreen(false), 60);
    }
  }

  async function doTake() {
    if (busy || !backVideoRef.current) return;
    setBusy(true);
    setError("");
    try {
      await flashBurst();
      let backBlob: Blob;
      let frontBlob: Blob;
      if (dual && frontVideoRef.current) {
        backBlob = await grab(backVideoRef.current, false);
        frontBlob = await grab(frontVideoRef.current, true);
      } else {
        backBlob = await grab(backVideoRef.current, false);
        setSwitching(true);
        stopStream(backStreamRef.current);
        backStreamRef.current = null;
        setStreams((s) => ({ ...s, back: null }));
        const front = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "user" }, width: { ideal: 1440 }, height: { ideal: 1920 } },
        });
        frontStreamRef.current = front;
        setStreams((s) => ({ ...s, front }));
        if (frontVideoRef.current) {
          frontVideoRef.current.srcObject = front;
          await frontVideoRef.current.play().catch(() => {});
          await ensureReady(frontVideoRef.current);
        }
        await wait(420);
        frontBlob = await grab(frontVideoRef.current!, true);
        setSwitching(false);
      }
      stopAll();
      const backUrl = URL.createObjectURL(backBlob);
      const frontUrl = URL.createObjectURL(frontBlob);
      setShots({ back: backBlob, front: frontBlob, backUrl, frontUrl });
      setPhase("review");
      navigator.vibrate?.([12, 40, 16]);
    } catch {
      setSwitching(false);
      stopAll();
      setPhase("error");
      setError("La photo n’a pas pu être prise. Réessaie, ou importe deux photos.");
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    if (shots) {
      URL.revokeObjectURL(shots.backUrl);
      URL.revokeObjectURL(shots.frontUrl);
    }
    setShots(null);
    setRetakes((r) => r + 1);
    setPublishError("");
    setPhase("starting");
    setSession((s) => s + 1);
  }

  async function useFiles(back: File, front: File) {
    setBusy(true);
    setError("");
    try {
      const [b, f] = await Promise.all([normalizeFile(back), normalizeFile(front)]);
      stopAll();
      const backUrl = URL.createObjectURL(b);
      const frontUrl = URL.createObjectURL(f);
      setShots({ back: b, front: f, backUrl, frontUrl });
      setImportMode(false);
      setPhase("review");
    } catch (e) {
      setError(
        e instanceof Error && e.message === "format"
          ? "Ce format d’image n’est pas lisible ici. Essaie un JPEG ou un PNG."
          : "Ces photos n’ont pas pu être lues. Essaie deux JPEG ou PNG.",
      );
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  function switchToImport() {
    stopAll();
    setImportMode(true);
    setError("");
    setPhase("error");
  }

  function backToCamera() {
    setImportMode(false);
    setError("");
    setPhase("starting");
    setSession((s) => s + 1);
  }

  useEffect(() => {
    if (!selectedBack) {
      setBackPreview(null);
      return;
    }
    const url = URL.createObjectURL(selectedBack);
    setBackPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedBack]);

  useEffect(() => {
    if (!selectedFront) {
      setFrontPreview(null);
      return;
    }
    const url = URL.createObjectURL(selectedFront);
    setFrontPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFront]);

  async function publish() {
    if (!shots || phase === "publishing") return;
    setPhase("publishing");
    setPublishError("");
    try {
      const [b, f] = await Promise.all([api.upload(shots.back), api.upload(shots.front)]);
      const { post } = await api.createPost({
        backUrl: b.url,
        frontUrl: f.url,
        caption,
        location,
        visibility,
        retakes,
        frontMain,
      });
      onPublished(post);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "La publication a échoué.";
      setPublishError(message);
      setPhase("review");
    }
  }

  async function removeMyPost() {
    if (!myPost || deleting) return;
    setDeleting(true);
    try {
      await api.deletePost(myPost.id);
      onDeleted();
      setConfirmDelete(false);
      setPhase("starting");
      setSession((s) => s + 1);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Suppression impossible", "error");
      setDeleting(false);
    }
  }

  const close = () => {
    if (phase === "publishing") return;
    if (shots) {
      URL.revokeObjectURL(shots.backUrl);
      URL.revokeObjectURL(shots.frontUrl);
    }
    onClose();
  };

  const lateNow = Math.max(0, Math.round((Date.now() - moment.notifiedAt) / 1000));
  const flashLabel = timer === 0 ? "Off" : `${timer}s`;

  if (phase === "posted" && myPost) {
    return (
      <div className="capture capture-posted">
        <header className="capture-top">
          <button type="button" className="icon-btn icon-btn-dark" onClick={close} aria-label="Fermer">
            <XIcon size={22} />
          </button>
          <span className="capture-title">Ton BeReal</span>
          <span className="capture-spacer" />
        </header>
        <div className="posted-wrap">
          <div className="posted-photo">
            <Duo
              backUrl={myPost.backUrl}
              frontUrl={myPost.frontUrl}
              frontMain={myPost.frontMain}
              ratio="3 / 4"
            />
          </div>
          <p className="eyebrow">Déjà en ligne</p>
          <h2 className="display-sm">Tu as déjà posté.</h2>
          <p className="posted-meta">
            {fmtTime(myPost.createdAt)} · <LateBadge seconds={myPost.lateSeconds} />
          </p>
          <div className="posted-actions">
            <button
              type="button"
              className="btn btn-primary btn-wide"
              onClick={() => {
                onViewPost(myPost);
                close();
              }}
            >
              Voir mon BeReal
            </button>
            {!confirmDelete ? (
              <button type="button" className="btn btn-ghost btn-wide" onClick={() => setConfirmDelete(true)}>
                Supprimer et reprendre
              </button>
            ) : (
              <div className="confirm-box">
                <p>Supprimer ton BeReal du jour ? La photo part pour de bon.</p>
                <div className="confirm-actions">
                  <button type="button" className="btn btn-danger btn-wide" onClick={removeMyPost} disabled={deleting}>
                    {deleting ? "Suppression…" : "Oui, supprimer"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-wide" onClick={() => setConfirmDelete(false)}>
                    Laisse tomber
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="fineprint">Un seul BeReal par jour. C’est la règle.</p>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="capture capture-error">
        <header className="capture-top">
          <button type="button" className="icon-btn icon-btn-dark" onClick={close} aria-label="Fermer">
            <XIcon size={22} />
          </button>
          <span className="capture-title">{importMode ? "Importer" : "La caméra"}</span>
          <span className="capture-spacer" />
        </header>
        <div className="error-wrap">
          <p className="eyebrow">{importMode ? "Depuis tes fichiers" : "Oups"}</p>
          <h2 className="display-sm">
            {importMode ? (
              <>
                Choisis deux
                <br />
                photos.
              </>
            ) : (
              <>
                Pas de caméra,
                <br />
                pas de panique.
              </>
            )}
          </h2>
          <p className="lede">
            {error ||
              (importMode
                ? "La première : ce que tu as devant toi. La deuxième : ton selfie. On s’occupe du reste."
                : "L’accès à la caméra a échoué.")}
          </p>
          {!importMode && !cameraMissing && (
            <button type="button" className="btn btn-primary btn-wide" onClick={backToCamera}>
              Réessayer
            </button>
          )}
          <div className="fallback-uploads">
            <div className="fallback-head">
              <ImageIcon size={18} />
              <span>{importMode ? "Tes deux photos" : "Ou importe deux photos"}</span>
            </div>
            <label className={`upload-row ${selectedBack ? "is-chosen" : ""}`}>
              <span className="upload-thumb">
                {backPreview ? <img src={backPreview} alt="" /> : <ImageIcon size={16} />}
              </span>
              <span className="upload-copy">
                <span className="upload-title">01 — Le décor</span>
                <span className="upload-sub">
                  {selectedBack ? selectedBack.name : "Ce que tu as devant toi"}
                </span>
              </span>
              <span className="upload-state">{selectedBack ? "Changer" : "Choisir"}</span>
              <input
                className="upload-input"
                type="file"
                accept="image/*"
                aria-label="Choisir la photo du décor"
                disabled={busy}
                onClick={(e) => {
                  (e.currentTarget as HTMLInputElement).value = "";
                }}
                onChange={(e) => setSelectedBack(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className={`upload-row ${selectedFront ? "is-chosen" : ""}`}>
              <span className="upload-thumb">
                {frontPreview ? <img src={frontPreview} alt="" /> : <ImageIcon size={16} />}
              </span>
              <span className="upload-copy">
                <span className="upload-title">02 — Ton selfie</span>
                <span className="upload-sub">
                  {selectedFront ? selectedFront.name : "Ta tête, maintenant"}
                </span>
              </span>
              <span className="upload-state">{selectedFront ? "Changer" : "Choisir"}</span>
              <input
                className="upload-input"
                type="file"
                accept="image/*"
                aria-label="Choisir la photo de ton selfie"
                disabled={busy}
                onClick={(e) => {
                  (e.currentTarget as HTMLInputElement).value = "";
                }}
                onChange={(e) => setSelectedFront(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary btn-wide upload-continue"
              disabled={!selectedBack || !selectedFront || busy}
              onClick={() => {
                if (selectedBack && selectedFront) void useFiles(selectedBack, selectedFront);
              }}
            >
              {busy ? (
                <>
                  <span className="spinner" /> On prépare…
                </>
              ) : (
                "Continuer"
              )}
            </button>
            {importMode ? (
              <button type="button" className="btn btn-ghost btn-wide" onClick={backToCamera} disabled={busy}>
                Revenir à la caméra
              </button>
            ) : (
              <p className="fineprint">
                Format portrait conseillé. Une photo de ton quotidien, pas une pose.
              </p>
            )}
          </div>
          {!importMode && cameraMissing && (
            <button type="button" className="text-link upload-retry" onClick={backToCamera}>
              Réessayer la caméra
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "review" || phase === "publishing") {
    return (
      <div className="capture capture-review">
        <header className="capture-top capture-top-dark">
          <button type="button" className="icon-btn" onClick={close} aria-label="Fermer">
            <XIcon size={22} />
          </button>
          <span className="capture-title">Ton BeReal</span>
          <button type="button" className="icon-btn" onClick={retake} aria-label="Reprendre la photo">
            <SwapIcon size={20} />
          </button>
        </header>
        <div className="review-scroll">
          <div className="review-media">
            <Duo
              backUrl={shots!.backUrl}
              frontUrl={shots!.frontUrl}
              frontMain={frontMain}
              ratio="3 / 4"
            />
            {phase === "publishing" && (
              <div className="publish-overlay">
                <span className="spinner" />
                <p>On publie…</p>
              </div>
            )}
          </div>
          <div className="review-body">
            <div className="review-meta-row">
              <span className="mono">{fmtTime(Date.now())}</span>
              <LateBadge seconds={lateNow} />
              <span className="mono muted">{retakes > 0 ? `${retakes} reprise${retakes > 1 ? "s" : ""}` : "1re prise"}</span>
            </div>
            <label className="field">
              <span className="field-label">Une légende (facultatif)</span>
              <input
                className="input"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Ce que tu fais, là, maintenant"
                maxLength={180}
              />
            </label>
            <label className="field">
              <span className="field-label">T’es où ? (facultatif)</span>
              <input
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Paris 11e"
                maxLength={40}
              />
            </label>
            <div className="field">
              <span className="field-label">Qui peut voir ça</span>
              <div className="segmented">
                <button
                  type="button"
                  aria-pressed={visibility === "friends"}
                  onClick={() => setVisibility("friends")}
                >
                  Mes potes
                </button>
                <button
                  type="button"
                  aria-pressed={visibility === "public"}
                  onClick={() => setVisibility("public")}
                >
                  Public
                </button>
              </div>
            </div>
            {publishError && <p className="form-error">{publishError}</p>}
            <p className="fineprint">
              {lateNow > 120
                ? `Tu publies ${lateLabel(lateNow)}. Ça comptera sur ton profil.`
                : "Dans les temps. Bien joué."}
            </p>
          </div>
        </div>
        <footer className="review-footer">
          <div className="review-footer-inner">
            <button
              type="button"
              className="btn btn-primary"
              onClick={publish}
              disabled={phase === "publishing"}
            >
              {phase === "publishing" ? "On publie…" : "Publier mon BeReal"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={retake}
              disabled={phase === "publishing"}
            >
              Reprendre
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="capture capture-live">
      <div className={`live-view ${frontMain ? "is-front-main" : ""}`}>
        <video
          ref={backVideoRef}
          className="cam cam-back"
          autoPlay
          muted
          playsInline
          aria-label="Caméra arrière"
        />
        <video
          ref={frontVideoRef}
          className="cam cam-front"
          autoPlay
          muted
          playsInline
          aria-label="Caméra avant"
        />
        <div className="live-scrim live-scrim-top" />
        <div className="live-scrim live-scrim-bottom" />
        {flashScreen && <div className="screen-flash" />}
        {counting !== null && (
          <div className="countdown">
            <span>{counting}</span>
          </div>
        )}
        {switching && (
          <div className="switching">
            <span className="spinner" />
            <p>Ton selfie…</p>
          </div>
        )}
        {phase === "starting" && (
          <div className="camera-loading">
            <span className="spinner" />
            <p>On ouvre la caméra…</p>
          </div>
        )}
      </div>

      <header className="capture-top capture-top-float">
        <button type="button" className="icon-btn icon-btn-dark" onClick={close} aria-label="Fermer">
          <XIcon size={22} />
        </button>
        <span className="capture-title">breal<span className="wordmark-dot">.</span></span>
        <div className="capture-tools">
          <button
            type="button"
            className={`tool-btn ${flashOn ? "is-on" : ""}`}
            onClick={() => setFlashOn((f) => !f)}
            aria-pressed={flashOn}
            aria-label="Flash"
          >
            <FlashIcon size={18} />
          </button>
          <button
            type="button"
            className={`tool-btn ${timer > 0 ? "is-on" : ""}`}
            onClick={() => setTimer((t) => (t === 0 ? 3 : t === 3 ? 10 : 0))}
            aria-label="Retardateur"
          >
            <TimerIcon size={18} />
            <span>{flashLabel}</span>
          </button>
        </div>
      </header>

      <div className="capture-bottom">
        <div className="capture-actions">
          <button
            type="button"
            className="gallery-btn"
            onClick={switchToImport}
            aria-label="Importer deux photos"
          >
            <ImageIcon size={20} />
            <span>Importer</span>
          </button>
          <button
            type="button"
            className="shutter"
            onClick={take}
            disabled={phase !== "live" || busy}
            aria-label="Prendre la photo"
          >
            <span className="shutter-ring" />
            <span className="shutter-core" />
          </button>
          <button
            type="button"
            className="gallery-btn"
            onClick={() => setFrontMain((v) => !v)}
            aria-label="Inverser la grande et la petite photo"
          >
            <SwapIcon size={20} />
            <span>Inverser</span>
          </button>
        </div>
        <p className="capture-hint">
          {dual ? "Double caméra prête. Appuie, c’est tout." : "Appuie, puis on prend ton selfie."}
        </p>
        <p className="capture-late">
          {lateNow > 120 ? `${lateLabel(lateNow)} — assume.` : "Dans les temps."}
        </p>
      </div>
    </div>
  );
}
