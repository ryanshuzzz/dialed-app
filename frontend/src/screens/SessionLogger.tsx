import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBikes } from '@/hooks/useBikes';
import { useTracks } from '@/hooks/useTracks';
import { useEvents, useCreateEvent } from '@/hooks/useEvents';
import { useCreateSession } from '@/hooks/useSessions';
import { useIngestCsv, useIngestOcr, useIngestVoice, useIngestionJob, useConfirmIngestion } from '@/hooks/useIngestion';
import { IngestionProgress } from '@/components/session/IngestionProgress';
import type {
  CreateSessionRequest,
  Conditions,
  EventVenue,
  RideMetrics,
  SessionType,
} from '@/api/types';

type Step = 'event' | 'details' | 'upload' | 'review';

const TRACK_SESSION_TYPES = ['practice', 'qualifying', 'race', 'trackday'] as const satisfies readonly SessionType[];
const ROAD_SESSION_TYPES = ['road', 'commute', 'tour'] as const satisfies readonly SessionType[];
const CONDITION_OPTIONS = ['dry', 'damp', 'wet', 'mixed'] as const;

function sessionTypesForVenue(venue: EventVenue): readonly SessionType[] {
  return venue === 'road' ? ROAD_SESSION_TYPES : TRACK_SESSION_TYPES;
}

function parseRideMetrics(
  distanceKm: string,
  durationMin: string,
  fuelL: string,
  odometerKm: string,
  efficiency: string,
): RideMetrics | null {
  const out: RideMetrics = {};
  if (distanceKm.trim()) {
    const v = parseFloat(distanceKm);
    if (Number.isFinite(v)) out.distance_km = v;
  }
  if (durationMin.trim()) {
    const v = parseFloat(durationMin);
    if (Number.isFinite(v)) out.duration_ms = Math.round(v * 60 * 1000);
  }
  if (fuelL.trim()) {
    const v = parseFloat(fuelL);
    if (Number.isFinite(v)) out.fuel_used_l = v;
  }
  if (odometerKm.trim()) {
    const v = parseFloat(odometerKm);
    if (Number.isFinite(v)) out.odometer_km = v;
  }
  if (efficiency.trim()) {
    const v = parseFloat(efficiency);
    if (Number.isFinite(v)) out.fuel_efficiency_l_per_100km = v;
  }
  if (
    out.distance_km == null &&
    out.duration_ms == null &&
    out.fuel_used_l == null &&
    out.odometer_km == null &&
    out.fuel_efficiency_l_per_100km == null
  ) {
    return null;
  }
  return out;
}

