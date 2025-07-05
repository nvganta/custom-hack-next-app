# ContentPilot Mini Agent

ContentPilot is a mini agent within the multi-agent system, responsible for automated content intelligence—gathering, synthesizing, and delivering high-signal content to users, with editorial workflow and newsletter automation.

## 🚀 Features

- **Content Intelligence**: Automated content gathering from multiple sources
- **Brief Generation**: Daily morning briefings with curated articles
- **Newsletter Automation**: Automated newsletter compilation and sending
- **Editorial Workflow**: Draft, review, publish, and archive content
- **User Preferences**: Personalized content based on focus topics and sources
- **Multi-Source Support**: RSS feeds, APIs, and web crawling

## 📊 Architecture

### Database Models

- **`agent_registry`**: Agent registration and discovery
- **`article`**: Content articles with metadata
- **`newsletter`**: Newsletter management
- **`newsletter_article`**: Article-newsletter relationships
- **`newsletter_subscriber`**: Newsletter subscription management
- **`user_preferences`**: User content preferences
- **`content_source`**: Content source configuration
- **`intelligence_briefing`**: Daily briefing status tracking

### API Endpoints

#### Agent Management
- `POST /api/contentpilot/register` - Register agent with central system
- `POST /api/contentpilot/deregister` - Deregister agent
- `GET /api/contentpilot/health` - Health check endpoint
- `GET /api/contentpilot/capabilities` - Capabilities declaration

#### Content Intelligence
- `POST /api/contentpilot/gather-intelligence` - Trigger content crawling
- `GET /api/contentpilot/brief` - Get latest morning brief

#### Article Management
- `GET /api/contentpilot/article/{id}` - Get full article
- `POST /api/contentpilot/article/{id}/save` - Save article to knowledge base
- `POST /api/contentpilot/article/{id}/newsletter` - Queue/unqueue for newsletter
- `DELETE /api/contentpilot/article/{id}` - Delete article

#### Newsletter Management
- `GET /api/contentpilot/newsletter/queue` - List queued articles
- `POST /api/contentpilot/newsletter/send` - Send newsletter

#### User Preferences
- `GET /api/contentpilot/memory` - Get user preferences and analytics
- `POST /api/contentpilot/memory/update` - Update user preferences

## 🛠️ Setup

### 1. Database Migration

```bash
npx prisma migrate dev --name "add-contentpilot-models"
```

### 2. Environment Variables

Add to your `.env` file:

```env
# ContentPilot Configuration
FIRECRAWL_API_KEY=your_firecrawl_api_key
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=ContentPilot <newsletter@yourdomain.com>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Initialize Content Sources

The system will automatically create default content sources including:
- Hacker News API
- Product Hunt
- TechCrunch RSS
- MIT Technology Review RSS
- Ars Technica RSS

## 📱 Usage

### Access the Dashboard

Navigate to `/contentpilot` to access the ContentPilot dashboard.

### Basic Workflow

1. **Initialize**: Agent auto-registers on first API call
2. **Gather Intelligence**: Click "Gather Intelligence" to crawl sources
3. **Review Brief**: View generated articles and summaries
4. **Manage Queue**: Add/remove articles from newsletter queue
5. **Send Newsletter**: Send test or production newsletters

### API Usage Examples

#### Register Agent
```javascript
const response = await fetch('/api/contentpilot/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "ContentPilot",
    endpoint: "https://yourapp.com/api/contentpilot",
    version: "1.0.0",
    capabilities: ["content_generation", "newsletter_automation"]
  })
});
```

#### Trigger Intelligence Gathering
```javascript
const response = await fetch('/api/contentpilot/gather-intelligence', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    focusTopics: ["AI", "Technology"],
    preferredSources: ["Hacker News", "TechCrunch"]
  })
});
```

#### Get Latest Brief
```javascript
const response = await fetch('/api/contentpilot/brief');
const brief = await response.json();
```

#### Send Newsletter
```javascript
const response = await fetch('/api/contentpilot/newsletter/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    testMode: true,
    testEmail: "test@example.com",
    title: "Daily Content Brief"
  })
});
```

## 🔧 Service Layer

The `ContentPilotService` class provides a convenient interface for all ContentPilot operations:

```javascript
import { ContentPilotService } from '@/lib/contentpilot/service';

const service = ContentPilotService.getInstance();

// Trigger intelligence gathering
await service.triggerIntelligenceGathering({
  focusTopics: ["AI", "Web3"],
  userId: "user123"
});

// Get latest brief
const brief = await service.getLatestBrief();

// Send newsletter
await service.sendNewsletter({
  testMode: true,
  testEmail: "user@example.com"
});
```

## 🎨 React Components

### ContentPilotDashboard

A comprehensive dashboard component that provides:
- Real-time health status
- Intelligence gathering controls
- Article management interface
- Newsletter queue management
- Topic-based article organization
- Test newsletter functionality

## 📈 Monitoring

### Health Check

The health endpoint provides status for:
- Database connectivity
- Crawler service status
- Agent registration status

### Metrics

Track the following metrics:
- Articles generated per day
- Newsletter open rates
- Source reliability
- Topic engagement

## 🔒 Security

- All endpoints require authentication
- API key validation for external services
- Input validation with Zod schemas
- SQL injection protection via Prisma

## 📋 Content Sources

Default sources include:
- **Hacker News**: Front page, newest, ask sections
- **Product Hunt**: Latest products and trends
- **TechCrunch**: Technology news RSS feed
- **MIT Technology Review**: Research and innovation
- **Ars Technica**: Technology analysis

## 🔄 Newsletter Templates

The system generates HTML newsletters with:
- Responsive design
- Article summaries and TL;DR sections
- Topic tags
- Source attribution
- Professional styling

## 🚀 Deployment

ContentPilot is designed to:
- Scale horizontally
- Support multiple content sources
- Handle concurrent requests
- Integrate with existing authentication systems
- Support versioned APIs

## 📝 Development

### Adding New Content Sources

1. Add source to `content_source` table
2. Implement crawler logic in `gather-intelligence` endpoint
3. Test with sample data
4. Monitor source reliability

### Extending API

Follow the existing patterns:
- Use Zod for validation
- Implement proper error handling
- Add TypeScript interfaces
- Update service layer
- Document endpoints

## 🤝 Integration

ContentPilot integrates with:
- **Firecrawl**: Web content extraction
- **Resend**: Email delivery
- **Prisma**: Database ORM
- **Better Auth**: Authentication
- **Zod**: Data validation

This implementation provides a complete mini-agent system for content intelligence and newsletter automation, following the PRD specifications. 