# Ad Management System Documentation

## Overview

The Social Media Marketing Automation Platform includes a comprehensive **Ad Management System** for creating, managing, and optimizing paid advertising campaigns across Facebook, Instagram, Google, and TikTok.

---

## Features

### 1. Campaign Management
- Create and schedule ad campaigns with specific objectives
- Support for multiple campaign objectives: awareness, reach, consideration, conversion, leads, traffic
- Set budgets (total and daily) with automatic tracking
- Campaign status management (draft, scheduled, active, paused, ended)
- A/B testing framework for campaign optimization

### 2. AI-Powered Ad Creative Generation
Using Claude AI, automatically generate:
- **Headlines**: Platform-optimized, attention-grabbing headlines
- **Ad Copy**: Persuasive body text tailored to target audience
- **Call-to-Actions**: Compelling CTAs optimized for conversions
- **Descriptions**: Benefit-focused copy that complements headlines
- **Targeting Criteria**: Demographic, interest, and behavior-based audience suggestions
- **Bidding Strategies**: Recommendations based on campaign objective and budget
- **Image Descriptions**: Detailed specifications for AI image generation

### 3. Automated Image Generation
- **Ad Banner Creation**: Generate branded ad banners with custom text
- **Product Showcase**: Create product display images with pricing and discounts
- **Carousel Images**: Generate multi-image carousel ads
- **Comparison Images**: Create before-after comparison visuals
- **Platform Optimization**: Auto-resize and optimize images for each platform
- **Watermarking**: Add logos and branding to images
- **Text Overlays**: Add headlines and CTAs directly to images

### 4. Creative Management
- Create multiple ad creatives per campaign
- Track creative performance with individual metrics
- Mark creatives as AI-generated or manually created
- Support for different creative types: image, video, carousel, collection, dynamic
- Creative status tracking: draft, pending, active, rejected, paused

### 5. Performance Tracking & Analytics
Track comprehensive metrics for each ad:
- **Engagement Metrics**: Impressions, clicks, CTR, reach, frequency
- **Cost Metrics**: CPC, CPM, cost per conversion, cost per lead
- **Conversion Metrics**: Conversions, leads, ROAS, ROI
- **Video Metrics**: Video views, completion rate, engagement
- **Daily Performance**: Automatic daily metrics aggregation

### 6. AI-Powered Auto-Optimization
Automatic campaign optimization based on performance data:

#### Budget Optimization
- Detect underperforming campaigns (ROAS < 1.0)
- Detect high-performing campaigns (ROAS > 2.5)
- Automatically adjust budgets up or down
- Rebalance budget allocation to top-performing creatives

#### Creative Rotation
- Pause underperforming creatives automatically
- Recommend creative pauses based on CTR thresholds
- Identify high-potential paused creatives for reactivation
- Track all optimization decisions

#### Bid Optimization
- Recommend bid strategy changes based on performance
- Suggest increases for high ROAS campaigns
- Suggest decreases for high CPC campaigns
- Provide conversion-focused recommendations

#### Audience Optimization
- Identify underperforming audience segments
- Recommend audience narrowing when CPC is high
- Suggest audience expansion for scalable campaigns
- Audience adjustment logging

### 7. A/B Testing
- Create structured A/B (and A/B/C) tests
- Test different variables: headline, image, copy, CTA, audience, placement
- Automatic test running with configurable duration
- Winning variant identification
- Confidence level calculation

### 8. Audience Management
Multiple audience types supported:
- **Custom Audiences**: Upload/import custom audiences
- **Lookalike Audiences**: Auto-created from similar users
- **Interest-Based**: Target by interests and hobbies
- **Demographic**: Age, gender, location targeting
- **Behavior-Based**: Target by purchase behavior, device usage
- **Engagement**: Target users who engaged with your content

### 9. Lead Capture & CRM
- Automatic lead capture from ad campaigns
- Lead status tracking: new, contacted, qualified, converted, lost
- Lead value tracking and attribution
- Lead notes and history
- Lead source tracking

