# Acquiring integration

Runtime configuration is supplied through the deployment environment:

- `ACQUIRING_API_BASE_URL`
- `ACQUIRING_API_KEY`
- `ACQUIRING_WEBHOOK_SECRET`

The API key is sent as a Bearer token by `AcquiringClient`. Keep all three values outside the repository and provide them only through the runtime secret manager.
