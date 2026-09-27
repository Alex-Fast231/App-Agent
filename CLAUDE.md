# FaSt App - Hinweise für Claude Code Sessions

## App-Versionsnummer (data/schema.js, APP_VERSION)

Dieses Repo hat einen Git-Hook, der die Patch-Version in `data/schema.js`
automatisch bei jedem Commit erhöht, der Code ändert (kein Bump bei reinen
`.md`/`.txt`-Commits, kein Bump wenn `data/schema.js` selbst schon manuell im
Commit enthalten ist). Der Hook liegt in `.githooks/pre-commit`.

**Da jede Session in einem frischen Container-Klon startet, ist die
Hook-Aktivierung NICHT automatisch Teil des Klons** (`core.hooksPath` ist
lokale Git-Konfiguration, kein getrackter Repo-Inhalt). Deshalb zu Beginn
JEDER Session, bevor der erste `git commit` läuft, einmal ausführen:

```
git config core.hooksPath .githooks
```

Ohne diesen Schritt bleibt die Versionsnummer wieder unverändert (genau das
Problem, das über ~10 Sessions hinweg aufgetreten ist, bevor dieser Hook
eingeführt wurde).
