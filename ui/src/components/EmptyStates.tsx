import { EmptyState } from './EmptyState';
import { FileText, Search, Server, Plus } from 'lucide-react';

interface NoTemplatesFoundProps {
  onCreate?: () => void;
}

export function NoTemplatesFound({ onCreate }: NoTemplatesFoundProps) {
  return (
    <EmptyState
      icon={<FileText className="w-12 h-12" />}
      title="No templates found"
      description="Create your first template to start simulating Modbus devices"
      action={onCreate ? {
        label: "Create Template",
        onClick: onCreate,
        icon: <Plus className="w-4 h-4" />
      } : undefined}
    />
  );
}

interface NoSearchResultsProps {
  searchTerm?: string;
  onClearFilters?: () => void;
}

export function NoSearchResults({ searchTerm, onClearFilters }: NoSearchResultsProps) {
  return (
    <EmptyState
      icon={<Search className="w-12 h-12" />}
      title="No results found"
      description={searchTerm ? `No templates match "${searchTerm}"` : "Try adjusting your search or filter criteria"}
      action={onClearFilters ? {
        label: "Clear Filters",
        onClick: onClearFilters
      } : undefined}
    />
  );
}

interface NoSimulatorsRunningProps {
  onNavigateToTemplates?: () => void;
}

export function NoSimulatorsRunning({ onNavigateToTemplates }: NoSimulatorsRunningProps) {
  return (
    <EmptyState
      icon={<Server className="w-12 h-12" />}
      title="No simulators running"
      description="Start a simulator from a template to begin testing your Modbus devices"
      action={onNavigateToTemplates ? {
        label: "Browse Templates",
        onClick: onNavigateToTemplates
      } : undefined}
    />
  );
}

// Export all empty states as a collection
export const EmptyStates = {
  NoTemplatesFound,
  NoTemplatesMatchSearch: NoSearchResults,
  NoSimulatorsRunning
};
