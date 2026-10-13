// Spotify's official iFrame API, loaded only when the record player first needs it (no Spotify
// requests for visitors who never open it). Returns a controller for one embed:
//   load(uri, startAt), play(), pause(), seek(seconds), and onUpdate({ paused, position, duration })
// Logged-in Spotify listeners hear full songs; everyone else gets Spotify's 30-second previews.
let api = null;
function loadApi() {
  if (!api) {
    api = new Promise((resolve, reject) => {
      window.onSpotifyIframeApiReady = resolve;
      const s = document.createElement('script');
      s.src = 'https://open.spotify.com/embed/iframe-api/v1';
      s.async = true;
      s.onerror = () => {
        api = null;
        reject(new Error('Spotify could not load'));
      };
      document.head.append(s);
    });
  }
  return api;
}

export async function createSpotify(host, uri, { onUpdate, onReady } = {}) {
  const IFrameAPI = await loadApi();
  const el = document.createElement('div');
  host.append(el);
  return new Promise((resolve) => {
    IFrameAPI.createController(el, { uri, width: '100%', height: 152 }, (c) => {
      let current = uri;
      c.addListener('ready', () => onReady?.());
      c.addListener('playback_update', (e) => {
        const d = e.data || {};
        onUpdate?.({ paused: !!d.isPaused, buffering: !!d.isBuffering, position: (d.position || 0) / 1000, duration: (d.duration || 0) / 1000 });
      });
      resolve({
        load(next, startAt = 0) {
          if (next === current && !startAt) return false;
          current = next;
          c.loadUri(next, false, Math.round(startAt));
          return true;
        },
        play: () => c.play(),
        resume: () => c.resume(),
        pause: () => c.pause(),
        seek: (s) => c.seek(s),
        get uri() {
          return current;
        },
      });
    });
  });
}
