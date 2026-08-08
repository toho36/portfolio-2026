export interface MachineGroupChoreographyInput {
  readonly conveyorProgress: number
  readonly timelineProgress: number
  readonly reducedMotion: boolean
}

export interface MachineGroupChoreography {
  readonly magnetizedConveyorProgress: number
  readonly magnetizedTimelineProgress: number
  readonly ratchetOffset: number
  readonly positionX: number
  readonly positionY: number
  readonly rotationX: number
  readonly rotationY: number
  readonly scale: number
}

export function deriveMachineGroupChoreography({
  conveyorProgress,
  timelineProgress,
  reducedMotion,
}: MachineGroupChoreographyInput): MachineGroupChoreography {
  const clampedConveyorProgress = Math.min(
    1,
    Math.max(0, conveyorProgress),
  )
  const clampedTimelineProgress = Math.min(
    1,
    Math.max(0, timelineProgress),
  )
  const conveyorProgressForMotion = reducedMotion
    ? Math.round(clampedConveyorProgress * 3) / 3
    : clampedConveyorProgress
  const timelineProgressForMotion = reducedMotion
    ? Math.round(clampedTimelineProgress * 3) / 3
    : clampedTimelineProgress

  const conveyorSegment = Math.min(
    2,
    Math.floor(conveyorProgressForMotion * 3),
  )
  const conveyorSegmentProgress =
    conveyorProgressForMotion * 3 - conveyorSegment
  const smoothConveyorProgress =
    conveyorSegmentProgress *
    conveyorSegmentProgress *
    (3 - 2 * conveyorSegmentProgress)
  const magnetizedConveyorProgress =
    (conveyorSegment + smoothConveyorProgress) / 3

  const timelineSegment = Math.min(
    2,
    Math.floor(timelineProgressForMotion * 3),
  )
  const timelineSegmentProgress =
    timelineProgressForMotion * 3 - timelineSegment
  const smoothTimelineProgress =
    timelineSegmentProgress *
    timelineSegmentProgress *
    (3 - 2 * timelineSegmentProgress)
  const magnetizedTimelineProgress =
    (timelineSegment + smoothTimelineProgress) / 3

  const ratchetOffset =
    reducedMotion || Number.isInteger(conveyorProgressForMotion * 3)
      ? 0
      : Math.sin(clampedConveyorProgress * Math.PI * 6) * 0.012

  return {
    magnetizedConveyorProgress,
    magnetizedTimelineProgress,
    ratchetOffset,
    positionX: (magnetizedConveyorProgress - 0.5) * 0.36 + ratchetOffset,
    positionY: (magnetizedTimelineProgress - 0.5) * 0.18,
    rotationX: (magnetizedTimelineProgress - 0.5) * 0.08,
    rotationY:
      (magnetizedConveyorProgress - 0.5) * 0.5 + ratchetOffset * 0.4,
    scale: 0.96 + magnetizedTimelineProgress * 0.04,
  }
}
