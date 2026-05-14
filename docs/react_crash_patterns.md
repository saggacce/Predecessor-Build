# React Crash Patterns — RiftLine

Referencia de diagnóstico para los fallos recurrentes que provocan que la UI desaparezca y solo quede el fondo.

---

## Síntoma: Solo se ve el fondo de la página

La UI entera desaparece. Solo permanece el fondo animado (las 7 capas CSS). Puede ocurrir al entrar a cualquier página o al navegar entre ellas.

**Causa raíz:** Un componente React lanza una excepción durante el render y no hay `ErrorBoundary` capturándola. React desmonta todo el árbol afectado, dejando solo lo que está fuera del árbol (el fondo CSS puro).

**Diagnóstico rápido:** Abrir DevTools → Console. El error real siempre está ahí.

---

## Patrón 1 — Hooks después de un return condicional

### Error en consola
```
Error: Rendered fewer hooks than expected.
```

### Causa
React requiere que todos los hooks se llamen **siempre**, en el mismo orden, en cada render. Si un `useEffect`, `useState` o `useCallback` aparece **después** de un `return` condicional, solo se ejecuta a veces, violando las Rules of Hooks.

```tsx
// ❌ ROTO — useEffect después del return
function PlayerGoalsSection({ playerId, canManageGoals }) {
  const [goals, setGoals] = useState([]);

  if (!canManageGoals) {
    return <div>No tienes permisos</div>; // early return
  }

  // 🚨 Estos hooks NUNCA se ejecutan si canManageGoals=false
  useEffect(() => { fetchGoals(playerId); }, [playerId]);
  useEffect(() => { ... }, [playerId]);
}

// ✅ CORRECTO — todos los hooks antes de cualquier return
function PlayerGoalsSection({ playerId, canManageGoals }) {
  const [goals, setGoals] = useState([]);

  // Todos los hooks primero, incondicionalmente
  useEffect(() => { fetchGoals(playerId); }, [playerId, canManageGoals]);
  useEffect(() => { ... }, [playerId]);

  // El return condicional va AL FINAL
  if (!canManageGoals) {
    return <div>No tienes permisos</div>;
  }

  return <div>{/* render normal */}</div>;
}
```

### Archivos afectados (Mayo 2026)
- `apps/web/src/pages/PlayerScouting.tsx` — `PlayerGoalsSection`

### Regla de prevención
> **Ningún hook puede aparecer después de un `if`, `return` o `&&` condicional.**
> Revisa siempre que todos los `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`, `useContext` estén al principio del componente, antes de cualquier lógica condicional.

---

## Patrón 2 — Variable usada fuera de su scope

### Error en consola
```
ReferenceError: narrowDepth is not defined
```
(o cualquier `ReferenceError: X is not defined`)

### Causa
Una variable se define dentro de una función/componente pero se usa en otro componente sin pasarla como prop ni redeclararla.

```tsx
// ❌ ROTO — narrowDepth definida en DraftHeroPool, usada en ScoutingReport
function DraftHeroPool({ ... }) {
  const narrowDepth = config.get('display_hero_pool_narrow_depth') ?? 2; // solo existe aquí
  return <ScoutingReport narrowDepth={narrowDepth} />;
  // Pero ScoutingReport también lo usa internamente sin recibirlo como prop
}

function ScoutingReport({ playerStats }) {
  // 🚨 narrowDepth no existe en este scope
  const topHeroes = heroes.slice(0, narrowDepth);
}

// ✅ CORRECTO — cada componente declara lo que necesita
function ScoutingReport({ playerStats }) {
  const config = useConfig();
  const narrowDepth = config.get('display_hero_pool_narrow_depth') ?? 2; // declarado aquí
  const topHeroes = heroes.slice(0, narrowDepth);
}
```

### Archivos afectados (Mayo 2026)
- `apps/web/src/pages/TeamAnalysis.tsx` — `ScoutingReport` usaba `narrowDepth` de `DraftHeroPool`

### Regla de prevención
> Si un valor se usa en un componente, ese componente debe o bien **recibirlo como prop** o bien **declararlo él mismo** con `useConfig()`, `useState`, etc. Nunca asumas que variables de un componente hermano/padre están disponibles.

---

## Patrón 3 — Nombre de variable renombrado sin actualizar todos los usos

### Error en consola
```
ReferenceError: TIER_COLORS is not defined
```

