# Office socket protocol

The rest of the protocol is documented by a later step.

## Layout and desk events

This section documents the WebSocket events and HTTP endpoints that manage office layouts, procedural wing expansions, template switches, and desk allocations.

### Protocol summary table

| Event / Endpoint | Direction | Payload | Who receives | API Handler | Web Handler |
| --- | --- | --- | --- | --- | --- |
| `GET /workspace` | Client &rarr; API (HTTP) | None (Authenticated session cookie) | Calling client | `WorkspaceController.mine`<br>in `apps/api/src/workspace/workspace.controller.ts` | SWR / page load fetching `MyWorkspace`<br>in `apps/web/features/workspace/` |
| `PUT /workspace/layout` | Client &rarr; API (HTTP) | `UpdateLayoutDto`<br>`{ version: number, furniture: FurnitureDto[], rooms: RoomNameDto[] }` | Calling client (receives `{ layout: OfficeLayout, version: number }`) | `WorkspaceController.updateLayout`<br>&rarr; `WorkspaceService.updateLayout`<br>in `apps/api/src/workspace/workspace.service.ts` | `save()` in `apps/web/features/office/useOfficeEditor.ts`<br>formatting via `LayoutEditor.toSave()` in `apps/web/game/editor/LayoutEditor.ts` |
| `POST /workspace/wings` | Client &rarr; API (HTTP) | `WingDto`<br>`{ side: 'LEFT' \| 'RIGHT' \| 'BOTTOM', version: number }` | Calling client (receives updated `MyWorkspace`) | `WorkspaceController.addWing`<br>&rarr; `WorkspaceService.addWing`<br>in `apps/api/src/workspace/workspace.service.ts` | `expand()` in `apps/web/features/team/ExpandOfficeCard.tsx` |
| `POST /workspace/wings/chill` | Client &rarr; API (HTTP) | `WingDto`<br>`{ side: 'LEFT' \| 'RIGHT' \| 'BOTTOM', version: number }` | Calling client (receives updated `MyWorkspace`) | `WorkspaceController.addChillWing`<br>&rarr; `WorkspaceService.addChillWing`<br>in `apps/api/src/workspace/workspace.service.ts` | `addChill()` in `apps/web/features/team/ExpandOfficeCard.tsx` |
| `PUT /workspace/template` | Client &rarr; API (HTTP) | `SwitchTemplateDto`<br>`{ templateId: string, teamSize?: number, version: number }` | Calling client (receives updated `MyWorkspace`) | `WorkspaceController.switchTemplate`<br>&rarr; `WorkspaceService.switchTemplate`<br>in `apps/api/src/workspace/workspace.service.ts` | `apply()` in `apps/web/features/team/TemplateSwitcher.tsx` |
| `PUT /workspace/me/desk` | Client &rarr; API (HTTP) | `MyDeskDto`<br>`{ deskId: string }` | Calling client (receives HTTP 204 No Content) | `WorkspaceController.moveDesk`<br>&rarr; `DesksService.move`<br>in `apps/api/src/workspace/desks.service.ts` | `claimDesk()` in `apps/web/features/office/useDeskInteractions.ts` |
| `PUT /workspace/members/:userId/desk` | Client &rarr; API (HTTP) | `DeskDto`<br>`{ deskId: string \| null }` | Calling client (receives HTTP 204 No Content) | `WorkspaceController.assignDesk`<br>&rarr; `DesksService.assign`<br>in `apps/api/src/workspace/desks.service.ts` | Member desk picker in `apps/web/features/team/MembersCard.tsx` |
| `office:layout` | Server &rarr; Client (WebSocket) | `{ layout: OfficeLayout, version: number, by: string }` | All clients in workspace room (`workspace:<workspaceId>`) | Emitted by `OfficeGateway.onWorkspaceEvent`<br>in `apps/api/src/office/office.gateway.ts`<br>(subscribed to `WorkspaceEvents.events$`) | Listener in `apps/web/features/office/connection.ts`<br>&rarr; `onLayout` in `apps/web/features/office/useOfficeConnection.ts` |
| `office:desks` | Server &rarr; Client (WebSocket) | `{ desks: DeskOwner[] }`<br>where each item is `{ deskId: string, userId: string, name: string, character: string }` | All clients in workspace room (`workspace:<workspaceId>`) | Emitted by `OfficeGateway.onWorkspaceEvent`<br>in `apps/api/src/office/office.gateway.ts`<br>(subscribed to `WorkspaceEvents.events$`) | Listener in `apps/web/features/office/connection.ts`<br>&rarr; `onDesks` in `apps/web/features/office/useOfficeConnection.ts` |

