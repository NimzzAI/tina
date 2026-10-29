import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DownloadStream } from '../types';

function formatTimeCode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function extractYouTubeId(webpageUrl?: string, streamId?: string): string | null {
  if (webpageUrl) {
    const m = webpageUrl.match(
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i
    );
    if (m?.[1]) return m[1];
  }
  if (streamId) {
    const m2 = streamId.match(/^yt_([A-Za-z0-9_-]{11})_/);
    if (m2?.[1]) return m2[1];
  }
  return null;
}

function extractSpotifyTrackId(webpageUrl?: string, streamId?: string): string | null {
  if (webpageUrl) {
    const m = webpageUrl.match(/spotify\.com\/(?:intl-[a-z-]+\/)?(track|episode)\/([A-Za-z0-9]+)/i);
    if (m?.[2]) return m[2];
  }
  if (streamId) {
    const m2 = streamId.match(/^sp_([A-Za-z0-9]+)_/);
    if (m2?.[1]) return m2[1];
  }
  return null;
}

interface V10VideoPlayerProps {
  activeStream: DownloadStream;
  videoStreams: DownloadStream[];
  poster?: string;
  title: string;
  webpageUrl?: string;
  onSelectStream: (stream: DownloadStream) => void;
  onDownload: (stream: DownloadStream) => void;
  buildStreamUrl: (url: string) => string;
}

