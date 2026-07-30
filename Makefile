NODE20_BIN ?= $(HOME)/.nvm/versions/node/v20.20.2/bin
OWNER_DEVICE ?= chrome
CANONICAL_LOCAL ?= ./start-vethelp.sh

.PHONY: local-dev local-dev-down owner-web-e2e owner-integration-test local-stack-e2e local-up local-down local-status local-logs local-seed local-smoke local-test clinic-portal-session

local-dev:
	$(CANONICAL_LOCAL) up

local-dev-down:
	$(CANONICAL_LOCAL) stop

owner-web-e2e:
	PATH="$(NODE20_BIN):$$PATH" node dev/local/owner-mobile-web-e2e.mjs

owner-integration-test:
	PATH="$(NODE20_BIN):$$PATH" node dev/local/run-owner-integration-test.mjs

local-up:
	$(CANONICAL_LOCAL) up

local-down:
	$(CANONICAL_LOCAL) stop

local-status:
	$(CANONICAL_LOCAL) status

local-logs:
	$(CANONICAL_LOCAL) logs

local-seed:
	$(CANONICAL_LOCAL) seed all

local-smoke:
	$(CANONICAL_LOCAL) smoke

local-stack-e2e:
	cd apps/clinic-portal && PATH="$(NODE20_BIN):$$PATH" npm run e2e:local-stack

clinic-portal-session:
	PATH="$(NODE20_BIN):$$PATH" node dev/local/clinic-portal-session.mjs

local-test:
	$(MAKE) local-seed
	$(MAKE) local-smoke
	cd apps/clinic-portal && PATH="$(NODE20_BIN):$$PATH" npm run typecheck
	cd apps/clinic-portal && PATH="$(NODE20_BIN):$$PATH" npm run e2e
	cd apps/owner_mobile && "$(HOME)/develop/flutter-3.27.4/bin/flutter" analyze
	cd apps/owner_mobile && "$(HOME)/develop/flutter-3.27.4/bin/flutter" test
	cd apps/owner_mobile && "$(HOME)/develop/flutter-3.27.4/bin/flutter" build web -t lib/owner_journey_main.dart
