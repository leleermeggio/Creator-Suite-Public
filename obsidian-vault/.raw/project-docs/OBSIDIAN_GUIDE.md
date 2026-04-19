# Obsidian + Claude Code — Guida integrazione Creator Zone

Guida all'installazione e uso di [claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) nel progetto Creator Zone.

---

## 1. Cosa è claude-obsidian

Sistema di knowledge management automatico che unisce Claude Code + Obsidian. Crea e mantiene una wiki auto-organizzante basata sul pattern "LLM Wiki" di Karpathy.

**Funzionamento in 3 modalità:**

| Modalità | Cosa fa |
|----------|---------|
| **Ingestion** | Tu dai una fonte (file, link, documento) → Claude genera pagine wiki, estrae entità/concetti, aggiorna indice + cross-reference |
| **Query** | Chiedi "cosa sai su X?" → Claude legge hot cache + indice + pagine rilevanti → risposta con citazioni alle pagine wiki |
| **Maintenance** | `lint the wiki` → trova pagine orfane, link morti, claim obsoleti, connessioni mancanti |

**Caratteristica chiave:** hot cache persistente. Ogni sessione parte col contesto recente già caricato, non ricominci da zero.

---

## 2. Perché integrarlo in Creator Zone

Progetto ha già molti docs dispersi:
- `docs/PHASE_PLAN.md`, `TOOLS_UPDATE.md`, `USAGE-BEST-PRACTICES.md`
- `docs/superpowers/plans/*.md` (3 plan)
- `docs/superpowers/specs/*.md` (3 spec)
- `docs/deployment/home-server.md`
- `CLAUDE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `README.md`
- `.claude/rules/*.md`

Ingestando tutto in un vault Obsidian otteniamo:
- **Ricerca semantica** (anziché grep puro) su tutta la knowledge base
- **Graph view** delle dipendenze tra moduli (backend ↔ frontend ↔ bot)
- **Cross-reference automatico** tra plan/spec/codice
- **Context hot cache** tra sessioni Claude Code (non ri-spiegare ogni volta cos'è il progetto)
- **Lint wiki** per trovare doc obsoleti o contraddizioni
- **Autoresearch** per ricerche autonome su nuove feature

**Use case concreto:**
> "Cosa sappiamo sull'auth flow?"

Claude legge i doc pertinenti (CLAUDE.md auth section, spec security hardening, test_auth.py, routes/auth/*, CHANGELOG auth entries) e sintetizza con citazioni.

---

## 3. Opzioni di installazione

Il repo offre 3 modalità.

### Opzione A — Plugin Claude Code (raccomandata per noi)

Più semplice, nessun clone manuale, comandi `/wiki` disponibili ovunque.

```bash
claude plugin marketplace add AgriciDaniel/claude-obsidian
claude plugin install claude-obsidian@claude-obsidian-marketplace
```

Poi in sessione Claude Code:
```
/wiki
```

Claude scaffolda vault + configura MCP.

### Opzione B — Clone come vault standalone

Vault separato dal progetto. Utile se vuoi una knowledge base personale cross-progetto.

```bash
git clone https://github.com/AgriciDaniel/claude-obsidian
cd claude-obsidian
bash bin/setup-vault.sh
```

Apri cartella in Obsidian → *Manage Vaults → Open folder as vault*.

### Opzione C — WIKI.md in vault esistente

Per aggiungere il sistema a un vault Obsidian già in uso altrove.

Copia `WIKI.md` nella root del vault, poi chiedi a Claude:

> "Read WIKI.md in this project. Then: 1. Check if Obsidian is installed. If not, install it. 2. Check if the Local REST API plugin is running on port 27124. 3. Configure the MCP server."

---

## 4. Scelta per Creator Zone

**Usa Opzione A + crea vault dentro il progetto.**

Motivi:
- Vault `obsidian-vault/` vive nel worktree → versionato con code (o gitignorato, a scelta)
- Claude Code slash commands disponibili (`/wiki`, `/save`, `/autoresearch`, `/canvas`)
- Hot cache per sessione persiste tra `claude` invocations
- Può leggere direttamente `docs/`, `CLAUDE.md`, `.claude/rules/` per prima ingestion

---

## 5. Prerequisiti

| Req | Check | Install |
|-----|-------|---------|
| Obsidian installato | `obsidian://` nel browser o app aperta | https://obsidian.md/download |
| Claude Code ≥ versione corrente | `claude --version` | già ok |
| Plugin Local REST API Obsidian (opzionale, per MCP) | In Obsidian *Settings → Community plugins* | Abilita community plugins + cerca "Local REST API" |
| Git | `git --version` | già ok |

Plugin Local REST API serve solo se vuoi che Claude scriva al vault via API (consigliato vs file I/O su Windows).

---

## 6. Step-by-step install Creator Zone

### 6.1 Installa Obsidian

Windows:
```powershell
winget install Obsidian.Obsidian
```

### 6.2 Installa plugin claude-obsidian

Nel terminale root progetto:
```bash
claude plugin marketplace add AgriciDaniel/claude-obsidian
claude plugin install claude-obsidian@claude-obsidian-marketplace
```

### 6.3 Crea vault nel progetto

```bash
mkdir obsidian-vault
cd obsidian-vault
```

Apri Obsidian → *Open folder as vault* → seleziona `P:\Emanuele\Progetti Ai\Creator-Suite-Public\.claude\worktrees\clever-lewin-e06c8a\obsidian-vault`.

### 6.4 Bootstrap vault

In Claude Code (dentro worktree):
```
/wiki
```

Segui prompt guidati. Claude crea:
- `wiki/index.md` (master catalog)
- `wiki/hot.md` (context cache)
- `wiki/log.md` (operation history)
- `.obsidian/snippets/vault-colors.css`
- `CLAUDE.md` aggiornato (auto-loaded)

### 6.5 Abilita Local REST API (raccomandato)

In Obsidian:
1. *Settings → Community plugins → Turn on*
2. *Browse → cerca "Local REST API" → Install → Enable*
3. Copia API key da *Settings → Local REST API*
4. Aggiungi a `.env` o config Claude

### 6.6 Ingest docs esistenti

Prima ingestion in batch per popolare wiki:
```
ingest docs/PHASE_PLAN.md
ingest docs/TOOLS_UPDATE.md
ingest docs/superpowers/plans/2026-04-04-security-production-hardening.md
ingest docs/superpowers/plans/2026-04-07-local-llm-fresh-setup.md
ingest docs/superpowers/plans/2026-04-08-avatar-profile.md
ingest CLAUDE.md
ingest .claude/rules/api-conventions.md
ingest .claude/rules/code-style.md
ingest .claude/rules/testing.md
```

Ogni `ingest` genera 8-15 pagine wiki strutturate.

### 6.7 Test query

```
what do you know about auth flow?
what do you know about Quick Tools page?
what's the status of the security hardening plan?
```

Claude risponde con citazioni alle pagine wiki.

### 6.8 Lint & maintenance

Weekly:
```
lint the wiki
update hot cache
```

---

## 7. Comandi principali

| Comando | Quando usarlo |
|---------|---------------|
| `/wiki` | Setup iniziale + bootstrap |
| `ingest [file]` | Processa sorgente in pagine wiki |
| `what do you know about X?` | Query con citazioni |
| `/save` | Archivia conversazione corrente come nota |
| `/autoresearch [topic]` | Ricerca autonoma + sintesi |
| `/canvas` | Visual layer grafi conoscenza |
| `lint the wiki` | Health check vault |
| `update hot cache` | Persisti contesto per prossima sessione |

---

## 8. Configurazione avanzata

### Custom autoresearch
`skills/autoresearch/references/program.md` — modifica source preferences, confidence scoring, vincoli dominio.

### Modalità wiki (6 disponibili, combinabili)
Website, GitHub, Business, Personal, Research, Book/Course.

Per Creator Zone: **GitHub + Business + Research** (sviluppo software + product + ricerca feature).

### CSS snippets
3 auto-abilitati: color-coding folder, card layouts, image sizing.

### Banner frontmatter
Aggiungi `banner: [path-img]` in frontmatter di una nota per header full-width.

### Plugin community consigliati
- **Templater** — automazione note
- **Obsidian Git** — backup vault su GitHub
- **Dataview (legacy)** — query tipo SQL su note
- **Excalidraw** — diagrammi inline
- **Calendar** — daily notes

---

## 9. Gitignore vault?

Due scelte:

**Committato (condiviso con team):**
- Pro: knowledge base versionata, onboarding rapido, tutti vedono stessi doc
- Contro: merge conflict frequenti su hot cache, diff rumorosi

**Gitignorato (personale):**
- Pro: pulito, ognuno mantiene suo contesto
- Contro: knowledge non condivisa

**Raccomandazione:** ibrido.
```gitignore
# .gitignore
obsidian-vault/.obsidian/workspace*
obsidian-vault/wiki/hot.md
obsidian-vault/wiki/log.md
```

Committi struttura + pagine wiki principali, escludi stato sessione.

---

## 10. Troubleshooting

| Problema | Causa | Fix |
|----------|-------|-----|
| `/wiki` non riconosciuto | Plugin non installato | `claude plugin list` verifica |
| MCP server non connesso | Local REST API non attivo | Obsidian → Settings → Local REST API → Enable |
| Ingest fallisce su file grandi | Timeout | Split file, ingest per chunk |
| Graph vuoto | Nessuna pagina ingested | Run `ingest` almeno 3-5 source |
| Hot cache non persiste | `update hot cache` mancato | Aggiungi a routine fine-sessione |

---

## 11. Prossimi passi

1. Installa Obsidian + plugin claude-obsidian (sezione 6)
2. Lancia slash command `/setup-obsidian` (ho creato file `.claude/commands/setup-obsidian.md` che automatizza steps 6.2-6.6)
3. Ingest batch docs esistenti
4. Test query su auth flow / tools / security plan
5. Setup routine weekly lint

---

## Riferimenti

- Repo: https://github.com/AgriciDaniel/claude-obsidian
- Companion: https://github.com/AgriciDaniel/claude-canvas (visual orchestration)
- Pattern: Andrej Karpathy — LLM Wiki
- Obsidian: https://obsidian.md
