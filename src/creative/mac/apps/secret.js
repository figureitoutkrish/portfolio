// MESSAGE.MOV: the secret floppy (hidden under a sticky note). Plays Krish's video message,
// QuickTime-style. Drop the file at public/assets/secret/message.mp4 (and an optional poster at
// message.jpg); until then it shows a "coming soon" card.
const SRC = '/assets/secret/message.mp4';
const POSTER = '/assets/secret/message.jpg';

export function mountSecret(body) {
  body.classList.add('os__body--movie');
  body.innerHTML = `
    <div class="movie__stage">
      <video class="movie__video" src="${SRC}" poster="${POSTER}" controls playsinline preload="metadata"></video>
      <div class="movie__soon" hidden>
        <span class="movie__reel" aria-hidden="true"></span>
        <p><b>a message from krish</b></p>
        <p>still recording this one. check back soon.</p>
      </div>
    </div>
    <p class="movie__caption">you found the secret disk. not many do.</p>`;
  const video = body.querySelector('video');
  const soon = body.querySelector('.movie__soon');
  const missing = () => {
    video.hidden = true;
    soon.hidden = false;
  };
  video.addEventListener('error', missing);
  // a poster 404 alone isn't "missing"; a missing video is
  fetch(SRC, { method: 'HEAD' })
    .then((r) => (!r.ok || !(r.headers.get('content-type') || '').startsWith('video') ? missing() : video.play().catch(() => {})))
    .catch(missing);
  return { unmount: () => video.pause() };
}
