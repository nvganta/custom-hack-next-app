# ContentPilot Deployment Guide

## Prerequisites

Before deploying to Vercel, ensure you have:

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Environment Variables**: Gather all required API keys and credentials

## Required Environment Variables

Set these environment variables in your Vercel dashboard:

### Core Application
```
DATABASE_URL=your_mongodb_connection_string
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
```

### Authentication (Better Auth)
```
BETTER_AUTH_SECRET=your_auth_secret_key
BETTER_AUTH_URL=https://your-app.vercel.app
```

### AI Services
```
GROQ_API_KEY=your_groq_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key
```

### Email Service (Resend)
```
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@your-domain.com
```

## Deployment Steps

### 1. Prepare Your Repository

1. Ensure all changes are committed and pushed to GitHub
2. Verify the `vercel.json` configuration file is present
3. Check that all environment variables are documented

### 2. Deploy to Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 3. Configure Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add each environment variable listed above
3. Set the environment for each variable (Production, Preview, Development)

### 4. Configure Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Update `NEXT_PUBLIC_BASE_URL` and `BETTER_AUTH_URL` to use your custom domain

### 5. Deploy

1. Click **Deploy** or push changes to trigger automatic deployment
2. Monitor the deployment logs for any errors
3. Test the deployed application

## Post-Deployment Configuration

### 1. Database Setup

Ensure your MongoDB database is accessible from Vercel:
- Whitelist Vercel's IP ranges in your MongoDB Atlas network settings
- Or use `0.0.0.0/0` for all IPs (less secure but simpler)

### 2. Update Integration Details

After deployment, update your central agent (Maya) with the new production URLs:

1. Go to your deployed app's **Settings** page
2. Navigate to **Central Agent Integration**
3. Copy the production URLs and API key
4. Update Maya's configuration with these new details

### 3. Test Integration

1. Generate a new API key in production
2. Test the `/api/contentpilot/agent` endpoint
3. Verify email notifications work
4. Test the intelligence gathering process

## Environment-Specific Configuration

### Development
```
NEXT_PUBLIC_BASE_URL=http://localhost:3001
BETTER_AUTH_URL=http://localhost:3001
```

### Production
```
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
BETTER_AUTH_URL=https://your-app.vercel.app
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check TypeScript errors in build logs
   - Ensure all dependencies are properly installed
   - Verify environment variables are set

2. **Database Connection Issues**
   - Verify MongoDB connection string
   - Check network access settings
   - Ensure database user has proper permissions

3. **API Timeouts**
   - Intelligence gathering may take time
   - Vercel functions have timeout limits
   - Check `vercel.json` for function timeout settings

4. **Environment Variable Issues**
   - Ensure all variables are set in Vercel dashboard
   - Check variable names match exactly
   - Redeploy after adding new variables

### Performance Optimization

1. **Function Timeouts**: Already configured in `vercel.json`
2. **Edge Runtime**: Consider using Edge Runtime for faster cold starts
3. **Caching**: Implement proper caching strategies for API responses

## Monitoring

After deployment, monitor:

1. **Vercel Analytics**: Track performance and usage
2. **Function Logs**: Monitor API endpoint performance
3. **Error Tracking**: Set up error monitoring (Sentry, etc.)
4. **Database Performance**: Monitor MongoDB Atlas metrics

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **CORS**: Configure proper CORS settings for production
3. **Rate Limiting**: Implement rate limiting for API endpoints
4. **Authentication**: Ensure proper authentication is enforced

## Scaling Considerations

1. **Database**: MongoDB Atlas auto-scaling
2. **Vercel Functions**: Automatic scaling based on demand
3. **Email Service**: Resend has generous limits
4. **AI Services**: Monitor Groq and Firecrawl usage

## Support

For deployment issues:
- Check Vercel documentation
- Review build logs carefully
- Test locally before deploying
- Use Vercel's preview deployments for testing

## Central Agent Integration

After successful deployment, provide these details to Maya:

- **Agent Name**: ContentPilot
- **API Endpoint**: `https://your-app.vercel.app/api/contentpilot/agent`
- **Health Check**: `https://your-app.vercel.app/api/contentpilot/agent`
- **API Key**: Generated from the production Settings page
- **Capabilities**: Listed in the Settings integration section 