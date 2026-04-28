# Workflow de trabajo del proyecto

Este documento define el flujo operativo acordado para trabajar de forma iterativa en features.

## 1) Ciclo de trabajo por feature

1. Crear un branch nuevo desde `main` para la feature.
2. Implementar cambios en commits pequeños y claros.
3. Abrir PR con resumen de cambios y validaciones.
4. Revisar y ajustar según feedback.
5. Cuando el cambio esté listo, **cerrar ciclo**:
   - merge del PR a `main`
   - borrado del branch
6. Volver a empezar el siguiente ciclo desde `main` actualizado.

## 2) Reglas prácticas

- Un branch por objetivo (feature/fix/documentación).
- Commits atómicos y descriptivos.
- PR con alcance acotado (evitar mezclar cambios no relacionados).
- Mantener `main` como rama estable y fuente de verdad.

## 3) Documentación de referencia obligatoria

Antes de comenzar cualquier tarea, revisar:

- `docs/project_predecessor.md` → visión de producto, alcance, requisitos y roadmap.
- `docs/predecessor_api_technical_doc.md` → integración API externa y límites técnicos.
- `docs/future_features_roadmap.md` → backlog de capacidades futuras y dependencias.
- `docs/planning.md` → tareas activas y subtareas con estado.

## 4) Criterio de “Done” por PR

Una feature/tarea se considera completada cuando:

- Se cumplen los criterios funcionales acordados.
- La documentación afectada está actualizada.
- Se han ejecutado validaciones razonables para el tipo de cambio.
- El PR está mergeado en `main` y el branch eliminado.
