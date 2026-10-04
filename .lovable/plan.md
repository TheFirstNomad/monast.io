# Make the uploaded Monast logo official

## Brand rollout
- Add the uploaded blue Monast emblem as the single reusable app logo asset.
- Create a small shared brand component so the emblem and “Monast” name stay aligned and consistently sized.
- Replace the text-only branding in the desktop/mobile header, footer, and sign-in screen with the official logo and name.
- Use the emblem alone where space is limited, including the app loading state.

## Browser identity
- Replace the current placeholder “M” browser icon with a properly sized square favicon derived from the uploaded logo.
- Keep the existing page titles and descriptions unchanged.
- Do not use the 128px upload as the large social-sharing image because it is too small for a sharp 1200×630 preview.

## Quality checks
- Preserve the existing navigation, authentication, marketplace, wallet, and escrow behavior.
- Check the logo against the app’s dark surfaces at desktop and mobile sizes, including image clarity, spacing, and accessible text.
- Confirm the production build succeeds and the key pages render without errors.

## Technical details
- Store the in-app image through the project’s managed asset delivery and reference it from one reusable React component.
- Keep the favicon as an optimized real file in `public/`, as browsers require.
