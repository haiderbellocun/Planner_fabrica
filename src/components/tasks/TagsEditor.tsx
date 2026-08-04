import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useUpdateTask, useProjectTags } from '@/hooks/useTasks';

interface TagsEditorProps {
  taskId: string;
  projectId: string;
  tags: string[];
  disabled?: boolean;
}

const MAX_TAG_LENGTH = 24;
const MAX_TAGS = 10;

function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
}

export function TagsEditor({ taskId, projectId, tags, disabled }: TagsEditorProps) {
  const updateTask = useUpdateTask();
  const { data: suggestions = [] } = useProjectTags(projectId);
  const [input, setInput] = useState('');

  const commit = (nextTags: string[]) => {
    updateTask.mutate({ id: taskId, project_id: projectId, tags: nextTags });
  };

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag) return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setInput('');
      return;
    }
    if (tags.length >= MAX_TAGS) {
      setInput('');
      return;
    }
    commit([...tags, tag]);
    setInput('');
  };

  const removeTag = (tag: string) => {
    commit(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Etiquetas</label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 min-h-[38px]">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded-full hover:bg-muted-foreground/20"
                aria-label={`Quitar etiqueta ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        {!disabled && (
          <input
            list={`tag-suggestions-${taskId}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => addTag(input)}
            placeholder={tags.length === 0 ? 'Agregar etiqueta...' : ''}
            className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        )}
        <datalist id={`tag-suggestions-${taskId}`}>
          {suggestions.filter((s) => !tags.includes(s)).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
