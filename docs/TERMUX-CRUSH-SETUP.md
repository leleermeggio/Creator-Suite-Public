# 📱 Guida: Tablet come workstation (Termux + Crush + llama-server)

Il codice sta sul tablet, l'agente gira sul tablet, sulla rete ZeroTier passano solo
le chiamate HTTP verso `llama-server`. Il tablet diventa la workstation, la GPU del PC
resta la GPU.

---

## 📋 Indice

- [Architettura](#architettura)
- [Verifica delle assunzioni](#verifica-delle-assunzioni)
- [Parte 1 — Lato PC (GPU)](#parte-1--lato-pc-gpu)
- [Parte 2 — Lato tablet (Termux)](#parte-2--lato-tablet-termux)
- [Parte 3 — Verifica della catena](#parte-3--verifica-della-catena)
- [Parte 4 — APK: usare i modelli senza terminale](#parte-4--apk-usare-i-modelli-senza-terminale)
- [Parte 5 — Far sembrare davvero un PC](#parte-5--far-sembrare-davvero-un-pc)
- [Troubleshooting](#troubleshooting)
- [Riferimenti](#riferimenti)

---

## Architettura

```
┌──────────────────────────┐         ZeroTier          ┌──────────────────────────┐
│  TABLET (Android/arm64)  │      (solo HTTP/JSON)     │      PC (GPU)            │
│                          │                           │                          │
│  Termux                  │  ──────────────────────►  │  llama-server            │
│   ├── repo git (locale)  │   POST /v1/chat/...       │   --host 0.0.0.0         │
│   ├── Crush (agente)     │  ◄──────────────────────  │   --jinja                │
│   └── node / python      │       tool_calls          │   modello GGUF su GPU    │
└──────────────────────────┘                           └──────────────────────────┘
```

Il modello **non gira sul tablet**: sul tablet gira solo l'agente, che è un binario Go
da poche decine di MB. Sulla rete passa esclusivamente testo JSON.

---

## Verifica delle assunzioni

Tre punti di partenza non reggono alla verifica sulle release attuali. Vale la pena
saperlo prima di digitare comandi che falliscono.

| Assunzione | Realtà (release `v0.89.0`) |
|---|---|
| «Crush si installa con `pkg install crush`» | ❌ Crush **non è** nel repo ufficiale Termux (`termux-packages/packages/crush` → 404). Quella riga nel README di Crush è sotto `# FreeBSD`. |
| «Esistono pacchetti `termux.deb` dedicati» | ❌ Nella release corrente non c'è nessun asset `termux.deb`. I `.deb` pubblicati sono Debian (`amd64`, `arm64`, `armhf`, `i386`) e scrivono in `/etc`, che in Termux è read-only — è esattamente il bug [#793](https://github.com/charmbracelet/crush/issues/793). |
| «Il `baseURL` va dentro `options`» | ⚠️ Quello è un dettaglio di **opencode**, non di Crush. Crush oggi si configura con un `crushrc` (Bash con builtin), e il JSON è deprecato. |

Quello che invece è **vero e importante**: la build Android/arm64 ufficiale esiste ed è
un asset di prima classe della release — `crush_0.89.0_Android_arm64.tar.gz`. Le issue
[#576](https://github.com/charmbracelet/crush/issues/576) (archivio android-arm64
mancante) e [#793](https://github.com/charmbracelet/crush/issues/793) (percorsi Termux)
sono entrambe chiuse. È da lì che si installa, ed è quello che fa lo script di bootstrap.

---

## Parte 1 — Lato PC (GPU)

### 1.1 ZeroTier

Installa ZeroTier One sul PC, crea/entra nella rete, e **autorizza il membro** dalla
console ZeroTier (senza autorizzazione l'IP non viene assegnato). Annota l'IP `10.x.x.x`.

### 1.2 Avvio di llama-server

```powershell
.\scripts\termux\start-llama-server.ps1 -ModelPath "D:\models\Qwen3-Coder-30B-A3B-Q4_K_M.gguf"
```

Lo script stampa l'indirizzo ZeroTier da usare sul tablet, apre opzionalmente la porta
sul firewall (`-OpenFirewall`, richiede shell da amministratore) e avvia il server con i
due flag che contano:

| Flag | Perché è obbligatorio |
|---|---|
| `--host 0.0.0.0` | Con il default `127.0.0.1` il server accetta solo connessioni locali: dal tablet non arrivi nemmeno a fare handshake. |
| `--jinja` | Abilita il template Jinja del modello, che è ciò che produce i `tool_calls`. **Senza questo flag l'agent loop non parte**: il modello risponde in prosa e Crush non ha niente da eseguire. |

Equivalente manuale:

```bash
llama-server --model /path/al/modello.gguf \
  --host 0.0.0.0 --port 8080 \
  --ctx-size 32768 --n-gpu-layers 999 \
  --jinja
```

> ⚠️ Il firewall di Windows blocca le connessioni in ingresso anche sull'adattatore
> ZeroTier. È la causa numero uno di «il server è avviato ma il tablet non lo vede».

---

## Parte 2 — Lato tablet (Termux)

### 2.1 Installare Termux

Installa da **F-Droid** o dalle release GitHub di Termux. **Non** dal Play Store: quella
versione è abbandonata e i pacchetti non si aggiornano più.

Installa anche, dalla stessa fonte:

- **Termux:Widget** — per l'icona di avvio sulla home
- **Termux:API** — opzionale, per clipboard/notifiche (il wake-lock *non* ne ha bisogno)

### 2.2 ZeroTier sul tablet

Installa l'app **ZeroTier One** per Android, entra nella stessa rete, autorizza il
membro dalla console. Il tablet non può far girare `zerotier-one` dentro Termux: serve
l'app, che monta la VPN a livello di sistema — e quindi anche Termux la usa.

### 2.3 Bootstrap

```bash
pkg install -y git
git clone <url-del-repo> ~/Creator-Suite-Public
cd ~/Creator-Suite-Public
bash scripts/termux/bootstrap.sh --host 10.147.20.5
```

Lo script è idempotente e fa:

1. installa la toolchain (`git`, `openssh`, `nodejs`, `python`, `ripgrep`, `fd`, `jq`, …),
   un pacchetto alla volta, così un pacchetto rinominato nel repo non fa abortire tutto;
2. `termux-setup-storage` (richiede un tap sul dialog Android);
3. scarica `crush_<ver>_Android_arm64.tar.gz` dalla release ufficiale, **verifica lo
   sha256 contro `checksums.txt`** e installa il binario in `$PREFIX/bin/crush`;
4. scrive `~/.config/crush/crushrc` puntato al tuo `llama-server`;
5. installa il comando `cz` e la scorciatoia per Termux:Widget.

### 2.4 Il `crushrc` generato

```bash
provider add local \
  --name "llama.cpp (workstation GPU)" \
  --type llamacpp \
  --base-url "http://10.147.20.5:8080"

permissions allow view ls grep
# permissions allow edit write bash
```

Tre dettagli non ovvi:

- **`--type llamacpp`, non `openai-compat`.** Crush ha un tipo dedicato per
  `llama-server` con *auto-discovery*: interroga il server per sapere quale modello è
  caricato. Niente lista di modelli da tenere allineata, e **nessuna apiKey fittizia** da
  inventare.
- **Il base URL è la radice, senza `/v1`.** Il provider `llamacpp` aggiunge il suffisso
  da solo. Con `--type openai-compat` invece il `/v1` va messo.
- **Il `crushrc` è codice eseguibile** (Bash, valutato all'avvio). Vale come un
  `.bashrc`: non fare `source` di roba presa da internet e non lanciare Crush in una
  directory il cui `.crushrc` non hai letto.

Di default solo i tool in lettura sono auto-approvati. Quando ti fidi del loop,
decommenta la riga `permissions allow edit write bash`: è quella che elimina i prompt di
conferma e rende l'agente usabile con una mano sola su un tablet.

---

## Parte 3 — Verifica della catena

```bash
bash scripts/termux/doctor.sh
```

Controlla nell'ordine in cui le cose si rompono davvero:

1. `crush` è installato e c'è il `crushrc`
2. `llama-server` risponde su `/health` attraverso ZeroTier
3. quale modello è caricato (`/props`)
4. **il modello emette davvero `tool_calls`** — invia una richiesta reale a
   `/v1/chat/completions` con un tool dichiarato e verifica la risposta

Il punto 4 è il vero collo di bottiglia. Se il modello risponde in prosa invece di
chiamare il tool, l'agente si inceppa al primo passo — e la diagnosi è quasi sempre
`--jinja` mancante, non la rete.

Poi:

```bash
cz          # wake-lock + crush dentro il repo
```

---

## Parte 4 — APK: usare i modelli senza terminale

Un chiarimento che fa risparmiare tempo: **un client APK non è un agente**. Le app qui
sotto ti fanno *parlare* con il modello (chat, domande, incolla-codice); non leggono né
modificano i file del repo. Per l'agente che tocca il codice serve Crush in Termux.
Le due cose convivono benissimo: stesso `llama-server`, due client diversi.

### Opzione A — WebUI di llama.cpp (zero installazione) ✅ consigliata

`llama-server` **espone già una sua interfaccia web**, ed è una PWA. Dal tablet:

1. apri Chrome su `http://10.147.20.5:8080`
2. menu ⋮ → **Installa app** / *Aggiungi a schermata Home*

Ottieni un'icona sulla home, apertura a schermo intero senza barra del browser, e
funziona offline per la cronologia già caricata. È indistinguibile da un'app nativa,
non richiede installare nulla e non c'è niente da configurare: punta già al modello
giusto perché *è* il server.

### Opzione B — ChatterUI (APK nativo)

[ChatterUI](https://github.com/Vali-98/ChatterUI) è un'app Android nativa che copre
entrambi gli scenari:

- **modello remoto**: nelle API scegli *Generic Chat Completions* e metti
  `http://10.147.20.5:8080/v1` — così usa la GPU del PC;
- **modello on-device**: carica un GGUF direttamente sul tablet (usa `llama.cpp` sotto,
  tramite `cui-llama.rn`) — utile quando sei fuori casa e ZeroTier non raggiunge il PC.

Si scarica come APK dalla pagina delle release su GitHub (non è sul Play Store).
Per l'inferenza on-device la raccomandazione del progetto è quantizzazione **Q4_0** su
Snapdragon 8 Gen 1+ / Exynos 2200+.

### Riepilogo

| Vuoi… | Usa |
|---|---|
| Chattare col modello della GPU, subito, senza installare niente | WebUI di llama.cpp come PWA |
| Un'app nativa, con cronologia e personaggi/preset | ChatterUI (Generic Chat Completions) |
| Far girare un modello **sul tablet**, senza rete | ChatterUI in modalità locale (GGUF) |
| Un agente che **legge e scrive il codice** del repo | Crush in Termux (`cz`) |

---

## Parte 5 — Far sembrare davvero un PC

| Cosa | Come | Perché |
|---|---|---|
| **Wake-lock** | già gestito da `cz` (`termux-wake-lock`) | Senza, Android sospende il processo appena spegni lo schermo e il turno dell'agente muore a metà. |
| **Icona sulla home** | Termux:Widget legge `~/.shortcuts/` — il bootstrap ci mette *Creator Zone (Crush)* | Avvii la sessione come un'app. |
| **Tastiera Bluetooth** | qualsiasi, meglio con riga numeri | Termux senza tastiera fisica è un esercizio di pazienza. |
| **Storage condiviso** | `termux-setup-storage` (già nel bootstrap) | Accedi a `~/storage/shared` per scambiare file con le app Android. |
| **SSH verso il PC** | `pkg install openssh` (già installato) | Utile quando ti serve la shell del PC, non solo il modello. |
| **Editor vero** | `code-server` dentro `proot-distro` | VS Code nel browser locale. Pesante: mettilo solo se Crush + `nano`/`vim` non ti bastano. |
| **Batteria** | disattiva l'ottimizzazione batteria per Termux nelle impostazioni Android | Il wake-lock aiuta, ma l'ottimizzazione aggressiva di alcuni OEM lo scavalca. |

---

## Troubleshooting

| Sintomo | Causa quasi certa | Fix |
|---|---|---|
| `doctor.sh` non arriva a `/health` | firewall Windows sull'adattatore ZeroTier, oppure `--host 127.0.0.1` | `-OpenFirewall`, e verifica il flag `--host 0.0.0.0` |
| ZeroTier connesso ma nessun IP | membro non autorizzato in console | autorizza il device dalla console ZeroTier |
| Il modello risponde in prosa invece di chiamare i tool | `--jinja` mancante | riavvia `llama-server` con `--jinja` |
| Tool call sbagliate/incoerenti anche con `--jinja` | modello troppo piccolo | Qwen3-Coder è il pavimento realistico; sotto, l'agent loop si inceppa |
| Il download di Crush fallisce | rate limit dell'API GitHub | `bootstrap.sh --crush-version v0.89.0` |
| `Read-only file system` installando un `.deb` | è un `.deb` Debian, non Termux | usa il bootstrap: installa dal tarball `Android_arm64` |
| L'agente si blocca a schermo spento | wake-lock non attivo | avvia con `cz`, non con `crush` diretto |
| Prestazioni pessime con contesto lungo | quantizzazione KV troppo aggressiva | evita `-ctk q4_0`: degrada molto il tool calling |

---

## Riferimenti

- [Crush — repository e README](https://github.com/charmbracelet/crush)
- [Crush — installazione e setup (DeepWiki)](https://deepwiki.com/charmbracelet/crush/2.1-installation-and-setup)
- [Crush issue #576 — archivio android-arm64](https://github.com/charmbracelet/crush/issues/576)
- [Crush issue #793 — pacchetto Termux e percorsi `$PREFIX`](https://github.com/charmbracelet/crush/issues/793)
- [llama.cpp — function calling e flag `--jinja`](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md)
- [llama.cpp — nuova WebUI](https://github.com/ggml-org/llama.cpp/discussions/16938)
- [ChatterUI](https://github.com/Vali-98/ChatterUI)
- [Termux — installazione (F-Droid / GitHub)](https://termux.dev/en/)