### Causa
Se refactoriza una constante (`TIER_COLORS` → `PLAYER_TIER_COLORS`) pero algún sitio del archivo sigue usando el nombre antiguo.

```tsx
// ❌ ROTO — TIER_COLORS fue renombrada
const PLAYER_TIER_COLORS = { ... }; // nuevo nombre

// En el render, aún se usa el nombre viejo:
<span style={{ color: TIER_COLORS[user.tier] }}>...</span> // 🚨 ReferenceError
```

### Archivos afectados (Mayo 2026)
- `apps/web/src/pages/UsersPage.tsx`

### Regla de prevención
> Al renombrar una constante, siempre hacer un **search global** en el archivo (y en los que la importan) para reemplazar todos los usos. Usar `replace_all` en el Edit tool o un `sed -i` con regex.

---

## Patrón 4 — Llamada a método inexistente de `apiClient`

### Error en consola
```
TypeError: apiClient.players.get is not a function
TypeError: apiClient.patches.list is not a function
```

### Causa
El API client evoluciona: métodos se renombran o eliminan. Si el frontend llama a un método que ya no existe, lanza `TypeError` en el render (si está en un `useEffect` mal manejado) o al montar el componente.

```tsx
// ❌ ROTO — métodos que no existen
await apiClient.players.get(id);         // → getProfile(id)
await apiClient.patches.list();          // → patches.latest()
await apiClient.review.list({ status }); // → review.list(teamId, { status })

// ✅ CORRECTO
await apiClient.players.getProfile(id);
await apiClient.patches.latest();
await apiClient.review.list(teamId, { status });
```

### Archivos afectados (Mayo 2026)
- `apps/web/src/pages/Dashboard.tsx`

### Regla de prevención
> Antes de añadir cualquier llamada a `apiClient`, verificar que el método existe en `apps/web/src/api/client.ts`. Nunca asumir que el nombre es intuitivo.

---

## Patrón 5 — `<Navigate>` en fase de render

### Síntoma
La página crashea al montar, o redirecciona en bucle.

### Causa
Usar `<Navigate>` directamente en el cuerpo del componente (fuera de JSX condicional limpio) puede provocar problemas con el ciclo de render de React Router, especialmente cuando hay hooks que dependen del estado de la ruta.

```tsx
// ❌ Potencialmente problemático
function MatchList() {
  const { user } = useAuth();
  if (user?.globalRole === 'PLAYER') {
    return <Navigate to="/analysis/players" state={{ ... }} />;
  }
}

// ✅ Seguro — useEffect + navigate()
function MatchList() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.globalRole === 'PLAYER') {
      navigate('/analysis/players', { state: { ... } });
    }
  }, [user, navigate]);

  return <div>{/* contenido normal */}</div>;
}
```

### Archivos afectados (Mayo 2026)
- `apps/web/src/pages/MatchList.tsx`

---

## Herramienta de diagnóstico: Error Boundaries

Cuando ocurra el síntoma "solo queda el fondo", añadir temporalmente un `ErrorBoundary` al componente sospechoso para ver el error exacto:

```tsx
// Añadir al principio del archivo
class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', color: '#f87171', fontFamily: 'monospace' }}>
          <strong>Error capturado:</strong>
          <pre>{this.state.error.message}</pre>
          <pre>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Envolver el componente sospechoso
<PageErrorBoundary>
  <ComponenteSospechoso />
</PageErrorBoundary>
```

Una vez identificado el error, corregirlo y **eliminar el ErrorBoundary** de debug (no son necesarios en producción para estos errores de programación).

---

## Checklist pre-commit para componentes React

Antes de hacer commit de un componente nuevo o modificado:

- [ ] ¿Todos los hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`, `useContext`) están al inicio del componente, antes de cualquier `if` o `return`?
- [ ] ¿Todas las variables usadas en el render están declaradas en el mismo scope?
- [ ] ¿Todos los métodos de `apiClient` que se llaman existen en `apps/web/src/api/client.ts`?
- [ ] Si se renombró una constante, ¿se actualizaron todos los usos con search global?
- [ ] Si se usa `<Navigate>`, ¿está dentro de un `useEffect`?

---

## Referencias

- [React Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- Commits de fix en esta sesión: `a2725da`, `7b0544e`, `90e2fb1`, `8c36a08`, `4230361`
- PR #151: `fix/login-background-epic-icon`
