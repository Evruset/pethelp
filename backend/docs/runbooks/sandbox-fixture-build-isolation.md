# Sandbox fixture build isolation

`SandboxOnlyGuard` returns `404` outside `NODE_ENV=sandbox-cert`, and the controller is excluded from OpenAPI. This is the mandatory runtime boundary.

For a hardened production artifact, build a separate production entrypoint that does **not** import `SandboxFixturesModule`, then exclude all sandbox fixture source files from the production TypeScript project:

```json
// tsconfig.prod.json
{
  "extends": "./tsconfig.build.json",
  "exclude": [
    "test/**/*.ts",
    "src/sandbox-fixtures/**/*.ts",
    "dist",
    "node_modules"
  ]
}
```

```dockerfile
# Dockerfile.prod (build stage excerpt)
COPY . .
RUN npm run build:prod
```

```json
// package.json
{
  "scripts": {
    "build:prod": "tsc -p tsconfig.prod.json"
  }
}
```

Do not simply exclude sandbox controller files while retaining a static `SandboxFixturesModule` import in the production root module: Node would then fail at boot because the compiled module is absent. The separate production entrypoint must omit the import itself. The normal sandbox image retains the module and requires both `NODE_ENV=sandbox-cert` and `VETHELP_SANDBOX_CERT_ENABLED=true`.
