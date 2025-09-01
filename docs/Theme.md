# Theme System Documentation

## Overview

The EpiSensor App Framework provides a centralised theme system that ensures consistent visual design across all applications. Currently, there is one standard EpiSensor theme, but the architecture supports multiple themes if needed in the future.

## Theme Structure

The theme system (`ui/theme/index.ts`) provides:

### 1. Colour Palette
```typescript
theme.colors = {
  primary: {
    DEFAULT: '#E21350',  // EpiSensor brand pink
    hover: '#c01144',
    light: '#ff4d7d',
    dark: '#a00e3a',
  },
  // Semantic colours for success, warning, error, info
  // Dark and light mode colour sets
}
```

### 2. Design Tokens
- **Gradients**: Subtle visual effects
- **Shadows**: Consistent elevation system
- **Border Radius**: Standardised rounded corners
- **Spacing**: Consistent padding/margin scale
- **Typography**: Font families, sizes, weights
- **Transitions**: Animation timings
- **Z-index**: Layering system

## Theme Switching

While currently we have one EpiSensor theme, the system supports theme switching:

### CSS Variables Approach
```typescript
import { getCSSVariables } from '@episensor/app-framework/ui';

// Get CSS variables for current theme
const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
const cssVars = getCSSVariables(isDarkMode);

// Apply to root element
Object.entries(cssVars).forEach(([key, value]) => {
  document.documentElement.style.setProperty(key, value);
});
```

### React Context Approach (for future multi-theme support)
```typescript
// Could be extended to support multiple themes
type ThemeName = 'episensor' | 'episensor-dark';

const ThemeContext = React.createContext<{
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}>({
  theme: 'episensor',
  setTheme: () => {},
});
```

## Using the Theme

### In React Components
```typescript
import { theme } from '@episensor/app-framework/ui';

// Direct usage
const StyledDiv = styled.div`
  background-color: ${theme.colors.primary.DEFAULT};
  border-radius: ${theme.radius.md};
  padding: ${theme.spacing.md};
`;

// With Tailwind (recommended)
import { cardStyles } from '@episensor/app-framework/ui';
<div className={cardStyles.interactive}>...</div>
```

### CSS Custom Properties
The theme generates CSS custom properties that can be used directly:
```css
.custom-component {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}
```

## Current Theme: EpiSensor

The default and only current theme reflects the EpiSensor brand:
- **Primary Colour**: #E21350 (EpiSensor Pink)
- **Typography**: Inter for UI, JetBrains Mono for code
- **Style**: Clean, modern, professional
- **Modes**: Light and dark mode support

## Future Extensibility

The architecture supports adding new themes by:
1. Creating a new theme object with the same structure
2. Adding a theme provider/switcher component
3. Storing theme preference in user settings

Currently, this is not needed as we maintain one consistent EpiSensor brand theme.