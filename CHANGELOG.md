# Changelog

Tutte le modifiche rilevanti al progetto Creator Suite saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

### 2026-03-27 - Image Generator Enhancement

#### Aggiunto
- **Mode Selector** nel generatore di immagini con 4 opzioni:
  - 🖼️ **Thumbnail** (1280×720) - YouTube thumbnail con template
  - 💎 **Logo** (512×512) - Formato quadrato per loghi e icone
  - 📱 **Copertina** (1080×1080) - Formato quadrato per post social
  - ✨ **Generazione Libera** - Text-to-image senza template
  
- **Generazione Libera** - Nuova modalità per generare immagini da descrizione testuale:
  - Provider selector con NanoBanana (default) e Stable Horde
  - Input prompt multilinea per descrizione immagine
  - Auto-dimensioning basato sul tipo di immagine selezionato
  - Warning quando NanoBanana è selezionato ma manca l'API key
  
- **Template Filtering** - Template disponibili filtrati automaticamente in base al mode:
  - Thumbnail: tutti gli 8 template
  - Logo: minimal, bold-side, neon (3 template)
  - Cover: impact, minimal, gradient-bar (3 template)
  
- **UI Condizionale** - Form diverso in base alla modalità:
  - Template-based: grid template + campi titolo/sottotitolo/colore/foto
  - Free generation: provider selector + campo descrizione

#### Modificato
- `frontend/components/ThumbnailGeneratorUI.tsx`
  - Aggiunto state `mode` per tracciare tipo immagine selezionato
  - Aggiunto state `freePrompt` per descrizione generazione libera
  - Aggiunto state `provider` per selezione provider (default: nanobanana)
  - Implementato `handleGenerateFree()` per generazione senza template
  - Integrato con hook `useSettings()` per API keys
  - Aggiunto filtro dinamico template basato su mode
  - UI condizionale con fragments per template-based vs free generation

#### File Documentazione Aggiornati
- `docs/superpowers/specs/2026-03-27-thumbnail-generator-design.md`
  - Aggiunta sezione Mode Selector
  - Aggiunta sezione Free Generation Mode
  - Aggiunto Changelog interno alla spec

---

## Legenda

- **Aggiunto** - Nuove funzionalità
- **Modificato** - Modifiche a funzionalità esistenti
- **Deprecato** - Funzionalità che saranno rimosse nelle prossime versioni
- **Rimosso** - Funzionalità rimosse
- **Corretto** - Bug fix
- **Sicurezza** - Vulnerabilità corrette
