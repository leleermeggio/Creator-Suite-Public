# Task: Rename "Cazzone" to "Creator Suite" in the codebase

## Resoconto Modifiche

**Totale occorrenze trovate:** 36 match in 21 file

## File da Modificare

### 1. Configurazione App & Metadata
| File | Occorrenze | Note |
|------|-----------|------|
| `frontend/app.json` | 4 | Nome app, slug, bundle identifier |
| `frontend/web/index.html` | 2 | Titolo pagina e meta tag |
| `docker-compose.yml` | 2 | Nome container e progetto |

### 2. Documentazione & Testo
| File | Occorrenze | Note |
|------|-----------|------|
| `README.md` | 1 | Titolo progetto |
| `CLAUDE.md` | 2 | Riferimenti al progetto |
| `.claude/skills/deploy/index.md` | 3 | Documentazione deploy |
| `.claude/agents/code-reviewer.md` | 2 | Contesto agente |
| `.claude/agents/security-auditor.md` | 2 | Contesto agente |
| `.claude/rules/api-conventions.md` | 1 | Convenzioni API |
| `.claude/rules/code-style.md` | 1 | Stile codice |
| `.claude/rules/testing.md` | 1 | Testing guidelines |
| `.claude/commands/deploy.md` | 1 | Comando deploy |
| `.claude/skills/security-review/index.md` | 1 | Security review |
| `frontend/docs/superpowers/plans/2026-03-26-project-workflow-plan.md` | 2 | Piano progetto |
| `frontend/docs/superpowers/specs/2026-03-26-project-workflow-design.md` | 3 | Specifiche design |
| `docs/superpowers/plans/2026-03-26-creator-suite-demo-ready.md` | 1 | Demo ready doc |

### 3. Codice Sorgente
| File | Occorrenze | Note |
|------|-----------|------|
| `frontend/app/login.tsx` | 2 | Branding login screen |
| `frontend/components/ComingSoonTool.tsx` | 1 | Testo componente |
| `backend/routes/tools.py` | 1 | Nome tool/api |
| `backend/seeds/dev_user.py` | 2 | Email dev (`dev@cazzone.local`) |
| `start.ps1` | 1 | Script PowerShell |

## Piano di Esecuzione

### Step 1: File di Configurazione (Alta Priorità)
1. `frontend/app.json` - Aggiornare nome, slug, bundle ID
2. `frontend/web/index.html` - Aggiornare titolo HTML
3. `docker-compose.yml` - Aggiornare nome servizi

### Step 2: Documentazione
4. `README.md` - Titolo principale
5. `CLAUDE.md` - Riferimenti progetto
6. Tutti i file `.claude/` - Contesto AI agents
7. Documenti `docs/` e `frontend/docs/`

### Step 3: Codice Sorgente
8. `frontend/app/login.tsx` - Branding UI
9. `frontend/components/ComingSoonTool.tsx` - Testo componente
10. `backend/routes/tools.py` - API naming
11. `backend/seeds/dev_user.py` - **ATTENZIONE:** Cambiare email da `dev@cazzone.local` a `dev@creatorsuite.local`
12. `start.ps1` - Script avvio

## Comandi per Eseguire

```bash
# Verifica pre-modifica
rg -i "cazzone" --count-matches

# Esegui sostituzioni (usa sed o un tool simile)
# Esempio con ripgrep + sed:
find . -type f \( -name "*.md" -o -name "*.json" -o -name "*.tsx" -o -name "*.py" -o -name "*.yml" -o -name "*.yaml" -o -name "*.html" -o -name "*.ps1" \) \
  ! -path "./.git/*" \
  ! -path "./node_modules/*" \
  ! -path "./.venv/*" \
  ! -path "./frontend/node_modules/*" \
  -exec sed -i 's/Cazzone/Creator Suite/g; s/cazzone/creatorsuite/g; s/CAZZONE/CREATOR_SUITE/g' {} +

# Nota speciale per backend/seeds/dev_user.py:
# - Cambiare DEV_EMAIL = "dev@cazzone.local" → "dev@creatorsuite.local"
# - Mantenere consistenza password se necessario
```

## Considerazioni Importanti

1. **Email dev user:** Ricreare utente dev nel DB se già esistente, o aggiornare
2. **Bundle ID (iOS/Android):** In `app.json` - cambiare `com.cazzone.app` → `com.creatorsuite.app`
3. **Slug Expo:** In `app.json` - cambiare `caz-zone-app` → `creator-suite-app`
4. **Case sensitivity:** Sostituire in tutte le varianti (Cazzone, cazzone, CAZZONE)

## Stima Tempo
- Modifiche file: ~15 minuti
- Testing & verifica: ~10 minuti
- **Totale stimato: 25-30 minuti**

---

## Per Eseguire Questo Task

1. Chiedi a Claude: "Esegui il task rename-cazzone-to-creator-suite"
2. Oppure manualmente: segui lo step-by-step sopra e verifica con `rg -i "cazzone"`
