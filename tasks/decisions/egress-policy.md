# Provider egress policy

Date: 2026-09-16

## Configuration boundary

- An administrator may save only an explicit HTTPS origin from `MODEL_ALLOWED_ORIGINS_JSON`.
- URLs cannot contain credentials, query strings or fragments. Literal IP addresses and local/internal hostnames are rejected.
- Adapter `extraBody` is currently a strict empty object. Provider-specific fields will be added only as named, validated capability fields.

## Runtime boundary

- Each request and redirect hop resolves DNS independently. The request fails closed if any returned address is private, loopback, link-local, carrier-grade NAT, documentation/non-routable, multicast or IPv4-mapped private space.
- The HTTPS socket connects to one checked address while TLS certificate verification and SNI use the configured hostname. This prevents a second implicit resolver lookup from bypassing the check.
- Redirects are manual and bounded. Every target must be allowlisted and re-resolved. Requests carrying authorization cannot cross origins. POST follows only 307/308 so a redirect cannot silently convert it into GET or replay it with changed semantics.
- Only `Accept`, `Authorization`, `Content-Type`, `Idempotency-Key` and `User-Agent` are accepted from an adapter. Host, cookie, forwarding and proxy headers cannot be supplied.
- Time, redirect count and response bytes are bounded. Public errors do not include credentials, resolved IP addresses or internal URLs.

## Integration status

The transport uses a dedicated HTTPS Agent whose connection method dials the vetted address with the original hostname for TLS verification; `agent:false` was removed because it could bypass the request-level connection override. DNS lookup has a bounded wait, and a wall-clock timer bounds each request hop. Controlled tests cover mixed DNS answers, mapped loopback addresses, rebinding across redirects, socket pinning and stalled DNS.

2026-09-26 review: the address table previously allowed `240.0.0.0/4` despite its [IANA reserved classification](https://www.iana.org/assignments/iana-ipv4-special-registry). It now rejects that range and the [IANA IPv6 translation/transition prefixes](https://www.iana.org/assignments/iana-ipv6-special-registry) `64:ff9b::/96`, `64:ff9b:1::/48`, `2001::/32` and `2002::/16`, which can encode or relay an IPv4 destination. The regression test first reproduced acceptance of `240.0.0.1`; after the fix it rejects reserved, translated and mixed DNS answers. Full regression: 290 unit, 83 PostgreSQL/object-storage integration tests, typecheck, lint, build and protected-folder check passed. This is local controlled evidence; no claim of production network-policy validation.

The MiniMax-H3 submit/query adapter uses an exact supplier origin and no redirects. Result downloads use a separate exact HTTPS-origin allowlist, a bounded GET with at most two validated redirects, media decoding and private object storage. First-frame data comes from an already verified private project image and is sent only in the paid submit path. Full result-download runtime tests and deployment-level egress controls still need evidence; T29 remains open.

2026-09-26 local runtime check: the production `safeRequest` transport performed one authenticated, read-only `GET /v1/models` to `https://api.tu-zi.com` and received HTTP 200 with MiniMax-H3 visible. The result origin observed for the single previously authorized video passed the public-address resolver (three IPv4 addresses), and a pinned-address TLS handshake with the original SNI verified successfully (TLS 1.3). No video bytes or paid operation were requested. This validates the local outbound path, not the target deployment firewall or every future result origin; see [runtime report](../reports/p2-p3-archive-2026-10-07.md#archived-f84de0699c8fb3aa).
