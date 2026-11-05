import { Folder } from "@gorth-io/primitive/cores/lucide";
import { PageShell } from "@/pages/shared";
import { FoldersCard } from "@/components/element/folders-card";
export function FoldersPage() {
  return <PageShell title="Folders" icon={Folder}><FoldersCard /></PageShell>;
}