export function V10VideoPlayer({
  activeStream,
  videoStreams,
  poster,
  title,
  webpageUrl,
  onSelectStream,
  onDownload,
  buildStreamUrl,
}: V10VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resumeTimeRef = useRef<number>(0);
  const wasPlayingRef = useRef<boolean>(false);

  const youtubeId = extractYouTubeId(webpageUrl, activeStream.id);
  const isSampleFallbackStream =
    activeStream.url.includes('commondatastorage.googleapis.com');

  const [useYoutubeEmbed, setUseYoutubeEmbed] = useState<boolean>(
    Boolean(youtubeId && isSampleFallbackStream)
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isWaiting, setIsWaiting] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedPct, setBufferedPct] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showHud, setShowHud] = useState<boolean>(true);
  const [resMenuOpen, setResMenuOpen] = useState<boolean>(false);
  const [pulseAction, setPulseAction] = useState<'play' | 'pause' | null>(null);
  const [fallbackStage, setFallbackStage] = useState<number>(0);

  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const ytId = extractYouTubeId(webpageUrl, activeStream.id);
    const isFallback =
      activeStream.url.includes('commondatastorage.googleapis.com');
    setUseYoutubeEmbed(Boolean(ytId && isFallback));
    setFallbackStage(0);
  }, [webpageUrl, activeStream.id, activeStream.url]);

  const triggerHudVisibility = useCallback(() => {
    setShowHud(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowHud(false);
        setResMenuOpen(false);
      }
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Preserve playback time when switching resolutions
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || useYoutubeEmbed) return;
    setIsWaiting(true);
    const handleLoaded = () => {
      setIsWaiting(false);
      setDuration(vid.duration || 0);
      vid.playbackRate = playbackRate;
      vid.volume = volume;
      vid.muted = isMuted;
      if (resumeTimeRef.current > 0 && resumeTimeRef.current < (vid.duration || Infinity)) {
        vid.currentTime = resumeTimeRef.current;
      }
      if (wasPlayingRef.current) {
        vid.play().catch(() => {});
      }
    };
    vid.addEventListener('loadedmetadata', handleLoaded, { once: true });
    return () => vid.removeEventListener('loadedmetadata', handleLoaded);
  }, [activeStream.url, useYoutubeEmbed]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setPulseAction('play');
    } else {
      vid.pause();
      setPulseAction('pause');
    }
    window.setTimeout(() => setPulseAction(null), 450);
    triggerHudVisibility();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vid = videoRef.current;
    if (!vid || !duration) return;
    const nextTime = Number(e.target.value);
    vid.currentTime = nextTime;
    setCurrentTime(nextTime);
    triggerHudVisibility();
  };

  const skipSeconds = (delta: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    const target = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + delta));
    vid.currentTime = target;
    setCurrentTime(target);
    triggerHudVisibility();
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const nextMuted = !isMuted;
    vid.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vid = videoRef.current;
    if (!vid) return;
    const val = Number(e.target.value);
    vid.volume = val;
    vid.muted = val === 0;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  const handleSwitchResolution = (stream: DownloadStream) => {
    if (videoRef.current) {
      resumeTimeRef.current = videoRef.current.currentTime || 0;
      wasPlayingRef.current = !videoRef.current.paused;
    }
    setResMenuOpen(false);
    onSelectStream(stream);
  };

  const togglePiP = async () => {
    const vid = videoRef.current;
    if (!vid) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (vid.requestPictureInPicture) {
        await vid.requestPictureInPicture();
      }
    } catch {
      // ignore
    }
  };

  const toggleFullscreen = async () => {
    const box = containerRef.current;
    if (!box) return;
    try {
      if (!document.fullscreenElement) {
        await box.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const activeResLabel =
    activeStream.resolution ||
    activeStream.quality.match(/\b(2160p|1440p|1080p|720p|540p|480p|360p|HD|SD)\b/i)?.[1] ||
    'HD';

  const resolvedVideoSrc = (() => {
    if (
      activeStream.needsResolve ||
      activeStream.url.startsWith('theresav_resolve:') ||
      activeStream.url.startsWith('youtube_resolve:') ||
      activeStream.url.startsWith('ytmp3gg_resolve:')
    ) {
      return `/api/proxy-stream?url=${encodeURIComponent(activeStream.url)}&ext=mp4`;
    }
    const base = buildStreamUrl(activeStream.url);
    if (fallbackStage === 0) return base;
    if (base.startsWith('/api/proxy-stream')) return activeStream.url;
    return `/api/proxy-stream?url=${encodeURIComponent(activeStream.url)}&ext=mp4`;
  })();

  if (useYoutubeEmbed && youtubeId) {
    return (
      <div className="space-y-2">
        <div className="relative w-full aspect-video bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=0&playsinline=1&rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
          <span>V10 YOUTUBE DIRECT STREAM · ID: {youtubeId}</span>
          <button
            type="button"
            onClick={() => setUseYoutubeEmbed(false)}
            className="px-2.5 py-1 rounded-md border border-neutral-300 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300 font-semibold transition-colors cursor-pointer"
          >
            Beralih ke Pemutar HTML5 Native
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={triggerHudVisibility}
      onMouseLeave={() => {
        if (isPlaying) {
          setShowHud(false);
          setResMenuOpen(false);
        }
      }}
      className="relative w-full aspect-video bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden select-none group"
    >
      {/* Core HTML5 Video Element (Native controls disabled — V10 Custom HUD) */}
      <video
        ref={videoRef}
        src={resolvedVideoSrc}
        poster={poster || undefined}
        playsInline
        preload="metadata"
        referrerPolicy="no-referrer"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onError={() => {
          setIsWaiting(false);
          if (fallbackStage === 0 && activeStream.url) {
            setFallbackStage(1);
          } else if (youtubeId) {
            setUseYoutubeEmbed(true);
          }
        }}
        onPlay={() => {
          setIsPlaying(true);
          triggerHudVisibility();
        }}
        onPause={() => {
          setIsPlaying(false);
          setShowHud(true);
        }}
        onWaiting={() => setIsWaiting(true)}
        onPlaying={() => setIsWaiting(false)}
        onCanPlay={() => setIsWaiting(false)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          setIsWaiting(false);
        }}
        onTimeUpdate={(e) => {
          const vid = e.currentTarget;
          setCurrentTime(vid.currentTime || 0);
          if (vid.buffered.length > 0 && vid.duration > 0) {
            const end = vid.buffered.end(vid.buffered.length - 1);
            setBufferedPct(Math.min(100, (end / vid.duration) * 100));
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setShowHud(true);
        }}
        className="w-full h-full object-contain cursor-pointer bg-neutral-950"
      />

      {/* Top V10 Media Player Header */}
      <AnimatePresence>
        {(showHud || !isPlaying) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute top-0 inset-x-0 px-4 py-3 bg-gradient-to-b from-black/80 via-black/35 to-transparent flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 text-[11px] font-mono tracking-wider text-neutral-200 pointer-events-none">
              <span className="w-2 h-2 rounded-xs bg-white inline-block" />
              <span className="font-bold">V10 MEDIA PLAYER</span>
              <span className="text-neutral-500">·</span>
              <span className="text-neutral-300">{activeResLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              {youtubeId && (
                <button
                  type="button"
                  onClick={() => setUseYoutubeEmbed(true)}
                  className="px-2 py-0.5 rounded-md bg-white/15 hover:bg-white/25 text-white text-[10px] font-mono font-bold transition-colors cursor-pointer"
                >
                  Mode YouTube Asli
                </button>
              )}
              <div className="text-[11px] font-mono text-neutral-400 truncate max-w-[180px] sm:max-w-[260px] pointer-events-none">
                {title}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center Play / Pause / Buffering Indicator */}
      <AnimatePresence>
        {isWaiting && (
          <motion.div
            key="buffering"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-12 h-12 rounded-lg bg-black/75 border border-white/20 text-white flex items-center justify-center">
              <i className="fa-solid fa-circle-notch fa-spin text-base" />
            </div>
          </motion.div>
        )}

        {!isPlaying && !isWaiting && (
          <motion.button
            key="big-play"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            type="button"
            onClick={togglePlay}
            aria-label="Putar Video"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-xl bg-white/95 hover:bg-white text-neutral-950 flex items-center justify-center shadow-2xl transition-transform hover:scale-105 cursor-pointer"
          >
            <i className="fa-solid fa-play text-base ml-0.5" />
          </motion.button>
        )}

        {pulseAction && (
          <motion.div
            key="pulse-feedback"
            initial={{ opacity: 0.85, scale: 0.85 }}
            animate={{ opacity: 0, scale: 1.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-xl bg-black/70 border border-white/25 text-white flex items-center justify-center pointer-events-none"
          >
            <i className={`fa-solid ${pulseAction === 'play' ? 'fa-play' : 'fa-pause'} text-base`} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom V10 Control Console */}
      <AnimatePresence>
        {(showHud || !isPlaying) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16 }}
            className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-6 pb-3 px-4 space-y-2.5"
          >
            {/* Interactive Scrubber Timeline */}
            <div className="relative h-4 flex items-center group/scrub">
              <div className="w-full h-1 group-hover/scrub:h-1.5 bg-white/20 rounded-xs overflow-hidden relative transition-all">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-white/35 transition-all"
                  style={{ width: `${bufferedPct}%` }}
                />
                <div
                  className="absolute left-0 top-0 bottom-0 bg-white transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div
                className="w-2.5 h-2.5 rounded-xs bg-white shadow pointer-events-none absolute -translate-x-1/2 transition-transform group-hover/scrub:scale-125"
                style={{ left: `${progressPct}%` }}
              />

              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                aria-label="Timeline Video"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* Bottom Controls Bar */}
            <div className="flex items-center justify-between gap-2 text-white text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Jeda' : 'Putar'}
                  className="w-7 h-7 rounded-md hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => skipSeconds(-5)}
                  title="Mundur 5 detik"
                  className="w-7 h-7 rounded-md hover:bg-white/15 hidden sm:flex items-center justify-center text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-rotate-left text-[11px]" />
                </button>

                <button
                  type="button"
                  onClick={() => skipSeconds(5)}
                  title="Maju 5 detik"
                  className="w-7 h-7 rounded-md hover:bg-white/15 hidden sm:flex items-center justify-center text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-rotate-right text-[11px]" />
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label="Volume"
                    className="w-7 h-7 rounded-md hover:bg-white/15 flex items-center justify-center text-neutral-200 cursor-pointer"
                  >
                    <i
                      className={`fa-solid ${
                        isMuted || volume === 0
                          ? 'fa-volume-xmark text-neutral-400'
                          : volume < 0.5
                            ? 'fa-volume-low'
                            : 'fa-volume-high'
                      }`}
                    />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    aria-label="Pengatur Volume"
                    className="w-14 sm:w-16 h-1 accent-white bg-white/25 rounded-xs cursor-pointer hidden sm:block"
                  />
                </div>

                <div className="font-mono text-[11px] tabular-nums text-neutral-300 pl-1">
                  <span className="text-white font-semibold">{formatTimeCode(currentTime)}</span>
                  <span className="mx-1 text-neutral-500">/</span>
                  <span>{formatTimeCode(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 relative">
                <button
                  type="button"
                  onClick={cycleSpeed}
                  title="Kecepatan Putar"
                  className="px-2 py-1 rounded-md hover:bg-white/15 font-mono text-[11px] tabular-nums text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  {playbackRate}x
                </button>

                {videoStreams.length > 1 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setResMenuOpen((prev) => !prev)}
                      className="px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 font-mono text-[11px] font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-sliders text-[10px]" />
                      <span>{activeResLabel}</span>
                    </button>

                    <AnimatePresence>
                      {resMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.14 }}
                          className="absolute right-0 bottom-9 w-56 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-1.5 z-30"
                        >
                          <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                            Pilih Resolusi V10
                          </div>
                          <div className="py-1 max-h-48 overflow-y-auto space-y-0.5">
                            {videoStreams.map((vs, idx) => {
                              const active = vs.url === activeStream.url;
                              return (
                                <button
                                  key={vs.id || idx}
                                  type="button"
                                  onClick={() => handleSwitchResolution(vs)}
                                  className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-mono flex items-center justify-between transition-colors cursor-pointer ${
                                    active
                                      ? 'bg-white text-neutral-950 font-bold'
                                      : 'text-neutral-300 hover:bg-neutral-800'
                                  }`}
                                >
                                  <span className="truncate">{vs.quality}</span>
                                  {active && <i className="fa-solid fa-check text-[10px] ml-2" />}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <button
                  type="button"
                  onClick={togglePiP}
                  title="Picture-in-Picture"
                  className="w-7 h-7 rounded-md hover:bg-white/15 hidden sm:flex items-center justify-center text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  <i className="fa-regular fa-window-restore text-[11px]" />
                </button>

                <button
                  type="button"
                  onClick={() => onDownload(activeStream)}
                  title="Unduh Video Ini"
                  className="w-7 h-7 rounded-md hover:bg-white/15 flex items-center justify-center text-neutral-200 hover:text-white transition-colors cursor-pointer"
                >
                  <i className="fa-solid fa-download text-[11px]" />
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title="Layar Penuh"
                  className="w-7 h-7 rounded-md hover:bg-white/15 flex items-center justify-center text-neutral-200 hover:text-white transition-colors cursor-pointer"
                >
                  <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'} text-xs`} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function parseDurationHintSeconds(hint?: string): number {
  if (!hint) return 0;
  const parts = hint
    .trim()
    .split(':')
    .map((p) => Number(p.trim()));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

interface V10AudioPlayerProps {
  stream: DownloadStream;
  title: string;
  author: string;
  thumbnail?: string;
  webpageUrl?: string;
  durationHint?: string;
  compact?: boolean;
  onDownload: (stream: DownloadStream) => void;
  buildStreamUrl: (url: string) => string;
}

export function V10AudioPlayer({
  stream,
  title,
  author,
  thumbnail,
  webpageUrl,
  durationHint,
  compact = false,
  onDownload,
  buildStreamUrl,
}: V10AudioPlayerProps) {
  const audioRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(() => parseDurationHintSeconds(durationHint));
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [fallbackStage, setFallbackStage] = useState<number>(0);
  const [resolvedTokenUrl, setResolvedTokenUrl] = useState<string | null>(null);
  const [showSpotifyEmbed, setShowSpotifyEmbed] = useState<boolean>(false);

  const spotifyTrackId = extractSpotifyTrackId(webpageUrl, stream.id);

  useEffect(() => {
    setFallbackStage(0);
    setResolvedTokenUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(parseDurationHintSeconds(durationHint));

    if (
      stream.needsResolve ||
      stream.url.startsWith('spotidown_resolve:') ||
      stream.url.startsWith('applemusic_resolve:') ||
      stream.url.startsWith('youtube_resolve:') ||
      stream.url.startsWith('ytmp3gg_resolve:') ||
      stream.url.startsWith('theresav_resolve:')
    ) {
      fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenUrl: stream.url }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d?.url) {
            setResolvedTokenUrl(`/api/proxy-stream?url=${encodeURIComponent(d.url)}&ext=mp3`);
          }
        })
        .catch(() => {});
    }
  }, [stream.url, stream.needsResolve, durationHint]);

  const effectiveAudioSrc = (() => {
    if (resolvedTokenUrl) return resolvedTokenUrl;
    if (
      stream.url.startsWith('spotidown_resolve:') ||
      stream.url.startsWith('applemusic_resolve:') ||
      stream.url.startsWith('youtube_resolve:') ||
      stream.url.startsWith('ytmp3gg_resolve:') ||
      stream.url.startsWith('theresav_resolve:')
    ) {
      return `/api/proxy-stream?url=${encodeURIComponent(stream.url)}&ext=${stream.ext || 'mp3'}`;
    }
    const base = buildStreamUrl(stream.url);
    if (fallbackStage === 0) return base;
    if (fallbackStage === 1) {
      return base.startsWith('/api/proxy-stream')
        ? stream.url
        : `/api/proxy-stream?url=${encodeURIComponent(stream.url)}&ext=${stream.ext || 'mp3'}`;
    }
    return `/api/proxy-stream?url=${encodeURIComponent(stream.url)}&ext=${stream.ext || 'mp3'}`;
  })();

  const togglePlay = () => {
    const aud = audioRef.current;
    if (!aud) return;
    if (aud.paused) {
      aud.play().catch(() => {
        if (fallbackStage < 1) setFallbackStage((s) => s + 1);
      });
    } else {
      aud.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const aud = audioRef.current;
    if (!aud || !duration) return;
    const next = Number(e.target.value);
    aud.currentTime = next;
    setCurrentTime(next);
  };

  const toggleMute = () => {
    const aud = audioRef.current;
    if (!aud) return;
    aud.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80 ${
        compact ? 'p-3' : 'p-5'
      }`}
    >
      <video
        ref={audioRef}
        src={effectiveAudioSrc}
        playsInline
        preload="metadata"
        className="hidden"
        onError={() => {
          if (fallbackStage < 1) {
            setFallbackStage((prev) => prev + 1);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => {
          const loadedDur = e.currentTarget.duration;
          const hintDur = parseDurationHintSeconds(durationHint);
          if (Number.isFinite(loadedDur) && loadedDur > 0) {
            if (loadedDur >= 5 && !stream.url.includes('mp3-preview')) {
              setDuration(loadedDur);
            } else if (hintDur > 0) {
              setDuration(hintDur);
            } else {
              setDuration(loadedDur);
            }
          }
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
        onEnded={() => setIsPlaying(false)}
      />

      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shrink-0 flex items-center justify-center">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <i className="fa-solid fa-music text-lg text-neutral-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                V10 AUDIO DECK · {stream.ext?.toUpperCase() || 'MP3'}
              </div>
              <div className="text-sm font-bold text-neutral-950 dark:text-white truncate mt-0.5">
                {title}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                {author} · {stream.quality}
              </div>
            </div>
          </div>

          {spotifyTrackId && (
            <button
              type="button"
              onClick={() => setShowSpotifyEmbed((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-neutral-100 transition-colors cursor-pointer shrink-0"
            >
              <i className="fa-brands fa-spotify mr-1.5" />
              {showSpotifyEmbed ? 'Tutup Embed Spotify' : 'Pemutar Resmi Spotify'}
            </button>
          )}
        </div>
      )}

      {!compact && showSpotifyEmbed && spotifyTrackId && (
        <div className="mb-4 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
          <iframe
            src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator&theme=0`}
            width="100%"
            height="152"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            title={title}
            className="border-0 block"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Jeda Audio' : 'Putar Audio'}
          className="w-9 h-9 rounded-lg bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 flex items-center justify-center shrink-0 transition-opacity cursor-pointer"
        >
          <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xs`} />
        </button>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
            <span className="truncate font-sans font-semibold text-neutral-800 dark:text-neutral-200">
              {compact ? stream.quality : 'Timeline Audio'}
            </span>
            <span className="shrink-0">
              {formatTimeCode(currentTime)} / {formatTimeCode(duration)}
            </span>
          </div>

          <div className="relative h-2 flex items-center">
            <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-800 rounded-xs overflow-hidden">
              <div
                className="h-full bg-neutral-950 dark:bg-white transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              aria-label="Seek Audio"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          className="w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center shrink-0 cursor-pointer"
        >
          <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'} text-xs`} />
        </button>

        <button
          type="button"
          onClick={() => onDownload(stream)}
          className="px-3 py-2 rounded-lg bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 text-xs font-bold hover:opacity-90 shrink-0 cursor-pointer"
        >
          <i className="fa-solid fa-arrow-down mr-1.5" />
          MP3
        </button>
      </div>
    </div>
  );
}