---

### Version semantics and concurrency control

1. **Optimistic Locking**:
   - The workspace table maintains an integer column `layoutVersion` (initialized to `1`).
   - Every mutation endpoint (`PUT /workspace/layout`, `POST /workspace/wings`, `POST /workspace/wings/chill`, `PUT /workspace/template`) requires the caller to provide their current `version: number`.
   - The API service executes an atomic conditional update:
     `prisma.workspace.updateMany({ where: { id: workspaceId, layoutVersion: dto.version }, data: { layout, layoutVersion: { increment: 1 } } })`
   - If `count !== 1`, another organizer saved changes concurrently. The server aborts the transaction and returns HTTP 400 with error code `LAYOUT_CHANGED`.

2. **Client-side Version Filtering**:
   - When the web client receives `office:layout` with payload `{ layout, version, by }`:
     - **Stale Updates**: If `version <= versionRef.current`, the broadcast is ignored.
     - **Author Save**: If `isEditingRef.current && by === myId`, the broadcast is ignored because the author's local editor state is already ahead and will apply the HTTP response directly.
     - **Concurrent Edit Notification**: If another organizer saves (`isEditingRef.current && by !== myId`), the client retains the current draft on screen and displays a toast notification (`"Another organiser just saved changes to the office."`). The user must reload the latest layout before saving.
     - **Live Office Update**: If the client is in game view (not editing), `versionRef.current` updates, the React workspace state updates, Phaser re-renders the office via `controllerRef.current.setLayout(layout)`, and a toast announces `"The office was rearranged by the organiser."` if `by !== myId`.

---

### Server event distribution flow

```
[REST HTTP Request] (PUT /workspace/layout, POST /workspace/wings, PUT /workspace/me/desk)
        |
        v
[WorkspaceService / DesksService]
  - Performs validation & atomic database transaction
  - Emits event on in-memory bus: this.events.emit({ type: 'layout' | 'desks', ... })
        |
        v
[WorkspaceEvents bus (RxJS Subject)]
        |
        v
[OfficeGateway.onWorkspaceEvent]
  - Updates in-memory office cache: office.layout = event.layout
  - Broadcasts via Socket.IO:
      server.to("workspace:" + workspaceId).emit('office:layout', { layout, version, by })
      server.to("workspace:" + workspaceId).emit('office:desks', { desks })
        |
        v
[Browser WebSocket connection (features/office/connection.ts)]
  - Receives 'office:layout' -> invokes handlers.onLayout(layout, version, by)
  - Receives 'office:desks'  -> invokes handlers.onDesks(desks)
        |
        v
[useOfficeConnection hook (features/office/useOfficeConnection.ts)]
  - Dispatches updates to Phaser game controller (setLayout / setDesks)
  - Updates local React store (setWorkspace)
```

1. **When and what the server emits**:
   - Following any successful layout modification, wing expansion, or template switch, the server emits `office:layout` to the workspace room containing the complete new `layout`, the newly incremented `version`, and the actor ID `by: userId`.
   - Layout changes trigger `desks.sync(workspaceId)`. If desk reallocations occurred (e.g. desks were added, moved, or deleted), the server also emits `office:desks` with the full roster of `{ deskId, userId, name, character }` records.
   - Moving or assigning a desk via `PUT /workspace/me/desk` or `PUT /workspace/members/:userId/desk` updates desk assignments and emits `office:desks` to the workspace room immediately.
