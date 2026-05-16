# Art Spinner

A slot machine that generates random art prompts and then creates the artwork using AI image generation. Pull the lever, watch three reels spin to a stop, and click **Generate Image** to produce whatever fate dealt you.

## How It Works

Three reels spin independently at different rates:

| Reel | Content | Spin Duration |
|------|---------|---------------|
| Left | Visual medium (oil painting, watercolor, mosaic…) | 2.0 s |
| Center | Artistic influencer (Monet, Basquiat, Hokusai…) | 2.7 s |
| Right | Art style (Impressionism, Surrealism, Vaporwave…) | 3.5 s |

Once all three lock, the sentence assembles:

> *Create a **[medium]** inspired by **[influencer]** in the style of **[style]**.*

Clicking **Generate Image** sends that prompt to [Pollinations.ai](https://pollinations.ai) — a free, no-auth image generation service — and displays the result at 1024 × 768 px with a randomised seed so every generation is unique.

## Running Locally

No install or build step required. Open `index.html` directly in a browser, or serve it with any static file server:

```bash
npx serve . -l 3000
# then open http://localhost:3000
```

## Project Structure

```
artspinner/
├── index.html   # Complete app — HTML, CSS, and JS in one file
└── package.json # Metadata + convenience start script
```

## Feature Overview

- **Slot machine animation** — 5 items visible per reel; centre item highlighted with gold brackets; items above and below dim and fade
- **Realistic spin feel** — fast phase cycles items every 55 ms; slowdown phase uses quadratic ease-out, ticking from 80 ms to 650 ms before locking
- **LED lights** — 22 bulbs alternate red and gold, chasing during spin and steady when idle
- **Lever** — clicks pull the arm down with a CSS spring animation; lever is disabled while reels are in motion
- **Gold lock glow** — each reel pulses gold when it stops
- **Image generation** — powered by Pollinations.ai (no API key, no account required)
- **Error handling** — loading spinner while generating; toast notification on failure; "Generate Again" reuses the current selection
- **Responsive** — adapts layout and reel heights for narrow viewports

## Data Sets

Each set has 20 entries and can be extended by editing the `DATA` array in `index.html`.

**Visual media types**
Oil Painting, Watercolor, Digital Illustration, Photograph, Charcoal Sketch, Ink Drawing, Mosaic, Stained Glass, Gouache Painting, Linocut Print, Screen Print, Acrylic Painting, Pastel Drawing, Collage, Fresco, Woodblock Print, Spray Paint Mural, Pencil Sketch, Tapestry, Sculpture

**Artistic influencers**
Claude Monet, Vincent van Gogh, Frida Kahlo, Pablo Picasso, Salvador Dalí, Georgia O'Keeffe, Banksy, Jean-Michel Basquiat, Andy Warhol, Katsushika Hokusai, Gustav Klimt, Rembrandt van Rijn, Leonardo da Vinci, Jackson Pollock, Yayoi Kusama, Edward Hopper, Wassily Kandinsky, Henri Matisse, René Magritte, Alphonse Mucha

**Artistic styles**
Impressionism, Cubism, Surrealism, Abstract Expressionism, Art Nouveau, Baroque, Pop Art, Minimalism, Romanticism, Pointillism, Fauvism, Dadaism, Constructivism, Expressionism, Post-Impressionism, Futurism, Gothic, Vaporwave, Psychedelic, Street Art

## Dependencies

| Dependency | Purpose | Loaded from |
|-----------|---------|-------------|
| [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) | Serif heading and prompt font | Google Fonts CDN |
| [Oswald](https://fonts.google.com/specimen/Oswald) | UI and reel label font | Google Fonts CDN |
| [Pollinations.ai](https://pollinations.ai) | AI image generation | External API |

No npm packages, no bundler, no framework.

## License

MIT
