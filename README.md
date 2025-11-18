# Social Media Marketing Automation Tool

**Master Control Platform for Managing 50+ Social Media Accounts Across Facebook, Instagram, YouTube, and TikTok**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)]()

## 🚀 Features

### Core Capabilities
- **Multi-Account Management**: Connect and manage 50+ Facebook, Instagram, YouTube, and TikTok accounts
- **Automated Posting**: Schedule and automatically post to multiple accounts across all platforms simultaneously
- **Smart Content Generation**: AI-powered caption, hashtag, and description generation using Claude API
- **Video Creation Integration**: Seamless integration with Veed.io for automated video creation and editing
- **Auto-Responses**: Intelligent automated responses to comments, DMs, and mentions
- **Engagement Monitoring**: Real-time tracking of likes, comments, shares, and engagement metrics
- **Analytics Dashboard**: Comprehensive analytics and performance tracking for all accounts
- **Thumbnail Generation**: AI-powered thumbnail creation for YouTube videos
- **Bulk Operations**: Upload and schedule hundreds of posts at once via CSV
- **Hashtag Management**: Track hashtag performance and get recommendations
- **Growth Features**: Auto-follow, auto-like, and auto-comment capabilities with safety limits

### Platform Support
- **Instagram**: Posts, Reels, Stories, Carousels, and engagement tracking
- **Facebook**: Page posts, engagement monitoring, and audience analysis
- **YouTube**: Video uploads, Shorts, channel management, and analytics
- **TikTok**: Video posting, engagement tracking, and trend analysis

## 📋 Requirements

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Database**: SQLite3
- **Optional Services**: Claude API, Veed.io, Facebook/Instagram OAuth, YouTube API, TikTok API

## 🔧 Installation

### Local Development

```bash
git clone https://github.com/yourusername/traffic2umarketing.git
cd Traffic2umarketing
npm install
cp .env.example .env
npm run db:init
npm run dev
```

Access dashboard: `http://localhost:3000/dashboard`

### Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive production deployment to `master.traffic2umarketing.com`

## 📖 Usage

### Admin Dashboard

Access at `http://localhost:3000/dashboard` (development) or `https://master.traffic2umarketing.com/dashboard` (production)

**Key Features:**
1. **Dashboard**: Overview of all accounts and engagement metrics
2. **Accounts**: Connect and manage 50+ social media accounts
3. **Posts & Scheduling**: Create and schedule posts to multiple accounts
4. **Content Generation**: AI-powered captions, hashtags, and thumbnails
5. **Auto-Responses**: Set up automatic responses to comments and DMs
6. **Analytics**: Real-time engagement tracking and performance metrics
7. **Settings**: System configuration and feature toggles

### Key Workflows

#### Add Account
1. Go to **Accounts** tab → **+ Add New Account**
2. Select platform and authenticate with OAuth2
3. Save and start posting

#### Schedule Post
1. Go to **Posts & Scheduling** → Enter content
2. Select platforms and target accounts (up to 50)
3. Set scheduled time and click **Schedule Post**

#### Generate Content with AI
1. Go to **Content Generation**
2. Generate captions, hashtags, descriptions, or thumbnails
3. Copy and use in posts

#### Auto-Response
1. Go to **Auto Responses** → **+ Create Rule**
2. Set trigger type and response template
3. Enable rule to start auto-responding

## 🔌 API Endpoints

- `GET /health` - Health check
- `GET /api/accounts` - List accounts
- `POST /api/accounts` - Add account
- `GET /api/posts` - List posts
- `POST /api/posts` - Create post
- `POST /api/content/generate-caption` - Generate caption
- `POST /api/content/generate-hashtags` - Generate hashtags
- `GET /api/analytics/overview` - Analytics overview
- More endpoints in [API docs](./docs/API.md)

## 🤖 AI Features

Uses Claude 3.5 Sonnet for:
- Intelligent caption generation
- Hashtag recommendations
- Description writing
- Post ideas generation
- Sentiment analysis
- Auto-response generation

Set `CLAUDE_API_KEY` in `.env` to enable.

## 🎬 Video Integration

- **Veed.io**: Automated video creation, editing, and formatting
- **FFmpeg**: Local video processing and compression
- **Thumbnail Generation**: AI-powered YouTube thumbnail creation

## 🔐 Security

- AES-256 encryption for credentials
- Basic auth for admin endpoints
- API key authentication
- CORS protection
- Rate limiting (100 req/hour)
- Input validation and sanitization
- Helmet.js security headers
- HTTPS required in production

## 📊 Database Schema

Key tables:
- `accounts`: Connected social media accounts
- `scheduled_posts`: Posts scheduled for posting
- `posted_content`: History of posted content
- `engagement_data`: Engagement metrics
- `auto_response_rules`: Auto-response rules
- `analytics_daily`: Daily analytics

## 🚀 Deployment

### Quick Start (Local)
```bash
npm install
npm run db:init
npm run dev
```

### Production (Ubuntu VPS)
See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- VPS setup and Node.js installation
- Nginx reverse proxy configuration
- SSL/TLS with Let's Encrypt
- PM2 process management
- Backup and monitoring setup

## 🐛 Troubleshooting

- **App won't start**: Check Node.js version, verify `.env` file
- **Posts not posting**: Verify account credentials, check rate limits
- **AI not working**: Verify `CLAUDE_API_KEY` is set
- **Database errors**: Check SQLite permissions and disk space

See logs: `tail -f logs/combined.log`

## 📝 Configuration

Key environment variables in `.env`:

```env
NODE_ENV=production
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=strong-password
CLAUDE_API_KEY=sk-...
VEED_API_KEY=veed-...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
```

## 📚 Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
- [.env.example](./.env.example) - Configuration reference
- [lib/database.js](./lib/database.js) - Database schema

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push and open Pull Request

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

## 💬 Support

- **Email**: support@traffic2umarketing.com
- **Docs**: https://docs.traffic2umarketing.com
- **Issues**: GitHub Issues

---

**Social Media Marketing Automation Tool v1.0**
Built with Node.js, Express, SQLite, Claude AI, and Veed.io
Master Control Platform for Traffic2u Marketing