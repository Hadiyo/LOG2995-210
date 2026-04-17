import { EventEmitter } from 'events';
import { WaitingRoomEvents, WaitingRoomStatePayload } from '@common/socket-events';
import {
    WaitingRoom,
    WaitingRoomCancelledEvent,
    WaitingRoomDirectoryUpdatedEvent,
    WaitingRoomErrorEvent,
    WaitingRoomGameStartedEvent,
    WaitingRoomMessageSentEvent,
    WaitingRoomPlayerKickedEvent,
    WaitingRoomUpdatedEvent,
} from './waiting-room.types';

type WaitingRoomStateReader = (accessCode: string) => WaitingRoomStatePayload | null;

export const emitWaitingRoomUpdated = (
    events: EventEmitter,
    room: WaitingRoom,
    getWaitingRoomState: WaitingRoomStateReader,
): void => {
    const payload = getWaitingRoomState(room.accessCode);
    if (!payload) {
        return;
    }

    events.emit(WaitingRoomEvents.WaitingRoomUpdated, { accessCode: room.accessCode, payload } as WaitingRoomUpdatedEvent);
};

export const emitWaitingRoomError = (events: EventEmitter, socketId: string, message: string): void => {
    events.emit(WaitingRoomEvents.WaitingRoomError, { socketId, payload: { message } } as WaitingRoomErrorEvent);
};

export const emitWaitingRoomDirectoryUpdated = (events: EventEmitter): void => {
    events.emit(WaitingRoomEvents.WaitingRoomDirectoryUpdated, { updatedAt: new Date().toISOString() } as WaitingRoomDirectoryUpdatedEvent);
};

export const emitWaitingRoomCancelled = (events: EventEmitter, accessCode: string): void => {
    events.emit(WaitingRoomEvents.WaitingRoomCancelled, { accessCode } as WaitingRoomCancelledEvent);
};

export const emitWaitingRoomMessageSent = (
    events: EventEmitter,
    accessCode: string,
    message: WaitingRoom['messages'][number],
): void => {
    events.emit(WaitingRoomEvents.WaitingRoomMessageSent, { accessCode, payload: message } as WaitingRoomMessageSentEvent);
};

export const emitWaitingRoomPlayerKicked = (events: EventEmitter, accessCode: string, kickedSocketId: string): void => {
    events.emit(WaitingRoomEvents.WaitingRoomPlayerKicked, { accessCode, kickedSocketId } as WaitingRoomPlayerKickedEvent);
};

export const emitWaitingRoomGameStarted = (
    events: EventEmitter,
    accessCode: string,
    sessionId: string,
    messages: WaitingRoom['messages'],
): void => {
    events.emit(WaitingRoomEvents.WaitingRoomGameStarted, { accessCode, sessionId, messages } as WaitingRoomGameStartedEvent);
};
