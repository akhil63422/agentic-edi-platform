# Agentic EDI Platform

A next-generation Electronic Data Interchange (EDI) platform powered by Agentic AI for autonomous data processing with human-in-the-loop oversight.

## 🌟 Overview

This platform revolutionizes traditional EDI workflows by introducing **Agentic AI** that autonomously parses, maps, and corrects EDI data. Unlike conventional EDI tools, this system operates on a **Management by Exception** principle - users only intervene when the AI has low confidence in its decisions.

### Key Features

- **AI-Powered EDI Processing**: Autonomous parsing and translation of X12/EDIFACT documents
- **Explainable AI**: Every AI decision is clearly highlighted with confidence scores and explanations
- **Human-in-the-Loop**: Easy override and correction of AI suggestions
- **Real-time Monitoring**: Live dashboard showing EDI operations and system health
- **Visual Mapper**: Intuitive drag-and-drop interface for configuring field mappings
- **Enterprise-Grade**: Handles complex EDI hierarchies similar to high-end systems like EDMOSYS

## 🏗️ Architecture

### Technology Stack

- **Frontend**: React.js with Tailwind CSS
- **UI Components**: Shadcn/ui component library
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Icons**: Lucide React
- **Fonts**: Inter (Google Fonts)

### Design Philosophy

The interface follows a **"New Age Enterprise"** aesthetic:
- Clean, minimalist, and airy layouts
- Soft shadows and rounded corners
- Professional color palette with semantic status colors
- Modern sans-serif typography (Inter font family)
- Ample white space for clarity
- Subtle animations and transitions

### Color System

