// Every project on the creative page: the work grid, the Mac's slideshow and the project windows
// all read from here. Images live in public/assets/work/<slug>/NN.webp (+ NN-sm.webp, 640px wide).
// Pulled from Krish's Behance (behance.net/theinvrangers); originals in content/behance/.
// Facts and results only from content/about.md or Krish's own Behance text: nothing invented.

import PLACEHOLDERS from './placeholders.json';

export const CATEGORIES = ['Thumbnails', 'Social Media', 'Branding', 'Video'];

// lqip: a 20px-wide blurred preview (data URI), shown while the real image loads.
// Regenerate after adding images: see the note in design-system/pages/creative.md.
const img = (slug, n, w, h) => {
  const nn = String(n).padStart(2, '0');
  return { src: `/assets/work/${slug}/${nn}.webp`, sm: `/assets/work/${slug}/${nn}-sm.webp`, w, h, lqip: PLACEHOLDERS[`${slug}/${nn}`] };
};
// Any other named image in the folder (Krish's posts p1…, the PDF's sheet-1…).
const part = (slug, name, w, h) => ({ src: `/assets/work/${slug}/${name}.webp`, sm: `/assets/work/${slug}/${name}-sm.webp`, w, h, lqip: PLACEHOLDERS[`${slug}/${name}`] });
// Krish's own cover thumbnails (cover.webp / cover-sm.webp in each project folder).
const cover = (slug, w, h) => ({ src: `/assets/work/${slug}/cover.webp`, sm: `/assets/work/${slug}/cover-sm.webp`, w, h, lqip: PLACEHOLDERS[`${slug}/cover`] });

// On hover, a card cycles through its own project's images: `hover` if set (Krish's picks),
// otherwise the project's gallery.
//
// Card sizes (three only, so the grid never looks random). Cover thumbnails, exported at 2×:
//   feature  16:10  2400 × 1500 px   big landscape (8 of 12 columns, two rows tall)
//   tall      4:5   1600 × 2000 px   portrait, beside the feature
//   half     16:9   2400 × 1350 px   landscape, two side by side
// Keep text and faces inside the middle ~85% (cards crop a little on some screens).

export const PROJECTS = [
  {
    slug: 'rochak-thumbnails',
    title: 'YouTube Thumbnails',
    subtitle: 'Sports & storytelling',
    category: 'Thumbnails',
    client: 'Rochak For Sports + my own channel',
    size: 'feature',
    cover: cover('rochak-thumbnails', 1600, 1000),
    result: 'Thumbnails for @rochakforsports while the channel grew from 60K to 200K subscribers.',
    about:
      'A curated collection of high-performing YouTube thumbnails for sports and creator-led content: my work with @rochakforsports, plus self-directed concepts for my personal channel.',
    tools: ['Photoshop', 'Figma'],
    behance: 'https://www.behance.net/gallery/246815241/YouTube-Thumbnail-Portfolio-Sports-Storytelling',
    // the full portfolio PDF, shown as a scrollable document (one long page, cut in 4 for loading)
    doc: { name: 'thumbnailportfolio.pdf', w: 1400, parts: [1, 2, 3, 4].map((n) => part('rochak-thumbnails', `sheet-${n}`, 1400, n === 4 ? 1148 : 1149)) },
    hover: [img('rochak-thumbnails', 1, 1400, 600), img('rochak-thumbnails', 3, 1400, 995), img('rochak-thumbnails', 4, 1400, 600), img('rochak-thumbnails', 5, 1400, 600), img('rochak-thumbnails', 6, 1400, 600)],
  },
  {
    slug: 'peeyo',
    title: 'Peeyo',
    subtitle: 'Social media feed',
    category: 'Social Media',
    client: 'Peeyo',
    viaKoach: true,
    size: 'tall',
    cover: cover('peeyo', 1600, 2000),
    tools: ['Photoshop', 'Figma'],
    behance: 'https://www.behance.net/gallery/240572435/PEEYO-BRANDING',
    // Krish's eight feed posts (4:5), then the Behance boards
    gallery: [...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => part('peeyo', `p${n}`, 1200, 1500)), img('peeyo', 1, 1400, 600), img('peeyo', 2, 1400, 876)],
    hover: [1, 3, 4, 5, 6, 7].map((n) => part('peeyo', `p${n}`, 1200, 1500)),
  },
  {
    slug: 'endura',
    title: 'Endura Fitness',
    subtitle: 'Social media feed',
    category: 'Social Media',
    client: 'Endura',
    viaKoach: true,
    size: 'half',
    cover: cover('endura', 1600, 900),
    tools: ['Photoshop', 'Figma'],
    behance: 'https://www.behance.net/gallery/214009703/Endura-Fitness-SM-Feed',
    gallery: [img('endura', 1, 1400, 600), img('endura', 4, 1400, 2332), img('endura', 5, 1400, 600), img('endura', 7, 1400, 600), img('endura', 2, 1400, 600)],
  },
  {
    slug: 'gourmet-greens',
    title: 'Gourmet Greens',
    subtitle: 'Social media feed',
    category: 'Social Media',
    client: 'Gourmet Greens',
    size: 'half',
    cover: cover('gourmet-greens', 1600, 900),
    tools: ['Photoshop', 'Figma'],
    behance: 'https://www.behance.net/gallery/211241539/Gourmet-Greens-SM-feed',
    gallery: [img('gourmet-greens', 1, 1400, 600), img('gourmet-greens', 2, 1080, 1080), img('gourmet-greens', 3, 1080, 1080), img('gourmet-greens', 4, 1080, 1080), img('gourmet-greens', 5, 1080, 1080), img('gourmet-greens', 6, 1080, 1080), img('gourmet-greens', 7, 1080, 1080)],
  },
];

export const projectBySlug = (slug) => PROJECTS.find((p) => p.slug === slug);
