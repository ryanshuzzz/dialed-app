import { create } from 'zustand'

type SessionType = 'practice' | 'qualifying' | 'race' | 'trackday'
type Compound = 'SC0' | 'SC1' | 'SC2' | 'Road'
type Condition = 'Dry' | 'Damp' | 'Wet'

interface SessionFormState {
  // Step 1: Setup
  sessionType: SessionType
  frontCompound: Compound
  rearCompound: Compound
  newTires: boolean
  trackTemp: string
  airTemp: string
  condition: Condition
  notes: string
  showConditions: boolean

  // Step 2: Suspension
  frontSettings: {
    spring: number
    compression: number
    rebound: number
    preload: number
    forkHeight: number
  }
  rearSettings: {
    spring: number
    compression: number
    rebound: number
    preload: number
  }
  geometrySettings: {
    forkHeight: number
    gearingFront: number
    gearingRear: number
  }

  // Step 3: Feedback
  feedbackMode: 'manual' | 'voice' | 'photo' | 'csv'
  selectedSymptoms: string[]
  feedbackText: string
  bestLap: { minutes: string; seconds: string; millis: string }

  // Actions
  setSessionType: (type: SessionType) => void
  setFrontCompound: (compound: Compound) => void
  setRearCompound: (compound: Compound) => void
  setNewTires: (value: boolean) => void
  setTrackTemp: (value: string) => void
  setAirTemp: (value: string) => void
  setCondition: (condition: Condition) => void
  setNotes: (notes: string) => void
  setShowConditions: (show: boolean) => void
  updateFrontSetting: (key: string, value: number) => void
  updateRearSetting: (key: string, value: number) => void
  updateGeometrySetting: (key: string, value: number) => void
  setFeedbackMode: (mode: 'manual' | 'voice' | 'photo' | 'csv') => void
  toggleSymptom: (symptom: string) => void
  setFeedbackText: (text: string) => void
  setBestLap: (lap: { minutes: string; seconds: string; millis: string }) => void
  resetForm: () => void
  copyFromLastSession: () => void
}

const previousFront = {
  spring: 10.75,
  compression: 16,
  rebound: 14,
  preload: 2,
  forkHeight: 8.6,
}

const previousRear = {
  spring: 110,
  compression: 12,
  rebound: 15,
  preload: 10,
}

const initialState = {
  sessionType: 'practice' as SessionType,
  frontCompound: 'SC1' as Compound,
  rearCompound: 'SC1' as Compound,
  newTires: false,
  trackTemp: '35',
  airTemp: '18',
  condition: 'Dry' as Condition,
  notes: '',
  showConditions: false,

  frontSettings: {
    spring: 10.75,
    compression: 16,
    rebound: 12,
    preload: 2,
    forkHeight: 8.6,
  },
  rearSettings: {
    spring: 110,
    compression: 12,
    rebound: 15,
    preload: 10,
  },
  geometrySettings: {
    forkHeight: 8.6,
    gearingFront: 15,
    gearingRear: 44,
  },

  feedbackMode: 'manual' as const,
  selectedSymptoms: ['Brake-to-throttle chatter'],
  feedbackText: '',
  bestLap: { minutes: '1', seconds: '45', millis: '972' },
}

export const useSessionFormStore = create<SessionFormState>((set) => ({
  ...initialState,

  setSessionType: (sessionType) => set({ sessionType }),
  setFrontCompound: (frontCompound) => set({ frontCompound }),
  setRearCompound: (rearCompound) => set({ rearCompound }),
  setNewTires: (newTires) => set({ newTires }),
  setTrackTemp: (trackTemp) => set({ trackTemp }),
  setAirTemp: (airTemp) => set({ airTemp }),
  setCondition: (condition) => set({ condition }),
  setNotes: (notes) => set({ notes }),
  setShowConditions: (showConditions) => set({ showConditions }),

  updateFrontSetting: (key, value) =>
    set((state) => ({
      frontSettings: { ...state.frontSettings, [key]: value },
    })),
  updateRearSetting: (key, value) =>
    set((state) => ({
      rearSettings: { ...state.rearSettings, [key]: value },
    })),
  updateGeometrySetting: (key, value) =>
    set((state) => ({
      geometrySettings: { ...state.geometrySettings, [key]: value },
    })),

  setFeedbackMode: (feedbackMode) => set({ feedbackMode }),
  toggleSymptom: (symptom) =>
    set((state) => ({
      selectedSymptoms: state.selectedSymptoms.includes(symptom)
        ? state.selectedSymptoms.filter((s) => s !== symptom)
        : [...state.selectedSymptoms, symptom],
    })),
  setFeedbackText: (feedbackText) => set({ feedbackText }),
  setBestLap: (bestLap) => set({ bestLap }),

  resetForm: () => set(initialState),
  copyFromLastSession: () =>
    set({
      frontSettings: { ...previousFront },
      rearSettings: { ...previousRear },
    }),
}))

// Export previous values for delta display
export const previousFrontSettings = previousFront
export const previousRearSettings = previousRear
