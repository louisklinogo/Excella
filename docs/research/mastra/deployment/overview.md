# Deployment Overview | Deployment

Learn about different deployment options for your Mastra applications

Source: https://mastra.ai/docs/deployment/overview

---

# Deployment Overview

Mastra offers multiple deployment options to suit your application's needs, from fully-managed solutions to self-hosted options, and web framework integrations. This guide will help you understand the available deployment paths and choose the right one for your project. 

## Choosing a Deployment Option​

OptionBest ForKey BenefitsMastra CloudTeams wanting to ship quickly without infrastructure concernsFully-managed, automatic scaling, built-in observabilityFramework DeploymentTeams already using Next.js, Astro etcSimplify deployment with a unified codebase for frontend and backendServer DeploymentTeams needing maximum control and customizationFull control, custom middleware, integrate with existing appsServerless PlatformsTeams already using Vercel, Netlify, or CloudflarePlatform integration, simplified deployment, automatic scaling

## Deployment Options​

### Runtime support​

- Node.js v20.0 or higher
- Bun
- Deno
- Cloudflare

### Mastra Cloud​

Mastra Cloud is a deployment platform that connects to your GitHub repository, automatically deploys on code changes, and provides monitoring tools. It includes: 

- GitHub repository integration
- Deployment on git push
- Agent testing interface
- Comprehensive logs and traces
- Custom domains for each project

[View Mastra Cloud documentation →](/docs/deployment/mastra-cloud/overview)

### With a Web Framework​

Mastra can be integrated with a variety of web frameworks. For example, see one of the following for a detailed guide. 

- With Next.js
- With Astro

When integrated with a framework, Mastra typically requires no additional configuration for deployment. 

[View Web Framework Integration →](/docs/deployment/web-framework)

### With a Server​

You can deploy Mastra as a standard Node.js HTTP server, which gives you full control over your infrastructure and deployment environment. 

- Custom API routes and middleware
- Configurable CORS and authentication
- Deploy to VMs, containers, or PaaS platforms
- Ideal for integrating with existing Node.js applications

[Building Mastra →](/docs/deployment/building-mastra)

### Serverless Platforms​

Mastra provides platform-specific deployers for popular serverless platforms, enabling you to deploy your application with minimal configuration. 

- Deploy to Cloudflare Workers, Vercel, or Netlify
- Platform-specific optimizations
- Simplified deployment process
- Automatic scaling through the platform

[Building Mastra →](/docs/deployment/building-mastra)

## Client Configuration​

Once your Mastra application is deployed, you'll need to configure your client to communicate with it. The Mastra Client SDK provides a simple and type-safe interface for interacting with your Mastra server. 

- Type-safe API interactions
- Authentication and request handling
- Retries and error handling
- Support for streaming responses

[Client configuration guide →](/docs/server-db/mastra-client)