import { useEffect } from "react";

export function useDocumentMetadata(title: string, description: string): void {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta !== null) {
      meta.content = description;
    }
  }, [description, title]);
}
