# Quick Edit - Technical Documentation

This document provides detailed technical information about the Quick Edit implementation, including API references, sequence diagrams, debugging guides, and troubleshooting.

## Table of Contents

- [Initialization Flow](#initialization-flow)
- [Component API Reference](#component-api-reference)
- [Page-Mapper Integration Details](#page-mapper-integration-details)
- [Message Protocol Specification](#message-protocol-specification)
- [Data Attributes Lifecycle](#data-attributes-lifecycle)
- [Sequence Diagrams](#sequence-diagrams)

---

## Initialization Flow

### Complete Initialization Sequence

```mermaid
sequenceDiagram
    participant Page as Web Page
    participant QE as Quick Edit (Author Kit)
    participant Iframe as Iframe Container
    participant WP as WYSIWYG Portal (DA-NX)
    participant PM as Page Mapper
    participant Prose as ProseMirror Editor
    participant WS as Y.js WebSocket
    
    Page->>QE: loadQuickEdit(payload)
    QE->>QE: Check if already loaded
    
    alt Not loaded
        QE->>Iframe: Create iframe element
        QE->>Iframe: Set src to DA Live URL
        QE->>QE: Create MessageChannel (port1, port2)
        QE->>QE: Start pollConnection()
        
        loop Every 500ms (max 20 times)
            QE->>WP: postMessage(init, config, port2)
            
            alt Connection established
                WP->>WP: Store port reference
                WP->>QE: postMessage({ ready: true })
                QE->>QE: Set initialized = true
                
                WP->>WP: Parse mountpoint URL
                WP->>Prose: initProse(owner, repo, path)
                Prose->>WS: Connect Y.js WebSocket
                WS-->>Prose: Document state
                
                Prose->>WP: Provide view & wsProvider
                WP->>WP: getInstrumentedHTML(view)
                WP->>QE: postMessage({ set: 'body', body: html })
                
                QE->>PM: initializePageMapper(rawHTML)
                PM->>PM: Render in iframe with decorators
                PM->>PM: Build source → rendered mapping
                PM-->>QE: MapperService
                
                QE->>PM: applyLiveElementAttributes()
                PM->>PM: Get all mapped pairs
                PM->>Page: Set data-path-to-source on elements
                PM->>Page: Restore data-cursor, contenteditable
                
                QE->>Page: setupContentEditableListeners()
            end
        end
    end
```

### Component Initialization Dependencies

```mermaid
flowchart TB
    START[User Opens Page]
    
    START --> LOAD[loadQuickEdit]
    LOAD --> CREATE[Create Iframe]
    CREATE --> CHANNEL[Create MessageChannel]
    CHANNEL --> TRANSFER[Transfer port2]
    TRANSFER --> POLL[Poll Connection]
    
    POLL --> READY{Ready?}
    READY -->|Yes| PROSE[Initialize ProseMirror]
    READY -->|No, < 20 attempts| POLL
    READY -->|No, >= 20| FAIL[Connection Failed]
    
    PROSE --> YJS[Connect Y.js]
    YJS --> INSTR[Generate Instrumented HTML]
    INSTR --> SEND[Send to Author Kit]
    
    SEND --> MAPPER[Initialize Page Mapper]
    MAPPER --> RENDER[Render in Iframe]
    RENDER --> BUILD[Build Mappings]
    BUILD --> APPLY[Apply Paths & Attributes]
    APPLY --> LISTEN[Setup Event Listeners]
    LISTEN --> COMPLETE[Ready for Editing]
```

---

## Component API Reference

### Author Kit Component Hierarchy

```mermaid
flowchart TD
    subgraph QuickEdit["quick-edit.js"]
        QE_LOAD[loadQuickEdit]
        QE_HANDLE[handleLoad]
        QE_SETUP[setupContentEditableListeners]
        QE_UPDATE[updateInstrumentation]
        QE_CURSOR[setRemoteCursors]
        QE_GET[getCursorPosition]
        QE_POLL[pollConnection]
        
        QE_LOAD --> QE_HANDLE
        QE_HANDLE --> QE_SETUP
        QE_SETUP --> QE_UPDATE
    end
    
    subgraph Mapper["page-mapper-integration.js"]
        PM_INIT[initializePageMapper]
        PM_APPLY[applyLiveElementAttributes]
        PM_COPY[copySourceAttributes]
        
        PM_INIT --> PM_APPLY
        PM_APPLY --> PM_COPY
    end
    
    subgraph Adapter["page-mapper-adapter.js"]
        PA_CREATE[createAuthorKitMapper]
        PA_DECORATE[decorateForMapper]
        
        PA_CREATE --> PA_DECORATE
    end
    
    subgraph Utils["utils.js"]
        U_SAVE[saveCursorPosition]
        U_RESTORE[restoreCursorPosition]
        U_SERIALIZE[serializePathToSource]
    end
    
    QE_HANDLE --> PM_INIT
    PM_INIT --> PA_CREATE
```

### DA-NX Component Hierarchy

```mermaid
flowchart TD
    subgraph Portal["wysiwyg-portal.js"]
        WP_DEFAULT[default - Entry Point]
        WP_INIT[initPort]
        WP_PROSE[initProse]
        WP_MSG[onMessage]
        WP_CONTENT[handleContentUpdate]
        WP_CURSOR[handleCursorMove]
        WP_INSTR[getInstrumentedHTML]
        WP_UPDATE[updateDocument]
        WP_TEXT[updateText]
        WP_CURSORS[updateCursors]
        WP_PERM[checkPermissions]
        
        WP_DEFAULT --> WP_INIT
        WP_INIT --> WP_PROSE
        WP_MSG --> WP_CONTENT
        WP_MSG --> WP_CURSOR
        WP_PROSE --> WP_INSTR
        WP_INSTR --> WP_UPDATE
        WP_INSTR --> WP_CURSORS
    end
    
    subgraph Prose["prose.js (ProseMirror)"]
        P_INIT[Initialize Editor]
        P_STATE[Document State]
        P_TRANS[Transactions]
        P_YJS[Y.js Integration]
        
        P_INIT --> P_STATE
        P_STATE --> P_TRANS
        P_INIT --> P_YJS
    end
    
    WP_PROSE --> P_INIT
```

### Function Parameters & Returns

```mermaid
flowchart TB
    LQE_IN["loadQuickEdit<br/>---<br/>IN: config, location"]
    LQE_PROC["Create iframe<br/>Setup MessageChannel<br/>Poll connection"]
    LQE_OUT["OUT: Initialized editor"]
    
    IPM_IN["initializePageMapper<br/>---<br/>IN: sourceHTML string"]
    IPM_PROC["Parse HTML<br/>Embed markers<br/>Render and map"]
    IPM_OUT["OUT: MapperService"]
    
    ALE_IN["applyLiveElementAttributes<br/>---<br/>IN: none (uses service)"]
    ALE_PROC["Get mapped pairs<br/>Apply paths<br/>Restore attributes"]
    ALE_OUT["OUT: void"]
    
    SCE_IN["setupContentEditableListeners<br/>---<br/>IN: port"]
    SCE_PROC["Query elements<br/>Attach handlers"]
    SCE_OUT["OUT: void"]
    
    LQE_IN --> LQE_PROC --> LQE_OUT
    IPM_IN --> IPM_PROC --> IPM_OUT
    ALE_IN --> ALE_PROC --> ALE_OUT
    SCE_IN --> SCE_PROC --> SCE_OUT
```

---

## Page-Mapper Integration Details

### Problem & Solution

```mermaid
flowchart TD
    subgraph Problem["❌ Original Approach"]
        P1[DA-NX sets data-cursor<br/>on raw HTML]
        P2[HTML sent to Author Kit]
        P3[Page rendering occurs<br/>Blocks initialize<br/>DOM transforms]
        P4[❌ Attributes LOST<br/>Mapping broken]
        
        P1 --> P2
        P2 --> P3
        P3 --> P4
    end
    
    subgraph Solution["✓ Page-Mapper Approach"]
        S1[DA-NX sends raw HTML<br/>with data-cursor]
        S2[Page-mapper renders<br/>in isolated iframe<br/>Same decorators]
        S3[Build structural path mapping<br/>Source ↔ Rendered]
        S4[✓ Apply data-path-to-source<br/>✓ Restore lost attributes<br/>Mapping preserved]
        
        S1 --> S2
        S2 --> S3
        S3 --> S4
    end
```

### Three-Phase Mapping Process

```mermaid
flowchart TD
    subgraph Phase1["Phase 1: Marker Embedding"]
        P1_IN[Source HTML]
        P1_PARSE[Parse with DOMParser]
        P1_EMBED[Embed hidden markers<br/>data-marker='hash-xxx']
        P1_TRACK[Track marker → source path]
        P1_OUT[Marked HTML]
        
        P1_IN --> P1_PARSE
        P1_PARSE --> P1_EMBED
        P1_EMBED --> P1_TRACK
        P1_TRACK --> P1_OUT
    end
    
    subgraph Phase2["Phase 2: Iframe Rendering"]
        P2_IN[Marked HTML]
        P2_IFRAME[Create isolated iframe]
        P2_DECORATE[Apply decorators<br/>loadArea, blocks, etc.]
        P2_RENDER[Full page rendering]
        P2_OUT[Rendered HTML with markers]
        
        P2_IN --> P2_IFRAME
        P2_IFRAME --> P2_DECORATE
        P2_DECORATE --> P2_RENDER
        P2_RENDER --> P2_OUT
    end
    
    subgraph Phase3["Phase 3: Mapping"]
        P3_IN[Rendered HTML]
        P3_FIND[Find markers in rendered DOM]
        P3_PATH[Calculate marker → page path]
        P3_BUILD[Build mapping<br/>Source path ↔ Page path]
        P3_OUT[MapperService]
        
        P3_IN --> P3_FIND
        P3_FIND --> P3_PATH
        P3_PATH --> P3_BUILD
        P3_BUILD --> P3_OUT
    end
    
    Phase1 --> Phase2
    Phase2 --> Phase3
```

### Path Calculation Example

```mermaid
flowchart TB
    subgraph Source["Source HTML Structure"]
        direction TB
        S_MAIN[main]
        S_DIV[div data-cursor=0]
        S_H1[h1: Title]
        
        S_MAIN --> S_DIV --> S_H1
    end
    
    subgraph Marker["Marker Injection"]
        direction TB
        MARKER[Embedded Marker:<br/>hash-abc123]
    end
    
    subgraph Rendered["Rendered HTML Structure"]
        direction TB
        R_MAIN[main]
        R_SECTION[div.section]
        R_HERO[div.hero-content]
        R_H1[h1: Title<br/>marker: hash-abc123]
        
        R_MAIN --> R_SECTION --> R_HERO --> R_H1
    end
    
    subgraph Paths["Calculated Paths"]
        direction TB
        SP["Source Path: DIV[0]<br/>(from main to div)"]
        PP["Page Path: DIV[0] > DIV[0]<br/>(from main to hero-content)"]
        MAP[Mapping Table]
    end
    
    S_H1 -->|Add marker| MARKER
    MARKER -->|Survives rendering| R_H1
    S_H1 -->|Calculate| SP
    R_H1 -->|Calculate| PP
    SP --> MAP
    PP --> MAP
```

### Attribute Restoration Flow

```mermaid
sequenceDiagram
    participant Source as Source Element
    participant Mapper as Page Mapper
    participant Rendered as Rendered Element
    
    Note over Source: Has attributes:<br/>data-cursor='42'<br/>contenteditable='true'
    
    Source->>Mapper: Track in source path
    Mapper->>Mapper: Render in iframe
    
    Note over Rendered: After rendering:<br/>Attributes LOST
    
    Mapper->>Rendered: Find via structural path
    Mapper->>Source: Read original attributes
    Mapper->>Rendered: Restore attributes
    
    Note over Rendered: Now has:<br/>data-cursor='42'<br/>contenteditable='true'<br/>data-path-to-source='W3...'
```

### Configured Attributes

```mermaid
flowchart TD
    subgraph Config["ATTRIBUTES_TO_RESTORE"]
        A1[data-cursor<br/>ProseMirror position]
        A2[contenteditable<br/>Editable flag]
        A3[data-cursor-remote<br/>Remote user indicator]
    end
    
    subgraph Source["Source Element"]
        S[Has all attributes]
    end
    
    subgraph Rendered["Rendered Element"]
        R1[Missing attributes<br/>after decoration]
        R2[Attributes restored<br/>by mapper]
    end
    
    Source --> R1
    Config --> R2
    R1 --> R2
```

---

## Message Protocol Specification

### Message Flow Overview

```mermaid
flowchart LR
    subgraph AuthorKit["Author Kit (port1)"]
        A1[Send:<br/>content-update<br/>cursor-move<br/>reload]
        A2[Receive:<br/>set: body<br/>set: text<br/>set: cursors]
    end
    
    subgraph Channel["MessageChannel"]
        CH[Bidirectional<br/>Communication]
    end
    
    subgraph DANX["DA-NX (port2)"]
        D1[Receive:<br/>content-update<br/>cursor-move<br/>reload]
        D2[Send:<br/>set: body<br/>set: text<br/>set: cursors]
    end
    
    A1 --> CH
    CH --> D1
    D2 --> CH
    CH --> A2
```

### Author Kit → DA-NX Messages

```mermaid
flowchart TD
    subgraph ContentUpdate["content-update"]
        CU_TRIG[Trigger:<br/>User types in element]
        CU_DATA["Data:<br/>- type: 'content-update'<br/>- newText: string<br/>- cursorOffset: number<br/>- pathToSource: string"]
        CU_HAND[Handler:<br/>handleContentUpdate]
        CU_ACT[Action:<br/>Update ProseMirror doc<br/>Broadcast via Y.js]
        
        CU_TRIG --> CU_DATA
        CU_DATA --> CU_HAND
        CU_HAND --> CU_ACT
    end
    
    subgraph CursorMove["cursor-move"]
        CM_TRIG[Trigger:<br/>User clicks/navigates]
        CM_DATA["Data:<br/>- type: 'cursor-move'<br/>- cursorOffset: number<br/>- textCursorOffset: number<br/>- pathToSource: string"]
        CM_HAND[Handler:<br/>handleCursorMove]
        CM_ACT[Action:<br/>Update selection<br/>Broadcast cursor position]
        
        CM_TRIG --> CM_DATA
        CM_DATA --> CM_HAND
        CM_HAND --> CM_ACT
    end
    
    subgraph Reload["reload"]
        R_TRIG[Trigger:<br/>Element not found]
        R_DATA["Data:<br/>- type: 'reload'"]
        R_HAND[Handler:<br/>onMessage]
        R_ACT[Action:<br/>Send full document]
        
        R_TRIG --> R_DATA
        R_DATA --> R_HAND
        R_HAND --> R_ACT
    end
```

### DA-NX → Author Kit Messages

```mermaid
flowchart TD
    subgraph SetBody["set: 'body'"]
        SB_TRIG[Trigger:<br/>Structural changes<br/>Initialization]
        SB_DATA["Data:<br/>- set: 'body'<br/>- body: HTML string"]
        SB_HAND[Handler:<br/>port1.onmessage]
        SB_ACT[Action:<br/>Replace body.innerHTML<br/>Run page-mapper<br/>Setup listeners]
        
        SB_TRIG --> SB_DATA
        SB_DATA --> SB_HAND
        SB_HAND --> SB_ACT
    end
    
    subgraph SetText["set: 'text'"]
        ST_TRIG[Trigger:<br/>Text-only changes]
        ST_DATA["Data:<br/>- set: 'text'<br/>- text: string<br/>- cursorOffset: number"]
        ST_HAND[Handler:<br/>port1.onmessage]
        ST_ACT[Action:<br/>Update element.textContent<br/>Save/restore cursor<br/>Update instrumentation]
        
        ST_TRIG --> ST_DATA
        ST_DATA --> ST_HAND
        ST_HAND --> ST_ACT
    end
    
    subgraph SetCursors["set: 'cursors'"]
        SC_TRIG[Trigger:<br/>Remote cursor move]
        SC_DATA["Data:<br/>- set: 'cursors'<br/>- body: HTML with cursors"]
        SC_HAND[Handler:<br/>port1.onmessage]
        SC_ACT[Action:<br/>Update data-cursor-remote<br/>Show visual indicators]
        
        SC_TRIG --> SC_DATA
        SC_DATA --> SC_HAND
        SC_HAND --> SC_ACT
    end
```

### Message Routing in DA-NX

```mermaid
flowchart TD
    MSG[Incoming Message<br/>on port2]
    
    MSG --> TYPE{Message Type?}
    
    TYPE -->|content-update| CU[handleContentUpdate]
    TYPE -->|cursor-move| CM[handleCursorMove]
    TYPE -->|reload| RL[updateDocument]
    TYPE -->|Unknown| IGN[Ignore]
    
    CU --> PROSE1[Update ProseMirror]
    CM --> PROSE2[Update Selection]
    RL --> SEND[Send Full HTML]
    
    PROSE1 --> YJS[Y.js Broadcast]
    PROSE2 --> YJS
```

---

## Data Attributes Lifecycle

### Attribute Flow Diagram

```mermaid
flowchart TB
    subgraph Creation["1. Creation"]
        CR_DA[DA-NX creates<br/>in getInstrumentedHTML]
        CR_AK[Author Kit creates<br/>on user interaction]
        CR_PM[Page-mapper creates<br/>during mapping]
    end
    
    subgraph Transfer["2. Transfer"]
        TR_MSG[Via MessageChannel<br/>in HTML payload]
        TR_DOM[Applied to DOM elements]
    end
    
    subgraph Usage["3. Usage"]
        US_READ[Author Kit reads<br/>for element lookup]
        US_SEND[Author Kit sends<br/>in messages to DA-NX]
        US_UPDATE[Author Kit updates<br/>on content changes]
    end
    
    subgraph Restoration["4. Restoration"]
        RS_LOST[Lost during rendering]
        RS_MAPPER[Page-mapper restores<br/>from source]
    end
    
    CR_DA --> TR_MSG
    CR_AK --> TR_DOM
    CR_PM --> TR_DOM
    TR_MSG --> TR_DOM
    TR_DOM --> US_READ
    US_READ --> US_SEND
    TR_DOM --> US_UPDATE
    TR_DOM --> RS_LOST
    RS_LOST --> RS_MAPPER
```

### data-cursor Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: DA-NX generates<br/>via posAtDOM
    Created --> Sent: Included in<br/>body message
    Sent --> Applied: Set on DOM element
    Applied --> Read: Author Kit reads<br/>for message
    Read --> Updated: updateInstrumentation<br/>on text change
    Applied --> Lost: During rendering
    Lost --> Restored: Page-mapper restores
    Updated --> [*]
    Restored --> Applied
```

### data-path-to-source Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Mapping: Page-mapper<br/>builds paths
    Mapping --> Serialized: JSON → Base64
    Serialized --> Applied: Set on DOM element
    Applied --> Read: Author Kit reads<br/>for lookup
    Read --> Sent: Included in messages<br/>to DA-NX
    Sent --> Logged: DA-NX logs<br/>(future use)
    Applied --> Reapplied: On every<br/>body update
    Logged --> [*]
    Reapplied --> Applied
```

### Attribute Dependencies

```mermaid
flowchart TD
    subgraph Primary["Primary Attributes"]
        DC[data-cursor<br/>Required for ProseMirror<br/>position mapping]
        DPS[data-path-to-source<br/>Required for structural<br/>element lookup]
    end
    
    subgraph Supporting["Supporting Attributes"]
        DIL[data-initial-length<br/>For diff calculation]
        DCR[data-cursor-remote<br/>For collaboration UI]
        CE[contenteditable<br/>For browser editing]
    end
    
    subgraph Events["User Events"]
        CLICK[click/keyup]
        INPUT[input]
    end
    
    DC --> INPUT
    DPS --> INPUT
    DPS --> CLICK
    DC --> CLICK
    CLICK --> DIL
    DCR --> CE
```

---

## Sequence Diagrams

### Complete Editing Session

```mermaid
sequenceDiagram
    actor User1
    actor User2
    participant Page1 as Page 1<br/>(Author Kit)
    participant WP as WYSIWYG Portal<br/>(DA-NX)
    participant YJS as Y.js WebSocket
    participant Page2 as Page 2<br/>(Author Kit)
    
    Note over Page1,Page2: Initialization Phase
    User1->>Page1: Open ?da-editor=true
    Page1->>WP: Create iframe + MessageChannel
    WP->>YJS: Connect to collaboration room
    YJS-->>WP: Sync document state
    WP->>Page1: Send body HTML
    Page1->>Page1: Run page-mapper<br/>Apply attributes<br/>Setup listeners
    
    User2->>Page2: Open same page
    Page2->>WP: Connect to iframe
    WP->>YJS: Join session
    YJS-->>WP: Sync state
    WP->>Page2: Send body HTML
    Page2->>Page2: Run page-mapper<br/>Setup listeners
    
    Note over Page1,Page2: Editing Phase
    User1->>Page1: Type "Hello"
    Page1->>WP: content-update message
    WP->>WP: Update ProseMirror doc
    WP->>YJS: Broadcast change
    YJS->>WP: Forward to Page 2
    WP->>Page2: text update message
    Page2->>Page2: Update element.textContent
    Page2-->>User2: Show "Hello"
    
    User2->>Page2: Click different element
    Page2->>WP: cursor-move message
    WP->>WP: Update selection
    WP->>YJS: Broadcast cursor position
    YJS->>WP: Forward to Page 1
    WP->>Page1: cursors message
    Page1->>Page1: Add red cursor indicator
    Page1-->>User1: Show User 2's cursor
    
    Note over Page1,Page2: Structural Change
    User1->>WP: Add paragraph (in iframe UI)
    WP->>WP: ProseMirror transaction
    WP->>YJS: Broadcast structural change
    WP->>Page1: body message (full HTML)
    Page1->>Page1: Replace body<br/>Run page-mapper<br/>Reload page
    YJS->>WP: Notify Page 2
    WP->>Page2: body message
    Page2->>Page2: Replace body<br/>Run page-mapper<br/>Reload page
```

### Error Handling Flow

```mermaid
sequenceDiagram
    participant User
    participant Page as Author Kit
    participant WP as DA-NX
    
    User->>Page: Type in element
    Page->>Page: Get data-cursor
    
    alt Element found
        Page->>WP: content-update message
        WP->>WP: Update document
        WP->>Page: text update
        Page->>Page: Update element
    else Element not found
        Page->>Page: data-cursor missing!
        Page->>WP: reload message
        WP->>WP: Generate full HTML
        WP->>Page: body message
        Page->>Page: Full page refresh<br/>Run page-mapper
        Page-->>User: Page reloaded
    end
```

### Cursor Position Synchronization

```mermaid
sequenceDiagram
    participant User
    participant Element as Editable Element
    participant QE as Quick Edit
    participant WP as WYSIWYG Portal
    participant PM as ProseMirror
    
    User->>Element: Click at position
    Element->>QE: click event
    QE->>QE: getCursorPosition()<br/>Get data-cursor<br/>Get pathToSource
    QE->>WP: cursor-move message
    WP->>PM: Calculate absolute position<br/>(cursorOffset + textCursorOffset)
    PM->>PM: Validate position
    
    alt Position valid
        PM->>PM: Create selection transaction
        PM->>PM: Dispatch transaction
        PM->>PM: Broadcast via Y.js awareness
    else Position invalid
        WP->>WP: Log warning<br/>Ignore invalid position
    end
```