### 10. Conversion Tracking
- Setup conversion pixels for each platform
- Track multiple conversion types: purchase, lead, signup, page view, add to cart, view content
- Associate conversions with campaigns and creatives
- Track conversion value and currency
- Attribution data capture

### 11. Budget Allocation
- Smart budget allocation by audience segment
- Allocation by placement and device type
- Performance-based reallocation
- Track budget adjustment history
- Automatic vs manual allocation modes

### 12. Optimization History
- Complete audit trail of all optimizations
- Track what changed and why
- Performance impact of each change
- Automatic vs manual optimization logging
- Historical performance analysis

---

## Database Schema

### Core Tables (10+ tables)

#### `ad_campaigns`
- Campaign details, objectives, budget, targeting, bidding
- Status tracking and performance aggregates

#### `ad_creatives`
- Individual ad variations
- Headlines, copy, images, videos, CTAs
- AI-generation flags and performance scores

#### `ad_performance`
- Daily metrics for each creative
- Impressions, clicks, conversions, spend, ROI
- CTR, CPC, CPM, ROAS calculations

#### `ad_ab_tests`
- A/B test configuration and results
- Winning variant tracking
- Test duration and status

#### `ad_audiences`
- Audience segment definitions
- Audience type and source
- Targeting criteria

#### `ad_conversions`
- Individual conversion tracking
- Type, value, timestamp
- User and referrer data

#### `ad_budget_allocation`
- Budget allocation by audience/placement/device
- Allocation history and recommendations
- Performance improvement tracking

#### `ad_pixels`
- Conversion pixels for each platform
- Event tracking setup
- Pixel status and activation

#### `ad_leads`
- Captured leads from campaigns
- Lead details and status
- Lead value and notes

#### `ad_optimization_history`
- Audit trail of all optimizations
- Optimization type and reason
- Previous and new values

---

## API Endpoints

### Campaign Management

```
GET    /api/ads/campaigns                 # List all campaigns
POST   /api/ads/campaigns                 # Create new campaign
GET    /api/ads/campaigns/:id             # Get campaign details
PATCH  /api/ads/campaigns/:id             # Update campaign
POST   /api/ads/campaigns/:id/launch      # Launch campaign
POST   /api/ads/campaigns/:id/pause       # Pause campaign
GET    /api/ads/campaigns/:id/performance # Get performance metrics
GET    /api/ads/campaigns/:id/budget      # Get budget status
GET    /api/ads/campaigns/:id/leads       # Get leads from campaign
```

### Creative Management

```
POST   /api/ads/creatives                 # Create new creative
```

### Content Generation

```
POST   /api/ads/generate/headlines        # Generate headlines
POST   /api/ads/generate/copy             # Generate ad copy
POST   /api/ads/generate/ctas             # Generate CTAs
POST   /api/ads/generate/targeting        # Generate targeting criteria
POST   /api/ads/generate/image            # Generate ad image
GET    /api/ads/image-specs/:platform     # Get image specs for platform
```

### Optimization

```
POST   /api/ads/optimize/budgets          # Optimize campaign budgets
GET    /api/ads/optimize/recommendations/:campaignId # Get optimization recommendations
```

### Conversions & Leads

```
POST   /api/ads/conversions               # Track conversion
POST   /api/ads/leads                     # Add manual lead
PATCH  /api/ads/leads/:id                 # Update lead status
```

---

## Usage Examples

### Create an Ad Campaign

```javascript
POST /api/ads/campaigns
{
  "accountId": "account_123",
  "platform": "facebook",
  "campaignName": "Summer Sale Campaign",
  "objective": "conversion",
  "budget": 5000,
  "dailyBudget": 500,
  "startDate": "2024-06-01T00:00:00Z",
  "endDate": "2024-08-31T00:00:00Z",
  "targetAudience": "Women 25-45, interested in fashion",
  "ageMin": 25,
  "ageMax": 45,
  "gender": "female",
  "bidStrategy": "target_roas"
}
```

### Generate Ad Headlines

```javascript
POST /api/ads/generate/headlines
{
  "productName": "Premium Wireless Earbuds",
  "productDescription": "High-quality noise-cancelling earbuds with 30-hour battery",
  "platform": "facebook",
  "count": 5
}
```

