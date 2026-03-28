import { useState, useRef, useCallback, useEffect } from 'react';
import { TimelineItem, AudioTimelineItem } from '../types';

export interface ProjectState {
  timeline: TimelineItem[];
  audioItems: AudioTimelineItem[];
  voiceoverClips: AudioTimelineItem[];
}

export function useProjectHistory(initialState: ProjectState, limit: number = 50) {
  // UI state for React to render
  const [state, setState] = useState<ProjectState>(initialState);
  
  // Authoritative synchronous Ref (Immune to React's asynchronous setState and Strict Mode double-invocations)
  const currentStateRef = useRef<ProjectState>(initialState);
  
  const historyRef = useRef<ProjectState[]>([]);
  const redoRef = useRef<ProjectState[]>([]);
  const [historyLength, setHistoryLength] = useState(0);
  const [redoLength, setRedoLength] = useState(0);
  
  // Timer for debouncing slider drags & rapid changes
  const batchTimeoutRef = useRef<number | null>(null);

  // Sync React UI to the authoritative Refs
  const syncReactState = useCallback(() => {
    setState(currentStateRef.current);
    setHistoryLength(historyRef.current.length);
    setRedoLength(redoRef.current.length);
  }, []);

  // Flush any active batch timer. Called before discrete actions (e.g. cut, drag drop, add)
  // to force the new action into a separate undo step.
  const commitSnapshotNow = useCallback(() => {
    if (batchTimeoutRef.current !== null) {
      window.clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
  }, []);

  // The core synchronous state updater
  const updateState = useCallback((updater: (draft: ProjectState) => ProjectState | void) => {
    const prev = currentStateRef.current;
    
    // If not in a batch (i.e. first stroke of a new action)
    if (batchTimeoutRef.current === null) {
       // Save EXACT previous state BEFORE mutating it
       historyRef.current.push(JSON.parse(JSON.stringify(prev)));
       if (historyRef.current.length > limit) historyRef.current.shift();
       // Any new mutation invalidates the future redo timeline
       redoRef.current = []; 
    }
    
    // Create an immutable draft for the updater to mutate
    const draft = JSON.parse(JSON.stringify(prev)) as ProjectState;
    const res = updater(draft);
    
    // Next state is either the modified draft, or returned result
    const nextState = res === undefined ? draft : res;
    
    // Update authoritative state
    currentStateRef.current = nextState;

    // Reset the batch debounce timer (100ms)
    // As long as updateState is called within 100ms, it is considered ONE continuous edit (e.g. dragging a slider)
    // and we will NOT push multiple states to history.
    if (batchTimeoutRef.current !== null) {
       window.clearTimeout(batchTimeoutRef.current);
    }
    batchTimeoutRef.current = window.setTimeout(() => {
       batchTimeoutRef.current = null; // Batch ends. Next edit will push to history!
    }, 100);

    syncReactState();
  }, [limit, syncReactState]);

  const undo = useCallback(() => {
    // If currently dragging or in a batch, cancel it.
    // The previous state was ALREADY saved at the beginning of the batch!
    commitSnapshotNow();

    if (historyRef.current.length === 0) return;
    
    const pastState = historyRef.current.pop()!;
    // Push our current state to the future so we can redo it
    redoRef.current.push(JSON.parse(JSON.stringify(currentStateRef.current)));
    
    // Rollback
    currentStateRef.current = pastState;
    syncReactState();
  }, [commitSnapshotNow, syncReactState]);

  const redo = useCallback(() => {
    // No batching should be alive if we are redoing, but just in case:
    commitSnapshotNow();

    if (redoRef.current.length === 0) return;

    const futureState = redoRef.current.pop()!;
    // Emplace our current state into history so we can backtrack again
    historyRef.current.push(JSON.parse(JSON.stringify(currentStateRef.current)));
    
    // Roll forward
    currentStateRef.current = futureState;
    syncReactState();
  }, [commitSnapshotNow, syncReactState]);

  // Backward compatible dispatcher API for components
  const setTimeline = useCallback((val: TimelineItem[] | ((prev: TimelineItem[]) => TimelineItem[])) => {
    updateState(draft => {
      draft.timeline = typeof val === 'function' ? val(draft.timeline) : val;
      return draft;
    });
  }, [updateState]);

  const setAudioItems = useCallback((val: AudioTimelineItem[] | ((prev: AudioTimelineItem[]) => AudioTimelineItem[])) => {
    updateState(draft => {
      draft.audioItems = typeof val === 'function' ? val(draft.audioItems) : val;
      return draft;
    });
  }, [updateState]);

  const setVoiceoverClips = useCallback((val: AudioTimelineItem[] | ((prev: AudioTimelineItem[]) => AudioTimelineItem[])) => {
    updateState(draft => {
      draft.voiceoverClips = typeof val === 'function' ? val(draft.voiceoverClips) : val;
      return draft;
    });
  }, [updateState]);

  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current !== null) clearTimeout(batchTimeoutRef.current);
    };
  }, []);

  return {
    state,
    setTimeline,
    setAudioItems,
    setVoiceoverClips,
    undo,
    redo,
    historyLength,
    redoLength,
    commitSnapshotNow
  };
}
