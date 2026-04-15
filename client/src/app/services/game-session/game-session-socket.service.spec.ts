import { TestBed } from '@angular/core/testing';
import { ChatService } from '@app/services/chat/chat.service';
import { MatchStateService } from '@app/services/match/match-state.service';
import { TurnStateService } from '@app/services/match/turn-state.service';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { GameSessionSnapshotPayload, SessionSocketEvents } from '@common/socket-events';
import { GameSessionSocketService } from './game-session-socket.service';

describe('GameSessionSocketService', () => {
    let service: GameSessionSocketService;
    let socketManagerSpy: jasmine.SpyObj<SocketManagerService>;
    let matchStateSpy: jasmine.SpyObj<MatchStateService>;
    let turnStateSpy: jasmine.SpyObj<TurnStateService>;
    let chatServiceSpy: jasmine.SpyObj<ChatService>;

    beforeEach(() => {
        socketManagerSpy = jasmine.createSpyObj<SocketManagerService>('SocketManagerService', ['isSocketAlive', 'connect', 'send', 'on']);
        matchStateSpy = jasmine.createSpyObj<MatchStateService>('MatchStateService', ['hydrateSnapshot']);
        turnStateSpy = jasmine.createSpyObj<TurnStateService>('TurnStateService', ['hydrateSnapshot']);
        chatServiceSpy = jasmine.createSpyObj<ChatService>('ChatService', ['loadChatMessages']);
        socketManagerSpy.isSocketAlive.and.returnValue(true);

        TestBed.configureTestingModule({
            providers: [
                GameSessionSocketService,
                { provide: SocketManagerService, useValue: socketManagerSpy },
                { provide: MatchStateService, useValue: matchStateSpy },
                { provide: TurnStateService, useValue: turnStateSpy },
                { provide: ChatService, useValue: chatServiceSpy },
            ],
        });

        service = TestBed.inject(GameSessionSocketService);
    });

    it('loads filtered journal entries from the session snapshot', () => {
        service.joinSession('session-1', 'player-1');

        const snapshotHandler = socketManagerSpy.on.calls.all().find((call) => call.args[0] === SessionSocketEvents.GameSessionSnapshot)
            ?.args[1] as ((payload: GameSessionSnapshotPayload) => void) | undefined;
        expect(snapshotHandler).toBeDefined();

        snapshotHandler?.({
            sessionId: 'session-1',
            match: {} as never,
            turnState: {} as never,
            messages: [{ id: 'chat-1', author: 'Alice', content: 'Salut', createdAt: '2026-01-01T10:00:00.000Z' }],
            logEntries: [{
                id: 'log-1',
                author: 'Journal',
                content: 'Alice remporte un combat contre Bob.',
                createdAt: '2026-01-01T10:00:01.000Z',
                involvedPlayers: ['Alice', 'Bob'],
            }],
        });

        expect(chatServiceSpy.loadChatMessages).toHaveBeenCalled();
        expect(service.logEntries()).toEqual([{
            id: 'log-1',
            author: 'Journal',
            content: 'Alice remporte un combat contre Bob.',
            createdAt: '2026-01-01T10:00:01.000Z',
            involvedPlayers: ['Alice', 'Bob'],
        }]);
    });
});
