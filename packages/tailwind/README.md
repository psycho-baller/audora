# @audora/tailwind-config

Shared TailwindCSS configuration package for the Audora monorepo.

## Purpose

This package provides a centralized TailwindCSS theme and PostCSS configuration that can be shared across both web and Expo (React Native) applications.

## Structure

- `theme.css` - Shared design tokens including colors, shadows, spacing, and typography
- `postcss-config.js` - PostCSS configuration with TailwindCSS plugin

## Usage

### In Web Apps (React Router/Vite)

1. Add the package to your dependencies:
```json
{
  "dependencies": {
    "@audora/tailwind-config": "workspace:*"
  }
}
```

2. Create a `postcss.config.js` in your app root:
```js
export { default } from "@audora/tailwind-config/postcss-config";
```

3. Import the theme in your CSS file:
```css
@import "tailwindcss";
@import "@audora/tailwind-config/theme";
```

### In Expo Apps (React Native)

1. Add the package to your dependencies:
```json
{
  "dependencies": {
    "@audora/tailwind-config": "workspace:*"
  }
}
```

2. Create a `postcss.config.js` in your app root:
```js
export { default } from "@audora/tailwind-config/postcss-config";
```

3. Import the theme in your `global.css`:
```css
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";
@import "@audora/tailwind-config/theme";

@import "nativewind/theme";
```

## Design Tokens

The theme includes:

- **Colors**: Background, foreground, primary, secondary, muted, accent, destructive, and more
- **Dark Mode**: Full dark mode support with `@variant dark`
- **Shadows**: 8 levels of shadows (2xs to 2xl)
- **Radius**: Customizable border radius values
- **Typography**: Letter spacing and font family tokens
- **Charts**: 5 chart color tokens for data visualization

## Customization

To customize the theme for a specific app, you can override the CSS variables in your app's CSS file after importing the shared theme.

## Benefits

- **Consistency**: Ensures design consistency across web and mobile apps
- **Maintainability**: Single source of truth for design tokens
- **DRY**: Avoid duplicating theme configuration
- **Type Safety**: Shared configuration reduces errors