### Generate Ad Copy

```javascript
POST /api/ads/generate/copy
{
  "productName": "Premium Wireless Earbuds",
  "productDescription": "High-quality noise-cancelling earbuds with 30-hour battery",
  "target": "Music lovers and professionals",
  "platform": "instagram",
  "count": 3
}
```

### Generate Targeting Criteria

```javascript
POST /api/ads/generate/targeting
{
  "productName": "Premium Wireless Earbuds",
  "productDescription": "High-quality noise-cancelling earbuds",
  "targetAudience": "Music professionals and audiophiles"
}
```

### Launch Campaign

```javascript
POST /api/ads/campaigns/campaign_123/launch
```

### Get Optimization Recommendations

```javascript
GET /api/ads/optimize/recommendations/campaign_123
```

### Track Conversion

```javascript
POST /api/ads/conversions
{
  "campaignId": "campaign_123",
  "accountId": "account_123",
  "platform": "facebook",
  "creativeId": "creative_456",
  "conversionType": "purchase",
  "conversionValue": 49.99,
  "userId": "user_789"
}
```

---

## Automation Features

### Automatic Budget Optimization
- Runs hourly
- Analyzes 7-day performance
- Adjusts budgets based on ROAS thresholds
- Logs all changes

### Automatic Creative Rotation
- Monitors creative performance
- Pauses underperforming creatives
- Reactivates high-potential creatives
- Tracks performance improvements

### Budget Rebalancing
- Allocates budget by performance
- Proportionally distributes to top performers
- Updates daily with new data
- Customizable rebalancing schedule

### Performance Monitoring
- Real-time metrics updates
- Daily performance summaries
- Automatic alerting for anomalies
- Historical trending analysis

---

## Configuration

Key environment variables for ad system:

```env
# Claude API for ad generation
CLAUDE_API_KEY=sk-...

# Auto-optimization settings
AD_AUTO_OPTIMIZE_ENABLED=true
AD_OPTIMIZATION_CHECK_INTERVAL=3600000 # 1 hour
AD_BUDGET_ADJUSTMENT_PERCENTAGE=15 # 15% increase/decrease
AD_PERFORMANCE_THRESHOLD_ROAS=2.5 # Scale if ROAS > 2.5

# Image generation
IMAGE_GENERATION_ENABLED=true
AD_IMAGE_TEMP_DIR=./temp/ad_images

# Lead tracking
LEAD_TRACKING_ENABLED=true
LEAD_AUTO_CAPTURE=true
```

---

## Best Practices

1. **Start with A/B Tests**: Test different creatives before scaling
2. **Use AI Generation**: Leverage Claude to generate multiple variations
3. **Monitor Daily**: Check performance metrics daily
4. **Enable Auto-Optimization**: Let the system optimize based on data
5. **Set Realistic Budgets**: Start small and scale winners
6. **Track Conversions**: Ensure conversion pixels are configured
7. **Rotate Creatives**: Don't let ads get stale
8. **Analyze Winners**: Study what works for future campaigns
9. **Test Audiences**: Different audiences respond differently
10. **Optimize Regularly**: Review optimization recommendations weekly

---

## Troubleshooting

### Campaigns Not Launching
- Ensure all required fields are filled
- Check account is connected and authenticated
- Verify platform API credentials are valid
- Check campaign status is "draft" before launching

### Low Performance Metrics
- Ensure tracking pixels are installed correctly
- Check conversion values are being tracked
- Verify audience targeting is appropriate
- Review ad creative quality and relevance

### AI Generation Errors
- Verify CLAUDE_API_KEY is set correctly
- Check API quota and usage
- Review error logs for specific issues
- Test with simpler prompts first

### Budget Optimization Not Working
- Ensure sufficient performance data (7+ days)
- Check auto-optimize is enabled in settings
- Verify campaign status is "active"
- Review optimization history for previous changes

---

## Support & Maintenance

- Monitor ad system logs: `logs/combined.log`
- Review optimization history in dashboard
- Schedule regular cleanup of temp image files
- Backup conversion tracking data weekly
- Update API credentials when they expire
