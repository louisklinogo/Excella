# Integrate Mastra in your Next.js project | Frameworks

A step-by-step guide to integrating Mastra with Next.js.

Source: https://mastra.ai/docs/frameworks/web-frameworks/next-js

---

# Integrate Mastra in your Next.js project

Mastra integrates with Next.js, making it easy to: 

- Build flexible APIs to serve AI-powered features
- Simplify deployment with a unified codebase for frontend and backend
- Take advantage of Next.js's built-in server actions (App Router) or API Routes (Pages Router) for efficient server-client workflows

Use this guide to scaffold and integrate Mastra with your Next.js project. 

- App Router
- Pages Router

warning This guide assumes you're using the Next.js App Router at the root of your project, e.g., `app`rather than `src/app`. 

1. To integrate Mastra into your project, you have two options:

Use the One-Liner
Run the following command to quickly scaffold the default Weather agent with sensible defaults:
npx mastra@latest init --dir . --components agents,tools --example --llm openai

See mastra init for more information.

Use the Interactive CLI
If you prefer to customize the setup, run the init command and choose from the options when prompted:
npx mastra@latest init
warningBy default, mastra init suggests src as the install location. If you're using the App Router at the root of your project (e.g., app, not src/app), enter . when prompted:
2. Set Up API Key.envOPENAI_API_KEY=<your-api-key>
Each LLM provider uses a different env var. See Model Capabilities for more information.
3. Add to your next.config.ts:next.config.tsimport type { NextConfig } from "next";const nextConfig: NextConfig = {  serverExternalPackages: ["@mastra/*"],};export default nextConfig;
4. You can start your Next.js app in the usual way.
5. Create a new directory that will contain a Page, Action, and Form for testing purposes.mkdir app/test
6. Create a new Action, and add the example code:touch app/test/action.tsapp/test/action.ts"use server";import { mastra } from "../../mastra";export async function getWeatherInfo(formData: FormData) {  const city = formData.get("city")?.toString();  const agent = mastra.getAgent("weatherAgent");  const result = await agent.generate(`What's the weather like in ${city}?`);  return result.text;}
7. Create a new Form component, and add the example code:touch app/test/form.tsxapp/test/form.tsx"use client";import { useState } from "react";import { getWeatherInfo } from "./action";export function Form() {  const [result, setResult] = useState<string | null>(null);  async function handleSubmit(formData: FormData) {    const res = await getWeatherInfo(formData);    setResult(res);  }  return (    <>      <form action={handleSubmit}>        <input name="city" placeholder="Enter city" required />        <button type="submit">Get Weather</button>      </form>      {result && <pre>{result}</pre>}    </>  );}
8. Create a new Page, and add the example code:touch app/test/page.tsxapp/test/page.tsximport { Form } from "./form";export default async function Page() {  return (    <>      <h1>Test</h1>      <Form />    </>  );}
You can now navigate to /test in your browser to try it out.
Submitting London as the city would return a result similar to:Agent response: The current weather in London is as follows:- **Temperature:** 12.9°C (Feels like 9.7°C)- **Humidity:** 63%- **Wind Speed:** 14.7 km/h- **Wind Gusts:** 32.4 km/h- **Conditions:** OvercastLet me know if you need more information!

warning This guide assumes you're using the Next.js Pages Router at the root of your project, e.g., `pages`rather than `src/pages`. 

1. To integrate Mastra into your project, you have two options:

Use the One-Liner
Run the following command to quickly scaffold the default Weather agent with sensible defaults:
npx mastra@latest init --dir . --components agents,tools --example --llm openai

See mastra init for more information.

Use the Interactive CLI
If you prefer to customize the setup, run the init command and choose from the options when prompted:
npx mastra@latest init
warningBy default, mastra init suggests src as the install location. If you're using the Pages Router at the root of your project (e.g., pages, not src/pages), enter . when prompted:
2. Set Up API Key.envOPENAI_API_KEY=<your-api-key>
Each LLM provider uses a different env var. See Model Capabilities for more information.
3. Add to your next.config.ts:next.config.tsimport type { NextConfig } from "next";const nextConfig: NextConfig = {  serverExternalPackages: ["@mastra/*"],};export default nextConfig;
4. You can start your Next.js app in the usual way.
5. Create a new API Route, and add the example code:touch pages/api/test.tspages/api/test.tsimport type { NextApiRequest, NextApiResponse } from "next";import { mastra } from "../../mastra";export default async function getWeatherInfo(  req: NextApiRequest,  res: NextApiResponse,) {  const city = req.body.city;  const agent = mastra.getAgent("weatherAgent");  const result = await agent.generate(`What's the weather like in ${city}?`);  return res.status(200).json(result.text);}
6. Create a new Page, and add the example code:touch pages/test.tsxpages/test.tsximport { useState } from "react";export default function Test() {  const [result, setResult] = useState<string | null>(null);  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {    event.preventDefault();    const formData = new FormData(event.currentTarget);    const city = formData.get("city")?.toString();    const response = await fetch("/api/test", {      method: "POST",      headers: { "Content-Type": "application/json" },      body: JSON.stringify({ city })    });    const text = await response.json();    setResult(text);  }  return (    <>      <h1>Test</h1>      <form onSubmit={handleSubmit}>        <input name="city" placeholder="Enter city" required />        <button type="submit">Get Weather</button>      </form>      {result && <pre>{result}</pre>}    </>  );}
You can now navigate to /test in your browser to try it out.
Submitting London as the city would return a result similar to:Agent response: The current weather in London is as follows:- **Temperature:** 12.9°C (Feels like 9.7°C)- **Humidity:** 63%- **Wind Speed:** 14.7 km/h- **Wind Gusts:** 32.4 km/h- **Conditions:** OvercastLet me know if you need more information!

## Next Steps​

- Deployment | With Next.js on Vercel
- Monorepo Deployment