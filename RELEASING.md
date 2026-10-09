# Releasing

Releases are published to npm by the [Publish workflow](.github/workflows/publish.yml) when a version tag is pushed. It uses npm trusted publishing (OIDC), so there is no npm token in the repository, and npm adds a provenance attestation automatically.

## Release a version

```bash
npm version 1.2.3 --no-git-tag-version   # updates package.json and package-lock.json
git commit -am "Release 1.2.3"
git push origin main
git tag v1.2.3
git push origin v1.2.3
```

The workflow fails before publishing if the tag does not match the `package.json` version, and skips publishing if that version is already on npm. It runs in the `npm` GitHub environment, so a release waits for approval if that environment has required reviewers.

## One-time setup

1. On npmjs.com, open **@qrxcodes/mcp → Settings → Trusted publishing** and add a **GitHub Actions** publisher:
   - Organization or user: `qrxcodes`
   - Repository: `mcp`
   - Workflow filename: `publish.yml`
   - Environment name: `npm`
   - Allowed actions: tick **npm publish**

   A new trusted publisher expires unless it publishes successfully within 2 days, so push the release tag soon after adding it.
2. Optional: in **Settings → Publishing access**, choose **Require two-factor authentication and disallow tokens**. Trusted publishing keeps working.
3. Optional: in the GitHub repository's **Settings → Environments → npm**, add required reviewers to approve each release.
