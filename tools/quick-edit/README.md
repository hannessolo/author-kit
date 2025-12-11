# Quick Edit Tool

Real-time collaborative WYSIWYG editing for Author Kit. Enables direct in-page content editing with live synchronization across users.

## Overview

Quick Edit bridges two projects:

- **Author Kit** (page integration) - Runs on the actual web page, captures user interactions
- **DA-NX** (editor) - Runs in an iframe, provides ProseMirror editor with Y.js collaboration

```mermaid
flowchart LR
    subgraph Browser
        AK[Author Kit<br/>Page Context]
        DN[DA-NX<br/>Iframe]
    end
    
    AK <-->|MessageChannel| DN
    DN <-->|Y.js WebSocket| YJS[Collaboration<br/>Server]
```

## Key Features

- 🔄 Real-time bidirectional synchronization
- 👥 Multi-user collaborative editing
- 📍 Robust element mapping (survives DOM transformations)
- 🎯 Automatic attribute restoration
- 🔌 Secure cross-frame communication

## How It Works

```mermaid
sequenceDiagram
    participant User
    participant Page as Author Kit
    participant Editor as DA-NX
    participant Collab as Y.js
    
    User->>Page: Type text
    Page->>Editor: content-update
    Editor->>Collab: Broadcast
    Collab->>Editor: Forward to others
    Editor->>Page: text update
    Page->>User: Show changes
```

### Page-Mapper Integration

**Problem**: Attributes set on raw HTML are lost during page rendering (block initialization, DOM transforms).

**Solution**: Page-mapper creates structural path mappings that survive transformations.

```mermaid
flowchart LR
    SOURCE[Raw HTML<br/>with attributes]
    MAPPER[Page-Mapper<br/>Renders in iframe]
    LIVE[Live Page<br/>Paths + Restored attributes]
    
    SOURCE --> MAPPER
    MAPPER --> LIVE
```

## Quick Start

### Data Attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-cursor` | ProseMirror position | `"42"` |
| `data-path-to-source` | Structural path (base64) | `"W3sidGFnI..."` |
| `contenteditable` | Makes element editable | `"true"` |

### Message Types

**Page → Editor**:
- `content-update` - User typed text
- `cursor-move` - User clicked/navigated
- `reload` - Request full refresh

**Editor → Page**:
- `set: 'body'` - Full HTML update (structural changes)
- `set: 'text'` - Optimized text-only update
- `set: 'cursors'` - Remote cursor positions

## Architecture

### Project Structure

```mermaid
flowchart TD
    subgraph AK["Author Kit"]
        QE[quick-edit.js]
        PMI[page-mapper-integration.js]
        PMA[page-mapper-adapter.js]
    end
    
    subgraph PM["Page-Mapper Library"]
        ORC[orchestrator.js]
        SVC[mapper-service.js]
    end
    
    subgraph DN["DA-NX"]
        WP[wysiwyg-portal.js]
        PROSE[prose.js]
    end
    
    QE --> PMI --> PMA --> ORC
    QE <-.->|MessageChannel| WP
```
