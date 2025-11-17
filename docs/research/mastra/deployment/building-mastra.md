# Building Mastra | Deployment

Learn how to build a Mastra server with build settings and deployment options.

Source: https://mastra.ai/docs/deployment/building-mastra

---

# Building Mastra

Mastra runs as a standard Node.js server and can be deployed across a wide range of environments. 

## Default project structure​

The [getting started guide](/docs/getting-started/installation)scaffolds a project with sensible defaults to help you begin quickly. By default, the CLI organizes application files under the `src/mastra/`directory, resulting in a structure similar to the following: 

```
src/└── mastra/    ├── agents/    ├── tools/    ├── workflows/    └── index.tspackage.jsontsconfig.json
```

## Building​

The `mastra build`command starts the build process: 

```
mastra build
```

### Customizing the input directory​

If your Mastra files are located elsewhere, use the `--dir`flag to specify the custom location. The `--dir`flag tells Mastra where to find your entry point file ( `index.ts`or `index.js`) and related directories. 

```
mastra build --dir ./my-project/mastra
```

## Build process​

The build process follows these steps: 

2. Locates entry file: Finds index.ts or index.js in your specified directory (default: src/mastra/).
4. Creates build directory: Generates a .mastra/ directory containing:

.build: Contains dependency analysis, bundled dependencies, and build configuration files.
output: Contains the production-ready application bundle with index.mjs, instrumentation.mjs, and project-specific files.
6. Copies static assets: Copies the public/ folder contents to the output directory for serving static files.
8. Bundles code: Uses Rollup with tree shaking and source maps for optimization.
10. Generates server: Creates a Hono HTTP server ready for deployment.

### Build output structure​

After building, Mastra creates a `.mastra/`directory with the following structure: 

```
.mastra/├── .build/└── output/
```

### public folder​

If a `public`folder exists in `src/mastra`, its contents are copied into the `.build/output`directory during the build process. 

## Running the Server​

Start the HTTP server: 

```
node .mastra/output/index.mjs
```

## Enable Telemetry​

To enable telemetry and observability, load the instrumentation file: 

```
node --import=./.mastra/output/instrumentation.mjs .mastra/output/index.mjs
```