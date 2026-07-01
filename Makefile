LOCAL_PROJECT ?= vethelp-alpha
NODE20_BIN ?= $(HOME)/.nvm/versions/node/v20.20.2/bin
COMPOSE ?= docker compose -p $(LOCAL_PROJECT) -f docker-compose.local.yml
OWNER_DEVICE ?= chrome

.PHONY: local-dev local-dev-down owner-web-e2e owner-integration-test local-stack-e2e local-up local-down local-status local-logs local-seed local-smoke local-test clinic-portal-session

local-dev:
	dev/local/up.sh

local-dev-down:
	dev/local/down.sh

owner-web-e2e:
	PATH="$(NODE20_BIN):$$PATH" node dev/local/owner-mobile-web-e2e.mjs

owner-integration-test:
	PATH="$(NODE20_BIN):$$PATH" node dev/local/run-owner-integration-test.mjs

local-stack-e2e:
	PATH="$(NODE20_BIN):$$PATH" node dev/local/local-stack-e2e.mjs

local-up:
	$(COMPOSE) up -d --build

local-down:
	$(COMPOSE) down

local-status:
	$(COMPOSE) ps

local-logs:
	$(COMPOSE) logs -f

local-seed:
	$(COMPOSE) --profile setup run --rm seed
	$(COMPOSE) exec -T backend npx ts-node /workspace/backend/scripts/seed-local-identities.ts
	$(COMPOSE) exec -T backend npx ts-node /workspace/backend/scripts/seed-local-owner-marketplace.ts
	$(COMPOSE) exec -T backend npx ts-node /workspace/backend/scripts/seed-local-clinic-employee.ts
	$(COMPOSE) exec -T backend npx ts-node /workspace/backend/scripts/seed-local-clinic-queue.ts

local-smoke:
	backend/scripts/smoke-local-journey.sh

clinic-portal-session:
	PATH="$(NODE20_BIN):$$PATH" node dev/local/clinic-portal-session.mjs

local-test:
	$(COMPOSE) exec -T backend sh -lc "npm run check"
	$(COMPOSE) restart backend
	until curl -fsS http://127.0.0.1:3000/v1/health >/dev/null; do sleep 1; done
	$(MAKE) local-seed
	$(MAKE) local-smoke
	cd apps/clinic-portal && PATH="$(NODE20_BIN):$$PATH" npm run typecheck
	cd apps/clinic-portal && PATH="$(NODE20_BIN):$$PATH" npm run e2e
	cd apps/owner_mobile && "$(HOME)/develop/flutter-3.27.4/bin/flutter" analyze
	cd apps/owner_mobile && "$(HOME)/develop/flutter-3.27.4/bin/flutter" test
	cd apps/owner_mobile && "$(HOME)/develop/flutter-3.27.4/bin/flutter" build web -t lib/owner_journey_main.dart
