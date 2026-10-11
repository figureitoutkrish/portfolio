import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

// The site's motion curves (Emil Kowalski's set). Built-in eases are too weak to feel intentional.
// Mirrored as CSS tokens in styles/main.css (--ease-out, --ease-in-out, --ease-drawer).
//   ui-out    — anything entering or exiting: starts fast, so it feels instantly responsive
//   ui-in-out — things already on screen moving or morphing
//   drawer    — iOS-like sheet curve for large surfaces sweeping across the screen
gsap.registerPlugin(CustomEase);
CustomEase.create('ui-out', '0.23, 1, 0.32, 1');
CustomEase.create('ui-in-out', '0.77, 0, 0.175, 1');
CustomEase.create('drawer', '0.32, 0.72, 0, 1');