export default function SessionLogger() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('event');

  const [eventVenue, setEventVenue] = useState<EventVenue>('track');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [createNewEvent, setCreateNewEvent] = useState(false);
  const [bikeId, setBikeId] = useState('');
  const [trackId, setTrackId] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [conditions, setConditions] = useState<Conditions>({});

  const [rideLocationLabel, setRideLocationLabel] = useState('');
  const [rideLocationNotes, setRideLocationNotes] = useState('');
  const [rideLocationLat, setRideLocationLat] = useState('');
  const [rideLocationLon, setRideLocationLon] = useState('');

  const [sessionType, setSessionType] = useState<SessionType>('practice');
  const [tireFrontBrand, setTireFrontBrand] = useState('');
  const [tireFrontCompound, setTireFrontCompound] = useState('');
  const [tireRearBrand, setTireRearBrand] = useState('');
  const [tireRearCompound, setTireRearCompound] = useState('');
  const [riderFeedback, setRiderFeedback] = useState('');
  const [manualBestLapMs, setManualBestLapMs] = useState('');

  const [rmDistanceKm, setRmDistanceKm] = useState('');
  const [rmDurationMin, setRmDurationMin] = useState('');
  const [rmFuelL, setRmFuelL] = useState('');
  const [rmOdometerKm, setRmOdometerKm] = useState('');
  const [rmEfficiency, setRmEfficiency] = useState('');

  const [activeJobId, setActiveJobId] = useState<string | undefined>(undefined);
  const [activeJobSource, setActiveJobSource] = useState('');
  const [ingestionComplete, setIngestionComplete] = useState(false);

  const [createdSessionId, setCreatedSessionId] = useState<string | undefined>(undefined);

  const { data: bikes, isLoading: bikesLoading } = useBikes();
  const { data: tracks, isLoading: tracksLoading } = useTracks();
  const { data: events } = useEvents();
  const createEvent = useCreateEvent();
  const createSession = useCreateSession();
  const ingestCsv = useIngestCsv();
  const ingestOcr = useIngestOcr();
  const ingestVoice = useIngestVoice();
  const { data: ingestionJob } = useIngestionJob(activeJobId);
  const confirmIngestion = useConfirmIngestion();

  const trackNameById = useMemo(() => {
    const m = new Map<string, string>();
    tracks?.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [tracks]);

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => e.venue === eventVenue);
  }, [events, eventVenue]);

  const effectiveVenue: EventVenue = useMemo(() => {
    if (!createNewEvent && selectedEventId && events) {
      const ev = events.find((e) => e.id === selectedEventId);
      if (ev) return ev.venue;
    }
    return eventVenue;
  }, [createNewEvent, selectedEventId, events, eventVenue]);

  const allowedSessionTypes = useMemo(
    () => sessionTypesForVenue(effectiveVenue),
    [effectiveVenue],
  );

  useEffect(() => {
    if (!allowedSessionTypes.includes(sessionType)) {
      setSessionType(allowedSessionTypes[0]);
    }
  }, [allowedSessionTypes, sessionType]);

  useEffect(() => {
    const eid = searchParams.get('event_id');
    if (!eid || !events?.length) return;
    const ev = events.find((x) => x.id === eid);
    if (ev) {
      setCreateNewEvent(false);
      setSelectedEventId(eid);
      setEventVenue(ev.venue);
    }
  }, [searchParams, events]);

  useEffect(() => {
    if (!selectedEventId || !events) return;
    const ev = events.find((e) => e.id === selectedEventId);
    if (ev && ev.venue !== eventVenue) {
      setSelectedEventId('');
    }
  }, [eventVenue, selectedEventId, events]);

  const rideMetricsPayload = useMemo(
    () => parseRideMetrics(rmDistanceKm, rmDurationMin, rmFuelL, rmOdometerKm, rmEfficiency),
    [rmDistanceKm, rmDurationMin, rmFuelL, rmOdometerKm, rmEfficiency],
  );

  const buildCreateSessionRequest = useCallback((): CreateSessionRequest => {
    const lapMs =
      effectiveVenue === 'track' && manualBestLapMs.trim()
        ? parseInt(manualBestLapMs, 10)
        : null;
    return {
      event_id: selectedEventId,
      session_type: sessionType,
      manual_best_lap_ms: Number.isFinite(lapMs as number) ? lapMs : null,
      tire_front: tireFrontBrand
        ? { brand: tireFrontBrand, compound: tireFrontCompound || null, laps: null }
        : null,
      tire_rear: tireRearBrand
        ? { brand: tireRearBrand, compound: tireRearCompound || null, laps: null }
        : null,
      rider_feedback: riderFeedback.trim() ? riderFeedback : null,
      ride_metrics: rideMetricsPayload,
    };
  }, [
    effectiveVenue,
    selectedEventId,
    sessionType,
    manualBestLapMs,
    tireFrontBrand,
    tireFrontCompound,
    tireRearBrand,
    tireRearCompound,
    riderFeedback,
    rideMetricsPayload,
  ]);

  const handleVenueChange = (v: EventVenue) => {
    setEventVenue(v);
    setSelectedEventId('');
    setSessionType(v === 'road' ? 'road' : 'practice');
  };

  const handleNextFromEvent = useCallback(async () => {
    if (createNewEvent) {
      if (!bikeId) return;
      if (eventVenue === 'track') {
        if (!trackId) return;
        try {
          const newEvent = await createEvent.mutateAsync({
            bike_id: bikeId,
            venue: 'track',
            track_id: trackId,
            date: eventDate,
            conditions,
          });
          setSelectedEventId(newEvent.id);
        } catch {
          return;
        }
      } else {
        const label = rideLocationLabel.trim();
        if (!label) return;
        try {
          const newEvent = await createEvent.mutateAsync({
            bike_id: bikeId,
            venue: 'road',
            track_id: null,
            date: eventDate,
            conditions,
            ride_location: {
              label,
              notes: rideLocationNotes.trim() || null,
              approximate_lat: rideLocationLat.trim()
                ? parseFloat(rideLocationLat)
                : null,
              approximate_lon: rideLocationLon.trim()
                ? parseFloat(rideLocationLon)
                : null,
            },
          });
          setSelectedEventId(newEvent.id);
        } catch {
          return;
        }
      }
    } else if (!selectedEventId) {
      return;
    }
    setStep('details');
  }, [
    createNewEvent,
    bikeId,
    trackId,
    eventVenue,
    rideLocationLabel,
    rideLocationNotes,
    rideLocationLat,
    rideLocationLon,
    selectedEventId,
    createEvent,
    eventDate,
    conditions,
  ]);

  const handleNextFromDetails = () => {
    setStep('upload');
  };

  const handleFileUpload = useCallback(
    async (type: 'csv' | 'ocr' | 'voice', file: File) => {
      if (!createdSessionId && !selectedEventId) return;

      let sessionId = createdSessionId;
      if (!sessionId) {
        try {
          const session = await createSession.mutateAsync(buildCreateSessionRequest());
          sessionId = session.id;
          setCreatedSessionId(session.id);
        } catch {
          return;
        }
      }

      try {
        let result: { job_id: string };
        if (type === 'csv') {
          result = await ingestCsv.mutateAsync({ sessionId, file });
        } else if (type === 'ocr') {
          result = await ingestOcr.mutateAsync({ sessionId, file });
        } else {
          result = await ingestVoice.mutateAsync({ sessionId, file });
        }
        setActiveJobId(result.job_id);
        setActiveJobSource(type);
      } catch {
        // Error handled by mutation
      }
    },
    [
      createdSessionId,
      selectedEventId,
      createSession,
      buildCreateSessionRequest,
      ingestCsv,
      ingestOcr,
      ingestVoice,
    ],
  );

  const handleConfirmIngestion = useCallback(async () => {
    if (!activeJobId) return;
    try {
      await confirmIngestion.mutateAsync({ jobId: activeJobId, data: { confirmed: true } });
      setIngestionComplete(true);
      setActiveJobId(undefined);
    } catch {
      // Error handled by mutation
    }
  }, [activeJobId, confirmIngestion]);

  const handleSaveSession = useCallback(async () => {
    if (createdSessionId) {
      navigate(`/sessions/${createdSessionId}`);
      return;
    }
    try {
      const session = await createSession.mutateAsync(buildCreateSessionRequest());
      navigate(`/sessions/${session.id}`);
    } catch {
      // Error handled by mutation
    }
  }, [createdSessionId, createSession, buildCreateSessionRequest, navigate]);

  const eventStepValid =
    createNewEvent &&
    bikeId &&
    (eventVenue === 'track'
      ? !!trackId
      : rideLocationLabel.trim().length > 0);
  const eventNextDisabled =
    createEvent.isPending ||
    (createNewEvent ? !eventStepValid : !selectedEventId);

  const steps: { key: Step; label: string }[] = [
    { key: 'event', label: 'Event' },
    { key: 'details', label: 'Details' },
    { key: 'upload', label: 'Upload' },
    { key: 'review', label: 'Review' },
  ];

  const formatMetricReview = (m: RideMetrics) => {
    const rows: { k: string; v: string }[] = [];
    if (m.distance_km != null) rows.push({ k: 'Distance', v: `${m.distance_km} km` });
    if (m.duration_ms != null)
      rows.push({ k: 'Duration', v: `${(m.duration_ms / 60000).toFixed(1)} min` });
    if (m.fuel_used_l != null) rows.push({ k: 'Fuel', v: `${m.fuel_used_l} L` });
    if (m.odometer_km != null) rows.push({ k: 'Odometer', v: `${m.odometer_km} km` });
    if (m.fuel_efficiency_l_per_100km != null)
      rows.push({ k: 'Fuel economy', v: `${m.fuel_efficiency_l_per_100km} L/100km` });
    return rows;
  };

  return (
    <div className="max-w-2xl mx-auto px-0 sm:px-4" data-testid="session-logger">
      <h2 className="text-2xl font-bold mb-6">Log Session</h2>

      <div className="flex items-center mb-8" data-testid="step-indicator">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1">
            <div
              className={`flex items-center justify-center w-8 h-8 min-w-[32px] rounded-full text-sm font-medium ${
                s.key === step
                  ? 'bg-blue-600 text-white'
                  : steps.findIndex((st) => st.key === step) > i
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i + 1}
            </div>
            <span className="ml-2 text-sm text-gray-600 hidden sm:inline">{s.label}</span>
            {i < steps.length - 1 && <div className="flex-1 h-0.5 mx-2 bg-gray-200" />}
          </div>
        ))}
      </div>

      {step === 'event' && (
        <div className="space-y-4" data-testid="step-event">
          <h3 className="text-lg font-semibold text-gray-800">Select or Create Event</h3>

          <div role="group" aria-label="Event venue" className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 min-h-[44px] cursor-pointer">
              <input
                type="radio"
                name="event-venue"
                checked={eventVenue === 'track'}
                onChange={() => handleVenueChange('track')}
                className="w-5 h-5"
                data-testid="venue-track"
              />
              Track day
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 min-h-[44px] cursor-pointer">
              <input
                type="radio"
                name="event-venue"
                checked={eventVenue === 'road'}
                onChange={() => handleVenueChange('road')}
                className="w-5 h-5"
                data-testid="venue-road"
              />
              Road ride
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 min-h-[44px]">
            <input
              type="checkbox"
              checked={createNewEvent}
              onChange={(e) => setCreateNewEvent(e.target.checked)}
              className="w-5 h-5"
            />
            Create new event
          </label>

          {createNewEvent ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bike *</label>
                <select
                  value={bikeId}
                  onChange={(e) => setBikeId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  data-testid="bike-select"
                >
                  <option value="">Select bike...</option>
                  {bikesLoading && <option disabled>Loading...</option>}
                  {bikes?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.year} {b.make} {b.model}
                    </option>
                  ))}
                </select>
              </div>

              {eventVenue === 'track' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Track *</label>
                  <select
                    value={trackId}
                    onChange={(e) => setTrackId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    data-testid="track-select"
                  >
                    <option value="">Select track...</option>
                    {tracksLoading && <option disabled>Loading...</option>}
                    {tracks?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-800">Ride location</p>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Label *</label>
                    <input
                      type="text"
                      value={rideLocationLabel}
                      onChange={(e) => setRideLocationLabel(e.target.value)}
                      placeholder="e.g. Angeles Crest, commute home"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      data-testid="ride-location-label"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Notes</label>
                    <textarea
                      value={rideLocationNotes}
                      onChange={(e) => setRideLocationNotes(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      data-testid="ride-location-notes"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Approx. latitude</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={rideLocationLat}
                        onChange={(e) => setRideLocationLat(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm"
                        data-testid="ride-location-lat"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Approx. longitude</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={rideLocationLon}
                        onChange={(e) => setRideLocationLon(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm"
                        data-testid="ride-location-lon"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conditions</label>
                <select
                  value={conditions.condition ?? ''}
                  onChange={(e) =>
                    setConditions((c) => ({
                      ...c,
                      condition: (e.target.value || null) as Conditions['condition'],
                    }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select conditions...</option>
                  {CONDITION_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Existing Event</label>
              {filteredEvents.length === 0 && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                  No {eventVenue === 'track' ? 'track' : 'road'} events yet. Check{' '}
                  <strong>Create new event</strong> above to add one, then log a session against it.
                </p>
              )}
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                data-testid="event-select"
              >
                <option value="">Select event...</option>
                {filteredEvents.map((ev) => {
                  const place =
                    ev.venue === 'track'
                      ? trackNameById.get(ev.track_id ?? '') ?? 'Track'
                      : ev.ride_location?.label ?? 'Road ride';
                  return (
                    <option key={ev.id} value={ev.id}>
                      {ev.date} · {place}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {createEvent.isError && (
            <p className="text-sm text-red-600" role="alert">
              Could not create event. Check required fields and try again.
            </p>
          )}

          <button
            onClick={handleNextFromEvent}
            disabled={eventNextDisabled}
            className="px-4 py-2 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            data-testid="next-button"
          >
            {createEvent.isPending ? 'Creating event…' : 'Next'}
          </button>
        </div>
      )}

      {step === 'details' && (
        <div className="space-y-4" data-testid="step-details">
          <h3 className="text-lg font-semibold text-gray-800">Session Details</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Type *</label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as SessionType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              data-testid="session-type-select"
            >
              {allowedSessionTypes.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {effectiveVenue === 'track' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Best Lap Time (ms)</label>
              <input
                type="number"
                value={manualBestLapMs}
                onChange={(e) => setManualBestLapMs(e.target.value)}
                placeholder="e.g. 98432"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                data-testid="manual-best-lap"
              />
            </div>
          )}

          <fieldset
            className={`border rounded-lg p-4 ${
              effectiveVenue === 'road' ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200'
            }`}
          >
            <legend className="text-sm font-medium text-gray-700 px-1">
              {effectiveVenue === 'road' ? 'Ride metrics' : 'Ride metrics (optional)'}
            </legend>
            {effectiveVenue === 'road' && (
              <p className="text-xs text-gray-600 mb-3">
                Optional stats from your ride — distance, time on bike, fuel, odometer.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Distance (km)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rmDistanceKm}
                  onChange={(e) => setRmDistanceKm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm"
                  data-testid="ride-metric-distance"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Duration (minutes)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rmDurationMin}
                  onChange={(e) => setRmDurationMin(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm"
                  data-testid="ride-metric-duration"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Fuel used (L)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rmFuelL}
                  onChange={(e) => setRmFuelL(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm"
                  data-testid="ride-metric-fuel"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Odometer (km)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rmOdometerKm}
                  onChange={(e) => setRmOdometerKm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm"
                  data-testid="ride-metric-odometer"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Fuel efficiency (L/100km)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rmEfficiency}
                  onChange={(e) => setRmEfficiency(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm"
                  data-testid="ride-metric-efficiency"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="border border-gray-200 rounded-lg p-4">
            <legend className="text-sm font-medium text-gray-700 px-1">Tire Info</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Front Brand</label>
                <input
                  type="text"
                  value={tireFrontBrand}
                  onChange={(e) => setTireFrontBrand(e.target.value)}
                  placeholder="Pirelli"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Front Compound</label>
                <input
                  type="text"
                  value={tireFrontCompound}
                  onChange={(e) => setTireFrontCompound(e.target.value)}
                  placeholder="SC1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rear Brand</label>
                <input
                  type="text"
                  value={tireRearBrand}
                  onChange={(e) => setTireRearBrand(e.target.value)}
                  placeholder="Pirelli"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rear Compound</label>
                <input
                  type="text"
                  value={tireRearCompound}
                  onChange={(e) => setTireRearCompound(e.target.value)}
                  placeholder="SC2"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </fieldset>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rider Feedback</label>
            <textarea
              value={riderFeedback}
              onChange={(e) => setRiderFeedback(e.target.value)}
              rows={4}
              placeholder="How did the bike feel? Any issues?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              data-testid="rider-feedback"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('event')}
              className="px-4 py-2 min-h-[44px] bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNextFromDetails}
              className="px-4 py-2 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              data-testid="next-button"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <div className="space-y-4" data-testid="step-upload">
          <h3 className="text-lg font-semibold text-gray-800">Upload Data</h3>

          {effectiveVenue === 'road' ? (
            <>
              <p className="text-sm text-gray-600">
                Telemetry uploads are optional for road rides. Skip ahead to review, or expand below to
                attach CSV, photos, or voice.
              </p>
              <button
                type="button"
                onClick={() => setStep('review')}
                className="px-4 py-2 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                data-testid="skip-upload-button"
              >
                Skip to review
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Upload telemetry CSV, photos for OCR, or voice notes. You can also skip this step.
            </p>
          )}

          {createSession.isError && (
            <p className="text-sm text-red-600" role="alert">
              Could not create session. Ensure you completed the event step with a valid event, then try again.
            </p>
          )}

          <div className={effectiveVenue === 'road' ? 'border border-gray-200 rounded-lg p-3' : ''}>
            {effectiveVenue === 'road' && (
              <p className="text-xs font-medium text-gray-600 mb-2">Optional uploads</p>
            )}
            <div className="grid gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Telemetry CSV</h4>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload('csv', file);
                  }}
                  className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:min-h-[44px]"
                  data-testid="csv-upload"
                />
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Photo (OCR)</h4>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload('ocr', file);
                  }}
                  className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:min-h-[44px]"
                  data-testid="ocr-upload"
                />
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Voice Note</h4>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload('voice', file);
                  }}
                  className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:min-h-[44px]"
                  data-testid="voice-upload"
                />
              </div>
            </div>
          </div>

          {activeJobId && (
            <div className="space-y-3">
              <IngestionProgress
                status={ingestionJob?.status ?? 'pending'}
                source={activeJobSource}
                jobId={activeJobId}
              />
              {ingestionJob?.status === 'complete' && ingestionJob.result && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4" data-testid="ingestion-result">
                  <h4 className="text-sm font-semibold text-green-800 mb-2">Parsed Results</h4>
                  <pre className="text-xs text-green-700 overflow-auto max-h-40">
                    {JSON.stringify(ingestionJob.result, null, 2)}
                  </pre>
                  <button
                    type="button"
                    onClick={handleConfirmIngestion}
                    className="mt-3 px-4 py-2 min-h-[44px] bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    data-testid="confirm-ingestion"
                  >
                    Confirm Results
                  </button>
                </div>
              )}
            </div>
          )}

          {ingestionComplete && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700">Ingestion confirmed successfully.</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('details')}
              className="px-4 py-2 min-h-[44px] bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep('review')}
              className="px-4 py-2 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              data-testid="next-button"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4" data-testid="step-review">
          <h3 className="text-lg font-semibold text-gray-800">Review & Save</h3>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Session Type</span>
              <span className="font-medium text-gray-900 capitalize">{sessionType}</span>
            </div>
            {effectiveVenue === 'track' && manualBestLapMs && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Best Lap</span>
                <span className="font-medium text-gray-900">{manualBestLapMs}ms</span>
              </div>
            )}
            {rideMetricsPayload &&
              formatMetricReview(rideMetricsPayload).map((row) => (
                <div key={row.k} className="flex justify-between text-sm">
                  <span className="text-gray-500">{row.k}</span>
                  <span className="font-medium text-gray-900">{row.v}</span>
                </div>
              ))}
            {tireFrontBrand && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Front Tire</span>
                <span className="font-medium text-gray-900">
                  {tireFrontBrand} {tireFrontCompound}
                </span>
              </div>
            )}
            {tireRearBrand && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Rear Tire</span>
                <span className="font-medium text-gray-900">
                  {tireRearBrand} {tireRearCompound}
                </span>
              </div>
            )}
            {riderFeedback && (
              <div className="text-sm">
                <span className="text-gray-500">Feedback:</span>
                <p className="text-gray-700 mt-1">{riderFeedback}</p>
              </div>
            )}
          </div>

          {createSession.isError && (
            <p className="text-sm text-red-600" role="alert">
              Save failed. Check your connection and that an event is selected, then try again.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="px-4 py-2 min-h-[44px] bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSaveSession}
              disabled={createSession.isPending || (!createdSessionId && !selectedEventId)}
              className="px-4 py-2 min-h-[44px] bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              data-testid="save-session"
            >
              {createSession.isPending
                ? 'Saving…'
                : createdSessionId
                  ? 'View Session'
                  : 'Save Session'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
