// Every project on the creative page: the work grid, the Mac's slideshow and the project windows
// all read from here. Images live in public/assets/work/<slug>/NN.webp (+ NN-sm.webp, 640px wide).
// Pulled from Krish's Behance (behance.net/theinvrangers); originals in content/behance/.
// Facts and results only from content/about.md or Krish's own Behance text: nothing invented.

import PLACEHOLDERS from './placeholders.json';

export const CATEGORIES = ['Thumbnails', 'Social Media', 'Branding', 'Print', 'Video'];

// lqip: a 20px-wide blurred preview (data URI), shown while the real image loads.
// Regenerate after adding images: see the note in design-system/pages/creative.md.
const img = (slug, n, w, h) => {
  const nn = String(n).padStart(2, '0');
  return { src: `/assets/work/${slug}/${nn}.webp`, sm: `/assets/work/${slug}/${nn}-sm.webp`, w, h, lqip: PLACEHOLDERS[`${slug}/${nn}`] };
};
// On hover, a card cycles through its own project's images: `hover` if set (Krish's picks),
// otherwise the project's gallery.

export const PROJECTS = [
  {
    slug: 'rochak-thumbnails',
    title: 'YouTube Thumbnails',
    subtitle: 'Sports & storytelling',
    category: 'Thumbnails',
    client: 'Rochak For Sports + my own channel',
    size: 'feature',
    cover: img('rochak-thumbnails', 3, 1400, 995),
    result: 'Thumbnails for @rochakforsports while the channel grew from 60K to 200K subscribers.',
    about:
      'A curated collection of high-performing YouTube thumbnails for sports and creator-led content: my work with @rochakforsports, plus self-directed concepts for my personal channel.',
    tools: ['Photoshop', 'Figma'],
    behance: 'https://www.behance.net/gallery/246815241/YouTube-Thumbnail-Portfolio-Sports-Storytelling',
    gallery: [img('rochak-thumbnails', 1, 1400, 600), img('rochak-thumbnails', 3, 1400, 995), img('rochak-thumbnails', 4, 1400, 600), img('rochak-thumbnails', 5, 1400, 600), img('rochak-thumbnails', 6, 1400, 600)],
    galleryNote: 'raw frame → final thumbnail',
  },
  {
    slug: 'peeyo',
    title: 'Peeyo',
    subtitle: 'Social media feed',
    category: 'Social Media',
    client: 'Peeyo',
    viaKoach: true,
    size: 'tall',
    cover: img('peeyo', 2, 1400, 876),
    tools: ['Photoshop', 'Figma'],
    behance: 'https://www.behance.net/gallery/240572435/PEEYO-BRANDING',
    gallery: [img('peeyo', 1, 1400, 600), img('peeyo', 2, 1400, 876), img('peeyo', 5, 1400, 600), img('peeyo', 4, 1400, 600)],
  },
  {
    slug: 'atovio-ads',
    title: 'Atovio',
    subtitle: 'Video ads',
    category: 'Video',
    client: 'Atovio',
    viaKoach: true,
    size: 'square',
    placeholder: 'Video ads · send the links',
    result: 'Three ads that crossed 3M+ views across social platforms.',
    tools: ['Premiere Pro'],
  },
  {
    slug: 'endura',
    title: 'Endura Fitness',
    subtitle: 'Social media feed',
    category: 'Social Media',
    client: 'Endura',
    viaKoach: true,
    size: 'tall',
    cover: img('endura', 4, 1400, 2332),
    tools: ['Photoshop', 'Figma'],
    behance: 'https://www.behance.net/gallery/214009703/Endura-Fitness-SM-Feed',
    gallery: [img('endura', 1, 1400, 600), img('endura', 4, 1400, 2332), img('endura', 5, 1400, 600), img('endura', 7, 1400, 600), img('endura', 2, 1400, 600)],
  },
  {
    slug: 'recent-thumbnails',
    title: 'Podcast Thumbnails',
    subtitle: 'Creator & podcast covers',
    category: 'Thumbnails',
    size: 'wide',
    cover: img('recent-thumbnails', 2, 1400, 788),
    tools: ['Photoshop'],
    behance: 'https://www.behance.net/gallery/199997011/Recent-Thumbnail-Work',
    gallery: [img('recent-thumbnails', 2, 1400, 788), img('recent-thumbnails', 1, 1400, 788), img('recent-thumbnails', 3, 1400, 788)],
  },
  {
    slug: 'gourmet-greens',
    title: 'Gourmet Greens',
    subtitle: 'Social media feed',
    category: 'Social Media',
    client: 'Gourmet Greens',
    size: 'square',
    cover: img('gourmet-greens', 3, 1080, 1080),
    tools: ['Photoshop', 'Figma'],
    behance: 'https://www.behance.net/gallery/211241539/Gourmet-Greens-SM-feed',
    gallery: [img('gourmet-greens', 1, 1400, 600), img('gourmet-greens', 2, 1080, 1080), img('gourmet-greens', 3, 1080, 1080), img('gourmet-greens', 4, 1080, 1080), img('gourmet-greens', 5, 1080, 1080), img('gourmet-greens', 6, 1080, 1080), img('gourmet-greens', 7, 1080, 1080)],
  },
  {
    slug: 'elixir',
    title: 'Elixir',
    subtitle: 'Hangover recovery drink',
    category: 'Branding',
    size: 'wide',
    cover: img('elixir', 1, 1400, 1020),
    tools: ['Photoshop', 'Figma'],
    behance: 'https://www.behance.net/gallery/181800749/ELIXIR-the-hangover-recovery-drink',
    gallery: [img('elixir', 1, 1400, 1020), img('elixir', 2, 946, 1405), img('elixir', 3, 946, 1405), img('elixir', 4, 946, 1405), img('elixir', 5, 1005, 2648), img('elixir', 6, 1005, 2648), img('elixir', 7, 1005, 2648)],
  },
  {
    slug: 'tshirts',
    title: 'Merch Drops',
    subtitle: 'T-shirt designs',
    category: 'Branding',
    size: 'wide',
    cover: img('tshirts', 1, 1080, 1080),
    tools: ['Photoshop', 'Figma'],
    behance: 'https://www.behance.net/gallery/199996621/Tshirt-Mockups',
    gallery: [img('tshirts', 1, 1080, 1080), img('tshirts', 2, 1080, 1080), img('tshirts', 3, 1080, 1080), img('tshirts', 4, 1080, 1080)],
  },
  {
    slug: 'posters',
    title: 'Event Posters',
    subtitle: 'Poster series',
    category: 'Print',
    size: 'square',
    cover: img('posters', 1, 1080, 1080),
    tools: ['Figma'],
    behance: 'https://www.behance.net/gallery/199998123/Poster-Work',
    gallery: [img('posters', 1, 1080, 1080), img('posters', 2, 1080, 1080), img('posters', 3, 1080, 1080)],
  },
  {
    slug: 'logo-411',
    title: '411',
    subtitle: 'Logo design',
    category: 'Branding',
    size: 'small',
    cover: img('logo-411', 1, 1080, 1080),
    tools: ['Illustrator', 'Figma'],
    behance: 'https://www.behance.net/gallery/199997381/411-LOGO',
    gallery: [img('logo-411', 1, 1080, 1080)],
  },
  {
    slug: 'agency-poster',
    title: 'Agency Poster',
    subtitle: 'Editing & design services',
    category: 'Print',
    size: 'small',
    cover: img('agency-poster', 1, 1080, 1080),
    tools: ['Figma', 'Photoshop'],
    behance: 'https://www.behance.net/gallery/199998677/Content-Agency-Poster',
    gallery: [img('agency-poster', 1, 1080, 1080)],
  },
  {
    slug: 'newsletter',
    title: 'Newsletter',
    subtitle: 'Long-form layout',
    category: 'Print',
    size: 'tall',
    cover: img('newsletter', 1, 1400, 7219),
    coverPosition: 'top',
    tools: ['Figma'],
    behance: 'https://www.behance.net/gallery/199997747/Newsletter-Design',
    gallery: [img('newsletter', 1, 1400, 7219)],
  },
];

export const projectBySlug = (slug) => PROJECTS.find((p) => p.slug === slug);
