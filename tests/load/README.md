# RV Trax Load Tests

Load and stress testing suite for the RV Trax API, built with [k6](https://k6.io/).

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux (Debian / Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Test Profiles

| Script         | VUs | Duration | Purpose                                   |
| -------------- | --- | -------- | ----------------------------------------- |
| `smoke.js`     | 1   | 30s      | Quick sanity check; verify endpoints work |
| `load.js`      | 50  | ~8min    | Normal traffic; p95 < 500ms, errors < 1%  |
| `stress.js`    | 200 | ~15min   | High load + writes; find breaking points  |
| `spike.js`     | 500 | ~4min    | Sudden surge; verify recovery             |
| `websocket.js` | 100 | ~4min    | WebSocket connection concurrency          |

## Running Tests

Make sure the API is running before executing any test.

```bash
# Start the API (from repo root)
pnpm dev

# Quick smoke test
k6 run tests/load/smoke.js

# Normal load test
k6 run tests/load/load.js

# Stress test
k6 run tests/load/stress.js

# Spike test
k6 run tests/load/spike.js

# WebSocket load test
k6 run tests/load/websocket.js
```

### Environment Variables

Override defaults by setting environment variables:

```bash
k6 run -e K6_API_URL=https://staging.rvtrax.com \
       -e K6_API_EMAIL=tester@example.com \
       -e K6_API_PASSWORD=s3cret \
       tests/load/load.js
```

| Variable          | Default                 | Description        |
| ----------------- | ----------------------- | ------------------ |
| `K6_API_URL`      | `http://localhost:3000` | API base URL       |
| `K6_API_EMAIL`    | `admin@demo.rvtrax.com` | Test user email    |
| `K6_API_PASSWORD` | `password`              | Test user password |

### Docker

```bash
docker run --rm -i --network=host \
  -v $(pwd)/tests/load:/scripts \
  grafana/k6 run /scripts/smoke.js
```

## Interpreting Results

k6 prints a summary after each run. Key metrics to watch:

- **http_req_duration** -- Response time distribution. Look at p95 and p99.
- **http_req_failed** -- Percentage of non-2xx responses.
- **http_reqs** -- Total throughput (requests per second).
- **iteration_duration** -- Total time for one complete VU iteration.
- **ws_connect_errors** / **ws_auth_errors** -- WebSocket-specific failure counts.

### Passing Thresholds

Each test defines thresholds in its `options.thresholds` block. If any threshold
is violated, k6 exits with a non-zero code -- useful for CI gates.

```
     ✓ http_req_duration..............: avg=120ms  p(95)=340ms  p(99)=890ms
     ✓ http_req_failed................: 0.12%   ✓ 3       ✗ 2497
     ✓ http_reqs......................: 2500    156.25/s
```

A check mark means the threshold passed. An X means it failed.

## CI Integration

Add a load test step to your CI pipeline. Example for GitHub Actions:

```yaml
load-test:
  runs-on: ubuntu-latest
  needs: [build]
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_DB: rvtrax_test
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
      ports: ['5432:5432']
    redis:
      image: redis:7
      ports: ['6379:6379']
  steps:
    - uses: actions/checkout@v4

    - name: Setup k6
      uses: grafana/setup-k6-action@v1

    - name: Start API
      run: |
        pnpm install
        pnpm db:migrate
        pnpm db:seed
        pnpm --filter api start &
        sleep 5

    - name: Run smoke test
      run: k6 run tests/load/smoke.js

    - name: Run load test
      run: k6 run tests/load/load.js
```

For staging / production runs, use [Grafana Cloud k6](https://grafana.com/products/cloud/k6/)
to get historical dashboards and alerting:

```bash
K6_CLOUD_TOKEN=<token> k6 cloud tests/load/load.js
```

## File Structure

```
tests/load/
  k6-config.js   - Base URL, credentials, shared thresholds
  helpers.js      - Auth helpers, reusable HTTP request wrappers
  smoke.js        - 1 VU / 30s sanity check
  load.js         - 50 VUs / 5min normal traffic
  stress.js       - 200 VUs / 10min with write operations
  spike.js        - 0->500->0 VUs sudden surge
  websocket.js    - 100 concurrent WebSocket connections
  README.md       - This file
```
