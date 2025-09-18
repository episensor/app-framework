/**
 * EpiSensor UI Framework - Shared Style Constants
 * Reusable Tailwind class combinations for consistency
 * 
 * @module @episensor/ui-framework/styles
 */

export const cardStyles = {
  base: "transition-all duration-200",
  interactive: "hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer",
  elevation: "shadow-sm",
} as const;

export const buttonStyles = {
  primary: "gap-2",
  icon: "h-4 w-4",
} as const;

export const emptyStateStyles = {
  container: "flex flex-col items-center justify-center py-12 text-center",
  icon: "h-12 w-12 text-muted-foreground mb-4",
  title: "text-lg font-medium mb-2",
  description: "text-sm text-muted-foreground max-w-sm",
} as const;

export const activityStyles = {
  led: "w-2 h-2 rounded-full transition-all duration-200",
  pulse: "animate-pulse",
  colors: {
    read: "bg-green-500",
    write: "bg-blue-500",
    inactive: "bg-gray-400",
    error: "bg-red-500",
  }
} as const;

export const statusStyles = {
  badge: {
    success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    default: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  }
} as const;
