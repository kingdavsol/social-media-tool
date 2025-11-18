# Social Media Marketing Automation - Deployment Guide

## Production Deployment to master.traffic2umarketing.com

### Prerequisites
- VPS with Ubuntu 20.04 or higher (recommended: 4GB RAM, 2 CPU cores)
- Domain: master.traffic2umarketing.com
- Node.js 18+
- Nginx reverse proxy
- SSL/TLS certificate (Let's Encrypt)
- Process manager (PM2 or systemd)

### Step 1: VPS Setup

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Nginx
sudo apt-get install -y nginx

# Install FFmpeg (for video processing)
sudo apt-get install -y ffmpeg

# Install PM2 (process manager)
sudo npm install -g pm2

# Install certbot for SSL
sudo apt-get install -y certbot python3-certbot-nginx
```

### Step 2: Application Setup

```bash
# Create application directory
sudo mkdir -p /opt/social-media-automation
cd /opt/social-media-automation

# Clone repository (or download files)
git clone <your-repo-url> .
# OR
# scp -r /home/user/Traffic2umarketing/* root@your-vps:/opt/social-media-automation/

# Install dependencies
npm install --production

# Copy and configure environment file
cp .env.example .env

# Edit .env with production settings
sudo nano .env
```

### Step 3: Configure Environment Variables

Edit `.env` with your production settings:

```env
NODE_ENV=production
PORT=3000
APP_URL=https://master.traffic2umarketing.com

# Database
DATABASE_PATH=/opt/social-media-automation/db.sqlite

# Security
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<STRONG_PASSWORD>
ENCRYPTION_KEY=<GENERATE_32_CHAR_KEY>
JWT_SECRET=<GENERATE_RANDOM_SECRET>

# API Keys
FACEBOOK_APP_ID=<YOUR_FACEBOOK_APP_ID>
FACEBOOK_APP_SECRET=<YOUR_SECRET>
YOUTUBE_API_KEY=<YOUR_API_KEY>
TIKTOK_CLIENT_KEY=<YOUR_KEY>
TIKTOK_CLIENT_SECRET=<YOUR_SECRET>
CLAUDE_API_KEY=<YOUR_CLAUDE_API_KEY>
VEED_API_KEY=<YOUR_VEED_API_KEY>

# Logging
LOG_LEVEL=info
LOG_DIR=/opt/social-media-automation/logs

# Redis (optional, for Bull queue)
REDIS_URL=redis://localhost:6379

# Set proper permissions
chmod 600 .env
```

### Step 4: Initialize Database

```bash
# Create logs directory
mkdir -p logs

# Initialize database
npm run db:init

# Set permissions
sudo chown -R www-data:www-data /opt/social-media-automation
sudo chmod -R 755 /opt/social-media-automation
sudo chmod -R 775 /opt/social-media-automation/logs
sudo chmod -R 775 /opt/social-media-automation/db.sqlite
```

### Step 5: Configure Nginx

Create `/etc/nginx/sites-available/social-media-automation`:

```nginx
server {
    listen 80;
    server_name master.traffic2umarketing.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name master.traffic2umarketing.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/master.traffic2umarketing.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/master.traffic2umarketing.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/social-media-automation.access.log;
    error_log /var/log/nginx/social-media-automation.error.log;

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;

        # Timeouts for long-running requests (video processing)
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # Increase body size for file uploads
    client_max_body_size 500M;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
    gzip_min_length 1000;
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/social-media-automation /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

### Step 6: SSL Certificate

```bash
# Generate SSL certificate
sudo certbot certonly --nginx -d master.traffic2umarketing.com

# Auto-renew certificates
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Step 7: Configure PM2

```bash
# Create ecosystem.config.js in application directory
cat > /opt/social-media-automation/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'social-media-automation',
      script: './server.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'db.sqlite', '.env'],
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
EOF

# Start application with PM2
cd /opt/social-media-automation
pm2 start ecosystem.config.js

# Save PM2 config for startup
pm2 save
pm2 startup

# View logs
pm2 logs
```

### Step 8: Firewall Configuration

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Step 9: Backup Configuration

Create `/opt/social-media-automation/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backups/social-media-automation"
DATE=$(date +%Y%m%d_%H%M%S)
DB_FILE="/opt/social-media-automation/db.sqlite"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
cp $DB_FILE $BACKUP_DIR/db_$DATE.sqlite

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sqlite"
```

Schedule daily backups with cron:

```bash
# Add to crontab
sudo crontab -e

# Add line:
# 0 2 * * * /opt/social-media-automation/backup.sh
```

### Step 10: Monitoring

Install monitoring tools:

```bash
# Install Node exporter for Prometheus
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
tar xvfz node_exporter-1.6.1.linux-amd64.tar.gz
sudo mv node_exporter-1.6.1.linux-amd64/node_exporter /usr/local/bin/

# Create systemd service for node_exporter
sudo tee /etc/systemd/system/node_exporter.service > /dev/null << EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
User=nobody
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl start node_exporter
sudo systemctl enable node_exporter
```

### Step 11: Verification

```bash
# Test application
curl -I https://master.traffic2umarketing.com/health

# Check application status
pm2 status

# Monitor logs
pm2 logs social-media-automation
```

### Production Checklist

- [ ] Domain configured and DNS pointing to VPS
- [ ] SSL certificate installed and auto-renewing
- [ ] Environment variables set securely
- [ ] Database initialized and permissions correct
- [ ] Nginx reverse proxy configured
- [ ] PM2 managing Node.js process
- [ ] Firewall rules configured
- [ ] Backups scheduled
- [ ] Monitoring tools installed
- [ ] Admin credentials changed from defaults
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Error logging configured

### Scaling Considerations

1. **Database**: Consider migrating to PostgreSQL for better performance at scale
2. **Redis**: Use for caching and job queue instead of in-memory
3. **Load Balancing**: Use multiple servers behind a load balancer
4. **CDN**: Use CloudFront or Cloudflare for static assets
5. **Separate Services**: Move scheduler and job processors to dedicated servers

### Security Hardening

- [ ] Keep Node.js and dependencies updated
- [ ] Use strong passwords for admin accounts
- [ ] Enable HTTPS only
- [ ] Configure rate limiting per IP
- [ ] Regular security audits
- [ ] Use WAF (Web Application Firewall)
- [ ] Enable 2FA for admin access
- [ ] Regular database backups
- [ ] Monitor suspicious activity

### Support and Maintenance

- Monitor PM2 logs regularly
- Keep dependencies updated: `npm update`
- Monitor disk space for database and logs
- Review analytics and engagement metrics
- Update API keys and tokens as needed
- Test backup restoration monthly
