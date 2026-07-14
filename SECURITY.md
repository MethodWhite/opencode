# Security Policy for MethodWhite/opencode fork

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| fork    | :white_check_mark: |

## Supply Chain

- **Dependencies**: Locked via `bun.lock` (reproducible installs)
- **Audit**: Run `bun audit` before each release
- **SBOM**: Generated via `cyclonedx-bom` or `bun run sbom`
- **Gitleaks**: Pre-commit hook for secret scanning

## Known Risk Acceptance

The following vulnerabilities are in transitive dependencies and accepted:

| Severity | Package | Reason |
|----------|---------|--------|
| Critical | fast-xml-parser | Via AWS SDK (@aws-sdk/*). Update blocked by SST/AWS SDK compatibility. |
| High | Undici WS | Via AWS SDK internal HTTP client. |
| High | Hono JWT | Auth system to be replaced by ztf (Rust PQC) in future release. |
| High | minimatch ReDoS | CLI-only, low blast radius. |

## Reporting

Report vulnerabilities to methodwhite@proton.me
