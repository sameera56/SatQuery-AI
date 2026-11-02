<div align="center">

# ⬡ SATQUERY AI

### Satellite Intelligence, Disaster Analysis & Open-Source Situational Awareness

[![Live Demo](https://img.shields.io/badge/osirisai.live-00E5FF?style=for-the-badge&logo=vercel&logoColor=white)](https://osirislive.app)
[![Support OSIRIS](https://img.shields.io/badge/Support_Project-Patreon-FF424D?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/posts/159077425)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![MapLibre](https://img.shields.io/badge/MapLibre_GL-GPU_Rendered-396CB2?style=for-the-badge)](https://maplibre.org)
[![License](https://img.shields.io/badge/License-MIT-D4AF37?style=for-the-badge)](LICENSE)

**SATQUERY AI is an AI-powered satellite-image analysis system built into the OSIRIS global intelligence dashboard. Upload optical or SAR imagery, ask questions in natural language, compare images over time, and combine the result with live disaster and geospatial intelligence.**

[Live Demo](https://osirisai.live) · [Report Bug](https://github.com/sameera56/SatQuery-AI/issues) · [Request Feature](https://github.com/sameera56/SatQuery-AI/issues) · [Join Discord](https://discord.gg/umBykEpb98)

</div>

---

## Overview

SATQUERY AI extends the OSIRIS open-source intelligence platform with evidence-grounded remote-sensing analysis. Users can upload satellite images and ask questions such as *“Identify flooded areas and describe the visible evidence.”* The system returns a concise finding, localized evidence regions, confidence, and limitations instead of presenting an unsupported answer as fact.

Built with Next.js 16 and MapLibre GL, the dashboard renders live global intelligence data through WebGL for responsive interaction even when many entities are displayed.

### Key Capabilities

| Domain | Data Points | Sources |
|--------|------------|---------|
| **SATQUERY AI** | Optical, SAR, multimodal and change analysis | User-uploaded satellite images + Google Gemini |
| **Satellite scenes** | Sentinel-1 SAR and Sentinel-2 optical scene metadata | Element84 Earth Search, Copernicus STAC |
| **Aviation** | Commercial, Private, Military, Jets | OpenSky Network |
| **Maritime** | 39 Global Ports, 10 Chokepoints | Static Naval Intel |
| **CCTV** | 17,000+ Cameras | TfL, WSDOT, Caltrans, ODOT, MDOT, HK Transport Dept, Taiwan THB, NZTA + more |
| **Seismic** | Real-time M2.5+ | USGS Earthquake API |
| **Fires** | Active Hotspots | NASA FIRMS |
| **News** | 24/7 Live Streams | 25+ Global Broadcasters |
| **Weather** | Severe Events | NASA EONET |
| **Space** | Solar Weather, Satellites | NOAA SWPC, N2YO |
| **Cyber** | CVE Threats, Vulnerability Scanning | NVD, Custom Scanner |
| **Conflict** | 13 Active Zones | Static OSINT Intel |
| **Crypto** | BTC + ETH Wallet Tracing, OFAC SDN Match | blockstream.info, Blockscout, OpenSanctions |
| **Sanctions** | Person / Org / Vessel SDN Search | OpenSanctions (US OFAC SDN mirror) |
| **Telegram OSINT** | Geoparsed Posts from Public Channels | `t.me/s/<channel>` web preview |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                SATQUERY AI CLIENT                │
│  ┌────────────┐ ┌──────────┐ ┌────────────────┐ │
│  │ Image input │ │ MapLibre │ │ OSINT / RECON  │ │
│  │ + modes     │ │ GL (GPU) │ │ dashboard      │ │
│  └────────────┘ └──────────┘ └────────────────┘ │
├─────────────────────────────────────────────────┤
│               NEXT.JS API ROUTES                 │
│  /api/satquery/analyze /api/disaster-query      │
│  /api/flights          /api/earthquakes         │
│  /api/cctv            /api/news                 │
│  /api/fires           /api/maritime             │
│  /api/gdelt           /api/satellites           │
│  /api/weather         /api/scanner              │
│  /api/sentinel        /api/telegram-feed        │
│  /api/osint/*  (whois, dns, ip, cve, sanctions, │
│                 crypto, sweep, threats, …)      │
├─────────────────────────────────────────────────┤
│              EXTERNAL DATA SOURCES               │
│  Google Gemini · Sentinel / Copernicus · NASA   │
│  OpenSky · USGS · NOAA · TfL · NVD · EONET      │
│  GDACS · FIRMS · N2YO · CelesTrak · RSS Feeds  │
│  blockstream.info · Blockscout · OpenSanctions  │
│  t.me public previews                            │
└─────────────────────────────────────────────────┘
```

---

## Features

### SATQUERY AI — Satellite Image Analysis

SATQUERY AI turns a satellite image and a natural-language question into an evidence-grounded analyst report.

1. Select an analysis mode and upload a JPG, PNG, or WebP image (up to 12 MB).
2. Ask a focused question, for example: *“Identify potential flooded areas and explain the visible evidence.”*
3. The browser optimizes large images before sending them to the API route.
4. The server sends the image(s) and query to **Gemini Flash Lite** and requires structured JSON output.
5. The interface displays the finding, evidence-region overlays, confidence level, and limitations.

| Mode | Input | Purpose |
|------|-------|---------|
| **Optical** | One reflected-light image | Analyze visible land, water, infrastructure, vegetation, or disaster effects. |
| **SAR** | One synthetic-aperture-radar image | Analyze radar-visible patterns while preserving radar-specific uncertainty. |
| **Optical + SAR** | Matched optical and SAR image pair | Compare complementary visual and radar evidence. |
| **Change / Time** | Two co-registered images from different dates | Identify defensible visible changes over time. |

The image-analysis model is instructed to analyze only visible evidence. It must not invent location, acquisition time, sensor metadata, or changes not supported by the supplied image pair. SAR brightness alone is never treated as confirmation of an object or land-cover class.

### From a Question to an Image-Grounded Answer

SATQUERY AI is designed for people who do not work with satellite imagery every day. A user can choose a suggested question, dictate it with the microphone, or type it in plain language. For location-based questions, **Find imagery** geocodes the named place and retrieves an Esri World Imagery basemap view for review; users can also upload their own image for a specific date, sensor, or area. The system then turns the image and question into a short, evidence-grounded answer with visible evidence and limitations.

### Public Value and Sector Benefits

| People or sector | Practical question SATQUERY AI helps answer | Real-world benefit |
|---|---|---|
| Residents and community groups | “Which roads and neighbourhoods appear affected after heavy rain?” | Makes map and satellite information easier to understand when deciding safer routes or where to seek help. |
| Disaster-management teams | “Where are likely flooded, burned, or damaged zones?” | Supports faster prioritisation of reconnaissance, relief, and verification work. |
| Farmers and agricultural departments | “Is there visible crop stress, standing water, or land-cover change?” | Helps target field visits, irrigation checks, and crop-loss assessment. |
| Urban planners and municipalities | “Where has construction, encroachment, or drainage change appeared?” | Supports planning, infrastructure inspection, and public-service decisions. |
| Utilities and public works | “Are access roads, power corridors, or water assets visibly affected?” | Helps direct inspections and restore essential services sooner. |
| Environmental and forest agencies | “Are there burn scars, smoke patterns, vegetation loss, or water-body changes?” | Supports monitoring and early follow-up for environmental risks. |
| Insurance and humanitarian organisations | “What visible damage or access constraints should be verified on the ground?” | Provides a transparent starting point for assessment while keeping human verification central. |

SATQUERY AI is therefore not only a disaster-response dashboard. It is a public-facing decision-support tool that helps people ask understandable questions about their surroundings, while clearly separating visible evidence from uncertainty and requiring on-the-ground confirmation for high-impact decisions.

### SIH26167 Alignment

| SIH26167 requirement | SATQUERY AI implementation |
|---|---|
| Single-image visual question answering | Natural-language optical and SAR image analysis. |
| Additional single-image task | Text-guided evidence-region grounding. |
| Bi-temporal analysis | Two-image change / time mode. |
| Optical–SAR joint analysis | Paired optical + SAR mode with compatibility checks. |
| Agentic orchestration | Deterministic task router selects a VQA, grounding, change, or cross-modal workflow and returns its audit trace. |
| Evidence and confidence | Region overlays, confidence labels, rationale, and limitations. |
| Downloadable report | JSON analysis report containing results and execution trace. |
| TIFF / GeoTIFF input | TIFF and GeoTIFF uploads are decoded server-side to an analysis raster while the original format is recorded in metadata. |
| Remote-sensing adaptation | Reproducible BigEarthNet CLIP adaptation pipeline in [`ml/remote_sensing_adapter`](ml/remote_sensing_adapter/). Train and evaluate a checkpoint before claiming it is deployed. |

> The web interface currently uses Gemini for response synthesis. The domain-adaptation training pipeline must be trained and connected to inference before presenting a remote-sensing-adapted model as deployed. This distinction is intentional for honest evaluation.

### Disaster Intelligence Query

Users may also ask a disaster question without uploading an image. The application retrieves current-year event records from **NASA EONET**, ranks records relevant to the question, and—when a Gemini key is configured—uses **Gemini 3.6 Flash** to produce a concise report based only on those retrieved records. The report includes finding, time context, evidence, confidence, and limitations.

### Intelligence Layers
- **16 toggleable data layers** with real-time entity counts
- **GPU-accelerated rendering** — all map data rendered via WebGL, not DOM
- **Progressive loading** — data fetched on-demand when layers are activated
- **Viewport-aware** — only loads relevant data for the visible region

### RECON Toolkit
- **Port Scanner** — TCP connect scan with service fingerprinting
- **DNS Lookup** — Full record resolution (A, AAAA, MX, NS, TXT, CNAME)
- **WHOIS** — Domain/IP registration data (auto-cross-checked against OFAC SDN)
- **SSL/TLS Inspector** — Certificate chain analysis
- **IP Intelligence** — Geolocation, ASN, threat reputation (auto-cross-checked against OFAC SDN)
- **Vulnerability Scanner** — CVE lookup against NVD database
- **Crypto Wallet Trace** — BTC + ETH lookup (balance, tx history, OFAC SDN sanctions flag)
- **OFAC Sanctions Search** — query persons, organizations, vessels and aircraft against the US OFAC SDN list

### Live Broadcast Network
- **25+ live 24/7 news streams** from global broadcasters
- Click any news dot on the map to open the live stream
- Feeds from NBC, CBS, ABC, Sky News, Al Jazeera, France 24, NHK, WION, and more

### Telegram OSINT Layer
- **Public-channel feed** scraped from the unauthenticated `t.me/s/<channel>` web preview — no Bot API token, no MTProto
- Default curated set of 5 channels (EN + RU/UA war reporting), overridable via `OSIRIS_TELEGRAM_CHANNELS`
- Posts are geoparsed against a multilingual place dictionary (EN + Cyrillic + Arabic) and plotted on the map
- Click any cyan dot to read the post and jump to the original on Telegram

### Crypto Wallet Intelligence
- **BTC** lookups via [blockstream.info](https://blockstream.info) (Esplora API, keyless)
- **ETH** lookups via [Blockscout](https://github.com/blockscout/blockscout)'s public ETH instance (`eth.blockscout.com`, keyless)
- Every lookup is cross-checked against the OFAC SDN sanctioned-address list (mirrored from [`0xB10C/ofac-sanctioned-digital-currency-addresses`](https://github.com/0xB10C/ofac-sanctioned-digital-currency-addresses))
- Sanctioned wallets surface a red **SANCTIONED — OFAC SDN** badge in the RECON panel

### OFAC SDN Cross-Check
- Standalone `SANCTIONS` tab in the RECON toolkit — full-text search across persons, organisations, vessels and aircraft
- WHOIS and IP-intel routes auto-cross-check registrant / ASN-owner names against the SDN list and surface an inline alert
- Data sourced from [OpenSanctions](https://www.opensanctions.org) (CC-BY 4.0) — keyless, ~7 MB cached in-memory for 24h

### Conflict Zone Monitoring
- **13 active conflict/tension zones** with severity-coded warning markers
- Active Wars: Ukraine, Gaza, Sudan, Myanmar, DRC, Yemen
- High Tension: Syria, Lebanon, Sahel, Somalia, Red Sea
- Elevated: Taiwan Strait, Korean DMZ

### Performance Optimized
- **75% reduction in edge requests** vs initial release
- Aggressive polling relaxation (15-30 min intervals for stable data)
- Static data served from memory (zero external API calls for news feeds)
- `layerFetchedRef` prevents duplicate API requests

---

## Quick Start

```bash
git clone https://github.com/sameera56/SatQuery-AI.git
cd osiris
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Docker / Self-Hosting

```bash
git clone https://github.com/sameera56/SatQuery-AI.git
cd osiris
cp .env.template .env     # optional — configure keys / port
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000). The image is a multi-stage
`node:22-alpine` standalone build (~220 MB, non-root). The compose file also
carries CasaOS app metadata (`x-casaos:`) for one-click install on
[CasaOS](https://casaos.io). See **[DOCKER.md](DOCKER.md)** for the full Docker,
CasaOS and API-key guide.

**Prebuilt image (GHCR)** — skip the build and pull it directly:

```bash
docker pull ghcr.io/simplifaisoul/osiris:latest
docker run -d -p 3000:3000 --env-file .env ghcr.io/simplifaisoul/osiris:latest
```

**Custom port** — the container always listens on `3000`; set `OSIRIS_PORT` in
`.env` to change the published host port (e.g. `OSIRIS_PORT=3005`) without
editing the compose file.

### Environment Variables

OSIRIS works **partially without any API keys** — all core feeds use public,
keyless sources. Copy [`.env.template`](.env.template) to `.env` and set only
what you need:

```env
# Published host port (container always listens on 3000). Default: 3000
OSIRIS_PORT=3000

# RECON scanner backend (the only vars the current code reads).
# SCANNER_KEY must match the backend's OSIRIS_KEY — generate with: openssl rand -hex 32
SCANNER_URL=
SCANNER_KEY=

# Optional, for higher rate limits / future sources (see DOCKER.md for signup links)
GEMINI_API_KEY=              # Enables SATQUERY AI image analysis and AI summaries
# GEMINI_API_KEY_1=          # Optional fallback key
FIRMS_API_KEY=                # NASA FIRMS  — firms.modaps.eosdis.nasa.gov/api/map_key/
OPENSKY_CLIENT_ID=            # OpenSky OAuth2 (since Mar 2025) — opensky-network.org
OPENSKY_CLIENT_SECRET=
N2YO_API_KEY=                 # N2YO satellites — n2yo.com (Profile → API key)
AIS_API_KEY=                 # aisstream.io maritime
```

> Without `SCANNER_URL`/`SCANNER_KEY` the RECON toolkit returns `503`; every
> other layer works out of the box. `.env` is gitignored — only the template is committed.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Map Engine | MapLibre GL JS (WebGL) |
| AI / Vision | Google Gemini Flash Lite (satellite-image analysis) |
| AI / Text | Google Gemini 3.6 Flash (disaster reports and assistant) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Styling | Custom CSS Design System |
| Deployment | Vercel Edge Network |

---

## Responsible Use and Limitations

- SATQUERY AI is a decision-support tool, not a replacement for a trained remote-sensing analyst or on-the-ground verification.
- Results are limited to what is visible in the supplied image(s); image quality, cloud cover, sensor properties, alignment, and acquisition dates affect reliability.
- SAR interpretation requires special care: radar brightness can be affected by geometry, roughness, moisture, and polarization, so it does not by itself prove an object or land-cover category.
- For change analysis, use co-registered images of the same location and comparable scale. Confirm high-impact conclusions using authoritative imagery and field information.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Toggle flight layers |
| `E` | Toggle earthquakes |
| `S` | Toggle satellites |
| `D` | Toggle day/night cycle |
| `Escape` | Close panels |

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

**🛠️ SUPPORT THE OSIRIS PROJECT**
The OSIRIS Global Intelligence Grid is entirely open-source, but running the backend scanners and data firehoses isn't cheap.

If you want to help keep the servers alive, and support us to get access to better tools  unlock the **Special OSIRIS Console**, Currently Just a Cool UI. a you can officially support the project here :

🔗 [Support OSIRIS on Patreon](https://www.patreon.com/posts/159077425)

*Supporters receive the `🔴 RedTeam Console` role and access to encrypted developer comms.*


**Built by [simplifaisoul](https://github.com/simplifaisoul)**

[Join our Discord to be a part of this movement!](https://discord.gg/umBykEpb98)

</div>
