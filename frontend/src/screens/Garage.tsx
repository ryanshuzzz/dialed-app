import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight, Wrench } from 'lucide-react'
import { useBikes, useCreateBike } from '@/hooks/useBikes'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CreateBikeRequest } from '@/api/types'

const INITIAL_FORM: CreateBikeRequest = {
  make: '',
  model: '',
  year: null,
  color: null,
  mileage_km: null,
  status: 'owned',
}

export default function Garage() {
  const { data: bikes, isLoading, isError, refetch } = useBikes()
  const createBike = useCreateBike()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<CreateBikeRequest>({ ...INITIAL_FORM })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.make.trim() || !form.model.trim()) return
    createBike.mutate(form, {
      onSuccess: () => {
        setShowAdd(false)
        setForm({ ...INITIAL_FORM })
      },
    })
  }

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-mono text-2xl font-semibold text-foreground">Garage</h1>
            <p className="mt-1 text-sm text-foreground-secondary">Loading...</p>
          </div>
        </div>
        <LoadingSkeleton variant="cards" count={3} />
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-mono text-2xl font-semibold text-foreground">Garage</h1>
        </div>
        <ErrorState message="Failed to load bikes. Please try again." onRetry={() => refetch()} />
      </div>
    )
  }

  const bikeCount = bikes?.length ?? 0

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold text-foreground">Garage</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            {bikeCount} bike{bikeCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="h-9 gap-1.5 rounded bg-accent-orange px-3 text-sm font-medium text-white hover:bg-accent-orange-hover"
          data-testid="add-bike-button"
        >
          <Plus className="h-4 w-4" />
          Add Bike
        </Button>
      </div>

      {bikes && bikes.length > 0 ? (
        <div className={cn(
          'flex flex-col gap-3 lg:grid',
          bikeCount === 1 ? 'lg:grid-cols-1 lg:max-w-2xl' : 'lg:grid-cols-2 xl:grid-cols-3'
        )} data-testid="bike-grid">
          {bikes.map((bike) => (
            <Link key={bike.id} to={`/bikes/${bike.id}`}>
              <div className="group relative flex items-center gap-4 rounded-lg border border-border-subtle bg-background-surface p-4 lg:p-5 transition-colors hover:border-border active:bg-background-elevated">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-elevated">
                  <Wrench className="h-6 w-6 text-foreground-muted" />
                </div>

                <div className="flex-1">
                  <h3 className="font-medium text-foreground">
                    {bike.year ? `${bike.year} ` : ''}
                    {bike.make} {bike.model}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-foreground-secondary">
                    <span>{bike.status}</span>
                    {bike.mileage_km != null && (
                      <>
                        <span className="text-foreground-muted">·</span>
                        <span>{bike.mileage_km.toLocaleString()} km</span>
                      </>
                    )}
                  </div>
                  {bike.color && (
                    <div className="mt-1 text-xs text-foreground-muted">
                      {bike.color}
                    </div>
                  )}
                </div>

                <ChevronRight className="h-5 w-5 text-foreground-muted transition-colors group-hover:text-foreground-secondary" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No bikes yet"
          description="Add your first bike to get started with Dialed."
          action={{ label: 'Add Bike', onClick: () => setShowAdd(true) }}
        />
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Bike">
        <form onSubmit={handleSubmit} data-testid="add-bike-form">
          <div className="space-y-4">
            <div>
              <label htmlFor="make" className="block text-sm font-medium text-foreground-secondary mb-1">
                Make *
              </label>
              <input
                id="make"
                type="text"
                required
                value={form.make}
                onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                className="w-full px-3 py-2 min-h-[44px] border border-border-subtle bg-background-elevated rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:ring-2 focus:ring-accent-orange focus:border-accent-orange outline-none"
                placeholder="e.g. Ducati"
              />
            </div>

            <div>
              <label htmlFor="model" className="block text-sm font-medium text-foreground-secondary mb-1">
                Model *
              </label>
              <input
                id="model"
                type="text"
                required
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="w-full px-3 py-2 min-h-[44px] border border-border-subtle bg-background-elevated rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:ring-2 focus:ring-accent-orange focus:border-accent-orange outline-none"
                placeholder="e.g. Panigale V4"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="year" className="block text-sm font-medium text-foreground-secondary mb-1">
                  Year
                </label>
                <input
                  id="year"
                  type="number"
                  min={1900}
                  max={2100}
                  value={form.year ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      year: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full px-3 py-2 min-h-[44px] border border-border-subtle bg-background-elevated rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:ring-2 focus:ring-accent-orange focus:border-accent-orange outline-none"
                  placeholder="2024"
                />
              </div>
              <div>
                <label htmlFor="color" className="block text-sm font-medium text-foreground-secondary mb-1">
                  Color
                </label>
                <input
                  id="color"
                  type="text"
                  value={form.color ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, color: e.target.value || null }))
                  }
                  className="w-full px-3 py-2 min-h-[44px] border border-border-subtle bg-background-elevated rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:ring-2 focus:ring-accent-orange focus:border-accent-orange outline-none"
                  placeholder="Red"
                />
              </div>
            </div>

            <div>
              <label htmlFor="mileage" className="block text-sm font-medium text-foreground-secondary mb-1">
                Mileage (km)
              </label>
              <input
                id="mileage"
                type="number"
                min={0}
                value={form.mileage_km ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mileage_km: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="w-full px-3 py-2 min-h-[44px] border border-border-subtle bg-background-elevated rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:ring-2 focus:ring-accent-orange focus:border-accent-orange outline-none"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAdd(false)}
              className="min-h-[44px] border-border text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createBike.isPending}
              className="min-h-[44px] bg-accent-orange text-white hover:bg-accent-orange-hover disabled:opacity-50"
            >
              {createBike.isPending ? 'Adding...' : 'Add Bike'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
