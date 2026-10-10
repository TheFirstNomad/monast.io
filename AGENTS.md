# Project Architecture Rules

- Render official Monast branding through the shared `BrandLogo` component so logo assets, sizing, and accessible labels remain consistent.
- Keep shared-link defaults in `siteMetadata`, with navigation fallbacks applied before page-specific SEO; mirror defaults in the static HTML head because social crawlers do not execute the app.
