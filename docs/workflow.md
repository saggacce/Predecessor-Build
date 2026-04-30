# Workflow de trabajo del proyecto

Este documento define el flujo operativo acordado entre el usuario y Claude
para trabajar de forma iterativa sobre el repositorio local y GitHub.

---

## 1. Flujo completo por tarea

```
main (GitHub) → branch local → commits → push → PR → review → merge → main
```

### Paso a paso

1. **Claude parte siempre desde `main` actualizado**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Claude crea un branch descriptivo para la tarea**
   ```bash
   git checkout -b <tipo>/<descripcion-corta>
   # Ejemplos:
   # feat/player-profile-endpoint
   # fix/stat-calculator-level-scaling
   # docs/update-api-auth-section
   ```

3. **Claude trabaja localmente** — edita archivos, ejecuta validaciones.

4. **Claude commitea en incrementos atómicos**
   ```bash
   git add <archivos-especificos>
   git commit -m "tipo: descripción concisa en inglés"
   ```

5. **Claude pushea el branch a GitHub** (autónomo — PAT configurado)
   ```bash
   git push -u origin <nombre-del-branch>
   ```

6. **Claude abre un PR** hacia `main` vía GitHub API (autónomo)
   ```bash
   curl -s -X POST \
     -H "Authorization: token <PAT>" \
     https://api.github.com/repos/saggacce/Predecessor-Build/pulls \
     -d '{"title":"...","head":"...","base":"main","body":"..."}'
   ```

7. **El usuario revisa el PR** en GitHub, aprueba o pide cambios.

8. **Merge y limpieza** — el usuario mergea el PR en GitHub y elimina el branch remoto.
   ⚠️ **Importante:** mergear en GitHub NO actualiza el WSL automáticamente. Son dos copias separadas.
   Claude sincroniza y elimina el branch local:
   ```bash
   git checkout main
   git pull origin main   # ← SIEMPRE necesario después de un merge en GitHub
   git branch -d <nombre-del-branch>
   ```

---

## 2. Convención de nombres de branch

| Prefijo   | Cuándo usarlo                             | Ejemplo                          |
|-----------|-------------------------------------------|----------------------------------|
| `feat/`   | Nueva funcionalidad                       | `feat/player-profile-api`        |
| `fix/`    | Corrección de bug o error                 | `fix/hero-stat-level-18`         |
| `docs/`   | Solo cambios en documentación             | `docs/auth-findings-predgg`      |
| `chore/`  | Configuración, dependencias, limpieza     | `chore/monorepo-tsconfig`        |
| `refactor/` | Cambios internos sin cambio funcional   | `refactor/domain-engine-types`   |

---

## 3. Convención de commits

Formato: `tipo: descripción en inglés (imperativo, minúsculas)`

| Tipo       | Cuándo usarlo                                  |
|------------|------------------------------------------------|
| `feat`     | Nueva funcionalidad                            |
| `fix`      | Corrección de bug                              |
| `docs`     | Cambios en documentación                       |
| `chore`    | Tareas de mantenimiento (configs, deps)        |
| `refactor` | Refactorización sin cambio de comportamiento   |
| `test`     | Añadir o corregir tests                        |

Ejemplos válidos:
```
feat: add player profile GraphQL query handler
fix: correct level-18 stat interpolation in domain engine
docs: add pred.gg auth test findings to API doc
chore: sync local repo with main from GitHub
```

---

## 4. Reglas operativas

- **Un branch por objetivo.** No mezclar features, fixes y docs en el mismo branch.
- **`main` es siempre estable.** Claude nunca pushea directo a `main`.
- **PRs con alcance acotado.** Un PR resuelve una cosa concreta.
- **Claude sincroniza antes de empezar.** Siempre `git pull origin main` al inicio de cada sesión o tarea.
- **El usuario decide el merge.** Claude abre el PR pero no lo mergea sin instrucción explícita.
- **Claude es autosuficiente.** Push y creación de PR son autónomos — no requieren intervención del usuario.

### Git identity (WSL)
```bash
git config user.name "gabriel"
git config user.email "gaby0806@gmail.com"
```

---

## 5. Criterio de "Done" por PR

Una tarea se considera completada cuando:

- Se cumplen los criterios funcionales acordados.
- La documentación afectada está actualizada.
- Se han ejecutado validaciones razonables para el tipo de cambio.
- El PR está mergeado en `main` y el branch eliminado (remoto y local).

---

## 6. Documentación de referencia obligatoria

Antes de comenzar cualquier tarea, Claude revisa:

- `docs/planning.md` → tareas activas y subtareas con estado.
- `docs/project_predecessor.md` → visión de producto, alcance, requisitos y roadmap.
- `docs/predecessor_api_technical_doc.md` → integración API externa y límites técnicos.
- `docs/future_features_roadmap.md` → backlog de capacidades futuras y dependencias.
