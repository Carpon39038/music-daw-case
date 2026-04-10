import { useMemo, useState } from 'react'
import { useDAWStore } from '../store/useDAWStore'

export function ProjectGallery() {
  const galleryProjects = useDAWStore((s) => s.galleryProjects || [])
  const project = useDAWStore((s) => s.project)
  const saveProjectToGallery = useDAWStore((s) => s.saveProjectToGallery)
  const loadGalleryProject = useDAWStore((s) => s.loadGalleryProject)
  const deleteGalleryProject = useDAWStore((s) => s.deleteGalleryProject)

  const [isOpen, setIsOpen] = useState(false)

  const sortedProjects = useMemo(
    () => [...galleryProjects].sort((a, b) => b.savedAt - a.savedAt),
    [galleryProjects],
  )

  return (
    <div className="relative" data-testid="project-gallery">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 text-gray-300 border border-gray-800 rounded"
        data-testid="gallery-toggle-btn"
        title="Open local project gallery"
      >
        Gallery ({galleryProjects.length})
      </button>

      {isOpen && (
        <div className="absolute right-0 top-9 w-[340px] max-h-[420px] overflow-auto rounded-md border border-gray-800 bg-[#111] p-2 shadow-xl z-50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gray-300">Local Project Gallery</div>
            <button
              type="button"
              onClick={() => saveProjectToGallery()}
              className="text-[11px] px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white"
              data-testid="gallery-save-current-btn"
            >
              Save Current
            </button>
          </div>

          {sortedProjects.length === 0 ? (
            <div className="text-xs text-gray-500 px-1 py-2">No saved projects yet.</div>
          ) : (
            <ul className="space-y-1" data-testid="gallery-project-list">
              {sortedProjects.map((item) => {
                const isCurrent = item.id === project.id
                return (
                  <li
                    key={item.id}
                    className={`border rounded p-2 ${isCurrent ? 'border-emerald-700 bg-emerald-950/20' : 'border-gray-800 bg-[#161616]'}`}
                    data-testid={`gallery-item-${item.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-200 truncate">{item.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(item.savedAt).toLocaleString([], { hour12: false })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => loadGalleryProject(item.id)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200"
                          data-testid={`gallery-load-${item.id}`}
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteGalleryProject(item.id)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 hover:bg-red-900/60 text-red-300"
                          data-testid={`gallery-delete-${item.id}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