**Status Colors** (Management by Exception):
- **Success/Completed**: Soft Green (#DEF7EC) - Operations completed successfully
- **Warning/AI Suggestion**: Soft Yellow/Amber (#FEF3C7) - AI needs human review
- **Error/Failed**: Soft Red (#FDE8E8) - Failed validations or errors
- **Processing**: Soft Blue - Documents in progress

**Primary Colors**:
- **Primary**: Professional Blue (#3B82F6) - Main actions and highlights
- **Accent**: Indigo (#6366F1) - Secondary highlights
- **Background**: Clean White (#FFFFFF) and Light Gray (#F8FAFC)
- **Text**: Dark Charcoal (#1E293B) for primary, muted grays for secondary

## 📱 Application Views

### 1. EDI Command Center (Dashboard)

The landing page provides system health at a glance:

**KPI Cards**:
- **Inbound X12 (24h)**: Total volume of files processed
- **Successful Translations**: Success rate with trend indicators
- **Active Exceptions**: Documents requiring attention (highlighted in warning color)

**Agentic Flow Visualization**:
A horizontal process diagram showing the data journey:
1. SFTP/S3 (Cloud Icon) - Inbound files
2. EDI Parser (Bucket Icon) - X12/EDIFACT parsing
3. **Agentic AI (Brain Icon)** - Smart processing (highlighted node)
4. Canonical JSON (Code Icon) - Normalized data
5. ERP Integration (Document Icon) - Business system

**Live EDI Activity Table**:
Real-time view of all EDI transactions with:
- Timestamp
- Trading Partner (with logo)
- Document Type (X12 850, 810, 856, etc.)
- Direction (Inbound/Outbound)
- Status badges
- Current processing stage
- Quick actions

### 2. Document Detail & AI Inspector

Core "human-in-the-loop" interface triggered when a document has exceptions:

**Header Section**:
- Document ID and metadata
- Exception badge
- **Confidence Gauge**: Large circular progress ring showing AI confidence score
  - Red zone: Below threshold (requires review)
  - Green zone: High confidence

**AI Suggestion Banner**:
Prominent yellow banner explaining the issue and required action

**Three-Pane Layout**:

1. **Raw X12 Document (Left Pane)**:
   - Read-only monospace display
   - Shows original EDI segments (ISA, GS, ST, BEG, etc.)

2. **Parsed EDI Structure (Middle Pane)**:
   - Collapsible tree view of hierarchical structure
   - Transaction Set → Header → Line Items
   - **AI Intervention Points**: Fields with low confidence highlighted in warning yellow
   - Expandable segments show:
     - Detected value
     - AI suggested value
     - Confidence score
     - Explanation of why the suggestion was made
     - Action buttons: "Apply Suggestion" or "Keep Original"

3. **Canonical Business Object (Right Pane)**:
   - Clean JSON view of final output
   - Highlighted key-value pairs under review
   - Shows the normalized business object structure

**Action Footer**:
- Download Audit Report
- Re-run Translation
- Send to ERP (primary action)

### 3. AI-Assisted Visual Mapper

Configuration interface for EDI-to-JSON mappings:

**AI Activity Banner**:
Shows count of AI-suggested mappings with confidence scores

**Two-Column Interface**:

**Left Column (Source: X12 EDI)**:
- Movable list items for EDI segments/elements
- Examples: BIG02, BIG01, N1*01, IT1*01
- Type badges (string, date, number, decimal)

**Right Column (Target: Canonical JSON)**:
- Target schema fields
- Examples: invoiceNumber, buyer.name, lineItems[]
- Type badges matching source types

**Connection Visualization**:
- **Rule-based mappings**: Solid blue lines with confidence 100%
- **AI-suggested mappings**: Solid yellow/amber lines with confidence badge
- **Pending suggestions**: Dashed lines requiring approval

**Legend**:
Visual guide explaining different mapping types and connection styles

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Python 3.8+
- MongoDB
- Yarn package manager

### Installation

1. **Clone the repository**:
```bash
git clone <repository-url>
cd agentic-edi-platform
```

2. **Install Frontend Dependencies**:
```bash
cd frontend
yarn install
```

3. **Install Backend Dependencies**:
```bash
cd backend
pip install -r requirements.txt
```

4. **Environment Variables**:

Frontend (.env):
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

Backend (.env):
```
MONGO_URL=mongodb://localhost:27017/edi_platform
```

### Running the Application

**Development Mode**:

1. **Start MongoDB**:
```bash
sudo supervisorctl start mongodb
```

2. **Start Backend**:
```bash
sudo supervisorctl start backend
```

3. **Start Frontend**:
```bash
sudo supervisorctl start frontend
```

The application will be available at `http://localhost:3000`

## 🎨 Design System

### Typography

- **Font Family**: Inter (Google Fonts)
- **Heading Scale**:
  - H1: 3xl (30px) - 6xl (60px) responsive
  - H2: lg (18px) - xl (20px) responsive
  - Body: base (16px), sm (14px) mobile
  - Small/Accent: sm (14px), xs (12px)

### Spacing

Based on 4px scale:
- Micro: 0.5 (2px), 1 (4px), 2 (8px)
- Small: 3 (12px), 4 (16px)
- Medium: 6 (24px), 8 (32px)
- Large: 12 (48px), 16 (64px)

### Component Variants

**Buttons**:
- Default: Primary blue with hover state
- Secondary: Light gray background
- Ghost: Transparent with hover background
- Outline: Border only
- Success: Green for positive actions
- Warning: Amber for caution actions

**Badges**:
- Default: Neutral gray
- Status: Success (green), Warning (yellow), Error (red), Processing (blue)

**Cards**:
- Default: White with subtle shadow
- Elevated: Increased shadow on hover
- Status: Colored border and background for alerts

## 🔐 Security & Compliance

- Field-level encryption for sensitive EDI data
- Audit trail for all AI decisions and human overrides
- HIPAA-compliant data handling (where applicable)
- Role-based access control
- Secure API endpoints with authentication

## 📊 AI Confidence Scoring

The platform uses a multi-factor confidence scoring system:

- **Pattern Recognition**: Historical data patterns
- **Format Validation**: EDI standard compliance
- **Business Rules**: Industry-specific requirements
- **Context Analysis**: Related field validation

**Threshold Levels**:
- 90%+: Auto-approve (high confidence)
- 75-89%: Flag for review (medium confidence)
- <75%: Require human approval (low confidence)

## 🔄 EDI Flow Process

1. **Inbound**: Files arrive via SFTP/S3
2. **Parser**: Extract and validate EDI segments
3. **AI Processing**: 
   - Identify document type
   - Apply mapping rules
   - Suggest corrections for anomalies
   - Calculate confidence scores
4. **Human Review**: Review flagged items (if needed)
5. **Canonical JSON**: Convert to standardized format
6. **ERP Integration**: Send to business systems
7. **Feedback Loop**: Learn from corrections

## 🧪 Testing

Run the test suite:

```bash
# Frontend tests
cd frontend
yarn test

# Backend tests
cd backend
pytest

# E2E tests
yarn test:e2e
```

## 📝 Mock Data

The current implementation uses mock data for demonstration:

**Dashboard**:
- 6 sample EDI transactions
- Mix of completed, processing, warning, and error states
- Trading partners: Walmart, Target, Amazon, Home Depot, Costco, Kroger

**Document Detail**:
- Full X12 850 Purchase Order example
- AI suggestion for PO number format (PO893245 → PO-893245)
- 92% confidence score on suggestion

**Mapper**:
- 6 source fields (X12 segments)
- 6 target fields (JSON schema)
- 3 existing mappings (100% confidence)
- 1 AI suggestion (87% confidence)

## 🛠️ Customization

### Adding New Document Types

1. Add parser in `backend/parsers/`
2. Define canonical schema in `backend/schemas/`
3. Update AI model training data
4. Add UI components in `frontend/src/components/`

### Configuring AI Thresholds

Edit `backend/config/ai_settings.py`:
```python
CONFIDENCE_THRESHOLDS = {
    'auto_approve': 0.90,
    'flag_review': 0.75,
    'require_approval': 0.75
}
```

## 📞 Support

For questions or issues:
- Documentation: `/docs`
- API Reference: `/api/docs`

## 📄 License

MIT License

## 🙏 Acknowledgments

- Shadcn/ui for the component library
- Lucide for the icon set
- Google Fonts for Inter typography
- React and FastAPI communities

---

**Built with ❤️ by the Agentic EDI Team**

*Transforming EDI from a pain point to a competitive advantage*
